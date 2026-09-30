/**
 * Patient refunds of a consult paid with card, MyDoctors360 credit, or both.
 *
 * The credit portion always returns to the wallet. The card portion returns
 * to the card unless the patient chose "wallet", in which case it becomes
 * wallet credit and the doctor's destination transfer is clawed back.
 * A card cent is never both Stripe-refunded and credited.
 *
 * The old wallet destination refunded the whole amount on the payment intent
 * and then credited that same amount to the wallet. That paid the card
 * portion twice. This split uses the stored card and credit amounts.
 */

import { createAdminClient } from "@/lib/supabase/admin";
import { creditWallet, type WalletSourceType } from "@/lib/wallet";
import { log } from "@/lib/utils/logger";
import {
  refundConsultCardAndCreditShare,
  type WalletCreditDeps,
} from "@/lib/stripe/wallet-credit-share";
import {
  findDestinationTransfer,
  resolveDestinationTransfer,
  reverseConnectTransfer,
} from "@/lib/stripe/transfer-handoff";

export const CREDIT_REASSIGNMENT_BLOCKED_MESSAGE =
  "This booking was paid partly with MyDoctors360 credit, so it can't be moved to another clinician yet. Please cancel and rebook.";

export type ConsultRefundDestination = "bank" | "wallet";

export interface ConsultPaidParts {
  cardPaidCents: number;
  creditPaidCents: number;
}

const PAID_RESCHEDULE_BALANCE_STATUSES = new Set(["paid", "refunded"]);

/**
 * These three columns decide whether this row's own card charge is the
 * balance PaymentIntent. They may be null. They must be present: a narrow
 * select that omits them would otherwise fall through to `total_amount_cents`
 * (the new full fee, 5000 on a £10 balance row).
 */
export type ConsultReschedulePaidFields = {
  rescheduled_from_booking_id: string | null;
  reschedule_price_diff_cents: number | null;
  reschedule_payment_status: string | null;
};

export const MISSING_CONSULT_RESCHEDULE_PAID_FIELDS =
  "rescheduled_from_booking_id, reschedule_price_diff_cents, and reschedule_payment_status are required. Omitting them would treat total_amount_cents as this booking's card charge.";

const CONSULT_RESCHEDULE_PAID_KEYS = [
  "rescheduled_from_booking_id",
  "reschedule_price_diff_cents",
  "reschedule_payment_status",
] as const satisfies readonly (keyof ConsultReschedulePaidFields)[];

export function assertConsultReschedulePaidFields(
  booking: object
): asserts booking is ConsultReschedulePaidFields {
  const row = booking as Record<string, unknown>;
  for (const key of CONSULT_RESCHEDULE_PAID_KEYS) {
    if (!Object.prototype.hasOwnProperty.call(row, key) || row[key] === undefined) {
      throw new Error(MISSING_CONSULT_RESCHEDULE_PAID_FIELDS);
    }
  }
}

/**
 * Dearer-slot reschedule successor. `total_amount_cents` is the new full fee.
 * This row's own card charge is `reschedule_price_diff_cents` (the balance
 * PaymentIntent). Cheaper reschedules store a non-positive diff, mark
 * payment `not_required`, and rebase `total_amount_cents` instead.
 *
 * Returns null when this row is not a paid balance booking, so callers keep
 * the deposit / consultation-total basis.
 */
export function rescheduleBalanceOwnCardPaidCents(
  booking: ConsultReschedulePaidFields
): number | null {
  assertConsultReschedulePaidFields(booking);
  const diff = Number(booking.reschedule_price_diff_cents || 0);
  if (diff <= 0) return null;
  if (!booking.rescheduled_from_booking_id) return null;
  const status = booking.reschedule_payment_status ?? "";
  if (!PAID_RESCHEDULE_BALANCE_STATUSES.has(status)) return null;
  return diff;
}

/**
 * Card is the amount this booking's own payment actually took, after credit.
 * Credit is wallet_credit_applied_cents. Deposit bookings use the deposit,
 * not the consultation total. A paid dearer-slot balance row uses its own
 * price-diff charge, not `total_amount_cents` (that column is the new full fee;
 * the rest was charged on the paired original booking).
 */
export function storedConsultPaidParts(
  booking: {
    payment_mode?: string | null;
    deposit_amount_cents?: number | null;
    total_amount_cents?: number | null;
    wallet_credit_applied_cents?: number | null;
  } & ConsultReschedulePaidFields
): ConsultPaidParts {
  assertConsultReschedulePaidFields(booking);
  const balanceCardPaidCents = rescheduleBalanceOwnCardPaidCents(booking);
  if (balanceCardPaidCents != null) {
    // The balance PaymentIntent is the full price difference. Wallet credit
    // on this row, if any, is additional to that charge and is normally 0.
    return {
      cardPaidCents: balanceCardPaidCents,
      creditPaidCents: Math.max(
        0,
        Number(booking.wallet_credit_applied_cents || 0)
      ),
    };
  }

  const due =
    booking.payment_mode === "deposit" && booking.deposit_amount_cents != null
      ? booking.deposit_amount_cents
      : Number(booking.total_amount_cents || 0);
  const creditPaidCents = Math.max(
    0,
    Math.min(Number(booking.wallet_credit_applied_cents || 0), Math.max(0, due))
  );
  return {
    cardPaidCents: Math.max(0, due - creditPaidCents),
    creditPaidCents,
  };
}

export interface ConsultRefundCounters {
  cardRefundedToCardCents: number;
  cardCreditedToWalletCents: number;
  creditRefundedCents: number;
}

export function storedConsultRefundCounters(booking: {
  card_refunded_to_card_cents?: number | null;
  card_credited_to_wallet_cents?: number | null;
  credit_refunded_cents?: number | null;
  refund_amount_cents?: number | null;
}): ConsultRefundCounters {
  return {
    cardRefundedToCardCents: Math.max(
      0,
      Number(booking.card_refunded_to_card_cents || 0)
    ),
    cardCreditedToWalletCents: Math.max(
      0,
      Number(booking.card_credited_to_wallet_cents || 0)
    ),
    creditRefundedCents: Math.max(0, Number(booking.credit_refunded_cents || 0)),
  };
}

/**
 * Card/credit still available to return on this booking's own payment.
 * Wallet-destination card settlements are not Stripe-refundable later.
 * Admin refund, cancel, and full-refund detection all cap through here.
 */
export function remainingConsultPaidParts(
  booking: Parameters<typeof storedConsultPaidParts>[0] &
    Parameters<typeof storedConsultRefundCounters>[0]
): ConsultPaidParts & ConsultRefundCounters & { remainingPaidCents: number } {
  const paid = storedConsultPaidParts(booking);
  const counters = storedConsultRefundCounters(booking);
  const cardPaidCents = Math.max(
    0,
    paid.cardPaidCents -
      counters.cardRefundedToCardCents -
      counters.cardCreditedToWalletCents
  );
  const creditPaidCents = Math.max(
    0,
    paid.creditPaidCents - counters.creditRefundedCents
  );
  return {
    ...counters,
    cardPaidCents,
    creditPaidCents,
    remainingPaidCents: cardPaidCents + creditPaidCents,
  };
}

/** Booking columns to persist after a successful refundConsultSplit. */
export function bookingRefundSettlementPatch(
  booking: Parameters<typeof remainingConsultPaidParts>[0],
  settled: Pick<
    ConsultRefundResult,
    | "cardRefundedToCardCents"
    | "creditRefundCents"
    | "walletCreditCents"
    | "alreadyApplied"
  > & { cardRefundCents?: number },
  options?: { markStatusRefunded?: boolean }
): Record<string, unknown> | null {
  const prior = remainingConsultPaidParts(booking);
  const original = storedConsultPaidParts(booking);
  const originalPaid = original.cardPaidCents + original.creditPaidCents;
  const alreadyCounted =
    prior.cardRefundedToCardCents +
    prior.cardCreditedToWalletCents +
    prior.creditRefundedCents;
  const splitTotal =
    (settled.cardRefundCents ??
      settled.cardRefundedToCardCents +
        Math.max(
          0,
          (settled.walletCreditCents || 0) - (settled.creditRefundCents || 0)
        )) + (settled.creditRefundCents || 0);

  // alreadyApplied means the wallet/Stripe side already ran. Still persist
  // counters when a prior attempt moved money but the booking update failed.
  if (settled.alreadyApplied) {
    if (originalPaid <= 0 || alreadyCounted >= originalPaid) return null;
    if (prior.remainingPaidCents < splitTotal) return null;
  }

  const cardToWallet = Math.max(
    0,
    (settled.walletCreditCents || 0) - (settled.creditRefundCents || 0)
  );
  const nextCardToCard =
    prior.cardRefundedToCardCents + (settled.cardRefundedToCardCents || 0);
  const nextCardToWallet = prior.cardCreditedToWalletCents + cardToWallet;
  const nextCredit = prior.creditRefundedCents + (settled.creditRefundCents || 0);
  const cumulative = nextCardToCard + nextCardToWallet + nextCredit;
  const fullySettled = cumulative >= originalPaid;
  const patch: Record<string, unknown> = {
    card_refunded_to_card_cents: nextCardToCard,
    card_credited_to_wallet_cents: nextCardToWallet,
    credit_refunded_cents: nextCredit,
    refund_amount_cents: cumulative,
  };
  if (fullySettled) {
    patch.refunded_at = new Date().toISOString();
    if (options?.markStatusRefunded) {
      patch.status = "refunded";
    }
  }
  return patch;
}

/**
 * After a cheaper clinic reschedule refund, rebase the booking's paid parts to
 * the new fee so later refunds use remainingConsultPaidParts against the
 * reduced total instead of original-paid counters.
 */
export function cheaperReschedulePaidRebasePatch(input: {
  originalTotalCents: number;
  refundCents: number;
  walletCreditAppliedCents: number;
  settled: Pick<
    ConsultRefundResult,
    "creditRefundCents" | "cardRefundedToCardCents" | "walletCreditCents"
  >;
  priorRefundAmountCents?: number;
}): Record<string, unknown> {
  const newTotal = Math.max(0, input.originalTotalCents - input.refundCents);
  const newCredit = Math.max(
    0,
    Number(input.walletCreditAppliedCents || 0) -
      (input.settled.creditRefundCents || 0)
  );
  const cumulative =
    Math.max(0, Number(input.priorRefundAmountCents || 0)) +
    (input.settled.cardRefundedToCardCents || 0) +
    Math.max(
      0,
      (input.settled.walletCreditCents || 0) -
        (input.settled.creditRefundCents || 0)
    ) +
    (input.settled.creditRefundCents || 0);
  return {
    total_amount_cents: newTotal,
    wallet_credit_applied_cents: Math.min(newCredit, newTotal),
    // Counters reset against the rebased paid parts; cumulative refund history
    // stays on refund_amount_cents for admin display.
    card_refunded_to_card_cents: 0,
    card_credited_to_wallet_cents: 0,
    credit_refunded_cents: 0,
    refund_amount_cents: cumulative,
  };
}

/**
 * A percentage applies to the stored card amount and the stored credit
 * amount separately. An absolute amount is shared in that same ratio.
 */
export function splitConsultRefund(input: {
  cardPaidCents: number;
  creditPaidCents: number;
  refundPercent?: number;
  refundAmountCents?: number;
}): { cardRefundCents: number; creditRefundCents: number } {
  const cardPaid = Math.max(0, Math.round(input.cardPaidCents));
  const creditPaid = Math.max(0, Math.round(input.creditPaidCents));

  if (input.refundAmountCents != null) {
    const paid = cardPaid + creditPaid;
    const amount = Math.max(0, Math.min(Math.round(input.refundAmountCents), paid));
    if (paid === 0 || amount === 0) {
      return { cardRefundCents: 0, creditRefundCents: 0 };
    }
    if (amount >= paid) {
      return { cardRefundCents: cardPaid, creditRefundCents: creditPaid };
    }
    const creditRefundCents = Math.min(
      creditPaid,
      Math.round((creditPaid * amount) / paid)
    );
    let cardRefundCents = amount - creditRefundCents;
    if (cardRefundCents > cardPaid) {
      const overflow = cardRefundCents - cardPaid;
      cardRefundCents = cardPaid;
      return {
        cardRefundCents,
        creditRefundCents: Math.min(creditPaid, creditRefundCents + overflow),
      };
    }
    return { cardRefundCents, creditRefundCents };
  }

  const percent = Math.min(100, Math.max(0, input.refundPercent ?? 0));
  return {
    cardRefundCents: Math.round((cardPaid * percent) / 100),
    creditRefundCents: Math.round((creditPaid * percent) / 100),
  };
}

/**
 * Doctor's destination-charge transfer, scaled like Stripe reverse_transfer.
 * The application fee was never transferred, so it is not part of this amount.
 */
export function proportionalCardTransferClawbackCents(input: {
  transferAmountCents: number;
  cardPaidCents: number;
  cardRefundCents: number;
}): number {
  const transfer = Math.max(0, input.transferAmountCents);
  if (transfer <= 0 || input.cardRefundCents <= 0 || input.cardPaidCents <= 0) {
    return 0;
  }
  if (input.cardRefundCents >= input.cardPaidCents) return transfer;
  const raw = Math.round(
    (transfer * input.cardRefundCents) / input.cardPaidCents
  );
  return Math.min(transfer, Math.max(0, raw));
}

export function consultCardClawbackIdempotencyKey(
  bookingId: string,
  cardRefundCents: number,
  alreadyRefundedCents = 0
): string {
  // Include prior refunded cents so two equal-sized sequential clawbacks
  // do not reuse Stripe's first reversal idempotency key.
  return `wallet-refund-reversal-${bookingId}-${alreadyRefundedCents}-${cardRefundCents}`;
}

export function clinicianReassignmentBlockReason(booking: {
  wallet_credit_applied_cents?: number | null;
}): string | null {
  if (Number(booking.wallet_credit_applied_cents || 0) > 0) {
    return CREDIT_REASSIGNMENT_BLOCKED_MESSAGE;
  }
  return null;
}

export interface ConsultRefundWallet {
  findApplied(description: string): Promise<boolean>;
  credit(input: {
    patientId: string;
    currency: string;
    amountCents: number;
    sourceType: WalletSourceType;
    sourceBookingId: string;
    description: string;
  }): Promise<void>;
}

export interface CardClawbackInput {
  paymentIntentId: string | null;
  bookingId: string;
  cardPaidCents: number;
  cardRefundCents: number;
  idempotencyKey: string;
  /** bookings.stripe_destination_transfer_id when present. */
  destinationTransferId?: string | null;
}

export interface CardClawbackResult {
  reversalId: string | null;
  reversedCents: number;
  transferFound: boolean;
}

export interface ConsultRefundDeps extends WalletCreditDeps {
  wallet?: ConsultRefundWallet;
  clawbackCardShare?: (input: CardClawbackInput) => Promise<CardClawbackResult>;
  findTransfer?: typeof findDestinationTransfer;
  reverseTransfer?: typeof reverseConnectTransfer;
  retrieveTransfer?: (
    id: string
  ) => Promise<{ id: string; amount: number; currency: string } | null>;
}

function refundCreditDescription(input: {
  bookingId: string;
  bookingNumber?: string;
  sourceType: string;
  destination: ConsultRefundDestination;
  cardToWalletCents: number;
  cardToStripeCents: number;
  creditRefundCents: number;
  alreadyRefundedCents: number;
}): string {
  const ref = input.bookingNumber || input.bookingId;
  // Include Stripe card amount and prior refunded total so two different
  // refunds with the same credit slice do not collide, and so sequential
  // equal-shaped partials stay distinct.
  return `Consult refund ${ref} [${input.sourceType}:${input.destination}:stripe ${input.cardToStripeCents}:wallet-card ${input.cardToWalletCents}:credit ${input.creditRefundCents}:prior ${input.alreadyRefundedCents}]`;
}

function defaultWallet(): ConsultRefundWallet {
  return {
    async findApplied(description) {
      const supabase = createAdminClient();
      const { data, error } = await supabase
        .from("wallet_transactions")
        .select("id")
        .eq("type", "credit")
        .eq("description", description)
        .limit(1);
      if (error) throw new Error(error.message);
      return Boolean(data && data.length > 0);
    },
    async credit(input) {
      await creditWallet(input);
    },
  };
}

export async function clawbackCardDestinationShare(
  input: CardClawbackInput,
  deps?: Pick<
    ConsultRefundDeps,
    "findTransfer" | "reverseTransfer" | "retrieveTransfer" | "stripe"
  >
): Promise<CardClawbackResult> {
  const find = deps?.findTransfer ?? findDestinationTransfer;
  const reverse = deps?.reverseTransfer ?? reverseConnectTransfer;
  const found = await resolveDestinationTransfer({
    paymentIntentId: input.paymentIntentId,
    storedTransferId: input.destinationTransferId,
    retrieveTransfer: deps?.retrieveTransfer,
    findTransfer: find,
  });
  if (!found) {
    return { reversalId: null, reversedCents: 0, transferFound: false };
  }
  const amount = proportionalCardTransferClawbackCents({
    transferAmountCents: found.amount,
    cardPaidCents: input.cardPaidCents,
    cardRefundCents: input.cardRefundCents,
  });
  if (amount <= 0) {
    return { reversalId: null, reversedCents: 0, transferFound: true };
  }
  // charge.transfer is the doctor's net. Reversing it leaves the application
  // fee on the platform, which funds the wallet credit.
  const reversal = await reverse({
    transferId: found.transferId,
    amountCents: amount,
    idempotencyKey: input.idempotencyKey,
    metadata: {
      booking_id: input.bookingId,
      kind: "consult_card_wallet_clawback",
    },
    stripe: deps?.stripe,
  });
  return {
    reversalId: reversal.reversalId,
    reversedCents: amount,
    transferFound: true,
  };
}

export interface ConsultRefundResult {
  cardRefundCents: number;
  creditRefundCents: number;
  walletCreditCents: number;
  cardRefundedToCardCents: number;
  cardRefundId: string | null;
  reversedCents: number;
  cardClawbackCents: number;
  alreadyApplied: boolean;
}

/**
 * Return one consult payment. Safe to call again with the same split:
 * Stripe refunds and transfer reversals reuse idempotency keys, and the
 * wallet credit is written once for this description.
 */
export async function refundConsultSplit(
  input: {
    bookingId: string;
    bookingNumber?: string;
    patientId: string;
    currency: string;
    destination: ConsultRefundDestination;
    paymentIntentId: string | null;
    cardPaidCents: number;
    creditPaidCents: number;
    refundPercent?: number;
    refundAmountCents?: number;
    /** Cumulative patient-facing refund already settled on this booking. */
    alreadyRefundedCents?: number;
    sourceType?: Extract<WalletSourceType, "refund" | "cancel_rebook">;
    stripeChargeId?: string | null;
    stripeDestinationTransferId?: string | null;
  },
  deps?: ConsultRefundDeps
): Promise<ConsultRefundResult> {
  const sourceType = input.sourceType ?? "refund";
  const alreadyRefundedCents = Math.max(0, Math.round(input.alreadyRefundedCents || 0));
  const split = splitConsultRefund({
    cardPaidCents: input.cardPaidCents,
    creditPaidCents: input.creditPaidCents,
    refundPercent: input.refundPercent,
    refundAmountCents: input.refundAmountCents,
  });

  // Card money goes to the wallet only when the patient chose that. Otherwise
  // it is a Stripe refund. Never both.
  const cardToWalletCents =
    input.destination === "wallet" ? split.cardRefundCents : 0;
  const cardToStripeCents =
    input.destination === "bank" ? split.cardRefundCents : 0;
  const walletCreditCents = split.creditRefundCents + cardToWalletCents;

  const empty: ConsultRefundResult = {
    cardRefundCents: split.cardRefundCents,
    creditRefundCents: split.creditRefundCents,
    walletCreditCents,
    cardRefundedToCardCents: cardToStripeCents,
    cardRefundId: null,
    reversedCents: 0,
    cardClawbackCents: 0,
    alreadyApplied: false,
  };

  if (split.cardRefundCents <= 0 && split.creditRefundCents <= 0) {
    return empty;
  }

  const description = refundCreditDescription({
    bookingId: input.bookingId,
    bookingNumber: input.bookingNumber,
    sourceType,
    destination: input.destination,
    cardToWalletCents,
    cardToStripeCents,
    creditRefundCents: split.creditRefundCents,
    alreadyRefundedCents,
  });
  const wallet = deps?.wallet ?? defaultWallet();

  if (walletCreditCents > 0 && (await wallet.findApplied(description))) {
    return { ...empty, alreadyApplied: true };
  }

  if (
    cardToStripeCents > 0 &&
    !input.paymentIntentId &&
    !input.stripeChargeId
  ) {
    throw new Error("This card payment has no payment intent to refund");
  }

  // creditPaidCents is the credit still outstanding (callers pass the
  // remainder). The doctor reversal scales against the transfer row's
  // original credit_amount_cents, then caps at the unreversed transfer.
  const settled = await refundConsultCardAndCreditShare(
    {
      paymentIntentId: cardToStripeCents > 0 ? input.paymentIntentId : null,
      stripeChargeId: cardToStripeCents > 0 ? input.stripeChargeId : null,
      cardRefundCents: cardToStripeCents,
      bookingId: input.bookingId,
      refundedCreditCents: split.creditRefundCents,
      creditOutstandingCents: input.creditPaidCents,
      alreadyRefundedCents,
    },
    deps
  );

  let cardClawbackCents = 0;
  if (cardToWalletCents > 0) {
    if (!input.paymentIntentId && !input.stripeDestinationTransferId) {
      throw new Error("This card payment has no payment intent to recover");
    }
    const clawback =
      deps?.clawbackCardShare ??
      ((clawbackInput: CardClawbackInput) =>
        clawbackCardDestinationShare(clawbackInput, deps));
    const clawed = await clawback({
      paymentIntentId: input.paymentIntentId,
      bookingId: input.bookingId,
      cardPaidCents: input.cardPaidCents,
      cardRefundCents: cardToWalletCents,
      destinationTransferId: input.stripeDestinationTransferId,
      idempotencyKey: consultCardClawbackIdempotencyKey(
        input.bookingId,
        cardToWalletCents,
        alreadyRefundedCents
      ),
    });
    if (!clawed.transferFound) {
      throw new Error(
        "Could not recover the doctor's card share for this wallet refund"
      );
    }
    cardClawbackCents = clawed.reversedCents;
  }

  if (walletCreditCents > 0) {
    const already = await wallet.findApplied(description);
    if (!already) {
      await wallet.credit({
        patientId: input.patientId,
        currency: input.currency,
        amountCents: walletCreditCents,
        sourceType,
        sourceBookingId: input.bookingId,
        description,
      });
    }
  }

  return {
    ...empty,
    cardRefundId: settled.cardRefundId,
    reversedCents: settled.reversedCents,
    cardClawbackCents,
    alreadyApplied: false,
  };
}

export async function refundClinicCancellation(
  booking: {
    id: string;
    booking_number?: string | null;
    patient_id: string;
    currency: string;
    stripe_payment_intent_id?: string | null;
    stripe_charge_id?: string | null;
    stripe_destination_transfer_id?: string | null;
    payment_mode?: string | null;
    deposit_amount_cents?: number | null;
    total_amount_cents?: number | null;
    wallet_credit_applied_cents?: number | null;
    paid_at?: string | null;
    refund_amount_cents?: number | null;
    card_refunded_to_card_cents?: number | null;
    card_credited_to_wallet_cents?: number | null;
    credit_refunded_cents?: number | null;
  } & ConsultReschedulePaidFields,
  deps?: ConsultRefundDeps
): Promise<
  ConsultRefundResult & {
    refundAmountCents: number;
    settlementPatch: Record<string, unknown> | null;
  }
> {
  const remaining = remainingConsultPaidParts(booking);
  if (!booking.paid_at || remaining.remainingPaidCents <= 0) {
    return {
      cardRefundCents: 0,
      creditRefundCents: 0,
      walletCreditCents: 0,
      cardRefundedToCardCents: 0,
      cardRefundId: null,
      reversedCents: 0,
      cardClawbackCents: 0,
      alreadyApplied: false,
      refundAmountCents: 0,
      settlementPatch: null,
    };
  }
  const settled = await refundConsultSplit(
    {
      bookingId: booking.id,
      bookingNumber: booking.booking_number || undefined,
      patientId: booking.patient_id,
      currency: booking.currency,
      destination: "bank",
      paymentIntentId: booking.stripe_payment_intent_id || null,
      stripeChargeId: booking.stripe_charge_id,
      stripeDestinationTransferId: booking.stripe_destination_transfer_id,
      cardPaidCents: remaining.cardPaidCents,
      creditPaidCents: remaining.creditPaidCents,
      refundPercent: 100,
      alreadyRefundedCents: Number(booking.refund_amount_cents || 0),
      sourceType: "refund",
    },
    deps
  );
  return {
    ...settled,
    refundAmountCents: settled.cardRefundedToCardCents + settled.walletCreditCents,
    settlementPatch: bookingRefundSettlementPatch(booking, settled),
  };
}

export async function refundAdminBookingPayment(
  booking: {
    id: string;
    booking_number?: string | null;
    patient_id: string;
    currency: string;
    stripe_payment_intent_id?: string | null;
    stripe_charge_id?: string | null;
    stripe_destination_transfer_id?: string | null;
    payment_mode?: string | null;
    deposit_amount_cents?: number | null;
    total_amount_cents?: number | null;
    wallet_credit_applied_cents?: number | null;
    paid_at?: string | null;
    refunded_at?: string | null;
    refund_amount_cents?: number | null;
    card_refunded_to_card_cents?: number | null;
    card_credited_to_wallet_cents?: number | null;
    credit_refunded_cents?: number | null;
  } & ConsultReschedulePaidFields,
  amountCents?: number,
  deps?: ConsultRefundDeps
): Promise<
  | { error: string }
  | (ConsultRefundResult & {
      refundAmountCents: number;
      settlementPatch: Record<string, unknown>;
    })
> {
  const remaining = remainingConsultPaidParts(booking);
  const original = storedConsultPaidParts(booking);
  if (!booking.paid_at || original.cardPaidCents + original.creditPaidCents <= 0) {
    return { error: "Booking has not been paid" };
  }
  if (remaining.remainingPaidCents <= 0 || booking.refunded_at) {
    return { error: "Booking has already been refunded" };
  }
  const refundAmount = amountCents ?? remaining.remainingPaidCents;
  if (refundAmount <= 0 || refundAmount > remaining.remainingPaidCents) {
    return { error: "Invalid refund amount" };
  }
  try {
    const settled = await refundConsultSplit(
      {
        bookingId: booking.id,
        bookingNumber: booking.booking_number || undefined,
        patientId: booking.patient_id,
        currency: booking.currency,
        destination: "bank",
        paymentIntentId: booking.stripe_payment_intent_id || null,
        stripeChargeId: booking.stripe_charge_id,
        stripeDestinationTransferId: booking.stripe_destination_transfer_id,
        // Split against remaining unsettled parts so prior wallet clawbacks
        // are not Stripe-refunded again.
        cardPaidCents: remaining.cardPaidCents,
        creditPaidCents: remaining.creditPaidCents,
        refundAmountCents: refundAmount,
        alreadyRefundedCents: Number(booking.refund_amount_cents || 0),
        sourceType: "refund",
      },
      deps
    );
    if (settled.alreadyApplied) {
      return { error: "Booking has already been refunded" };
    }
    const settlementPatch = bookingRefundSettlementPatch(booking, settled, {
      markStatusRefunded: true,
    });
    if (!settlementPatch) {
      return { error: "Booking has already been refunded" };
    }
    const refundAmountCents =
      settled.cardRefundedToCardCents + settled.walletCreditCents;
    return {
      ...settled,
      refundAmountCents,
      settlementPatch,
    };
  } catch (err) {
    log.error("[consult-refund] admin refund failed", { err, bookingId: booking.id });
    const message = err instanceof Error ? err.message : "Refund failed";
    return { error: message };
  }
}
