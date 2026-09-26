/**
 * Doctor share of a consult paid with MyDoctors360 wallet or gift-card credit.
 *
 * Card portion: destination charge, application fee = 15% of the card amount.
 * Credit portion: (credit − 15%) is a Transfer from the platform balance.
 * bookings.commission_cents is 15% of the card plus 15% of the credit.
 */

import { createAdminClient } from "@/lib/supabase/admin";
import { debitWallet } from "@/lib/wallet";
import { getCommissionCents } from "@/lib/utils/currency";
import { log } from "@/lib/utils/logger";
import { getStripe } from "@/lib/stripe/client";
import {
  DOCTOR_CARD_PAYMENTS_UNAVAILABLE_MESSAGE,
  doctorCanReceiveConsultCreditPayment,
} from "@/lib/stripe/consult-merchant";
import {
  createConnectTransfer,
  reverseConnectTransfer,
  type ConnectTransferClient,
} from "@/lib/stripe/transfer-handoff";

export const WALLET_CREDIT_SHARE_KIND = "wallet_credit_share";

/** Activity statements read this line off the transfer row. */
export const PAID_WITH_WALLET_CREDIT_LINE = "Paid with MyDoctors360 credit";

export const WALLET_CREDIT_PAYOUT_FAILED_MESSAGE =
  "We couldn't pay this doctor just now. Please try again.";

const CREDIT_DEBIT_FAILED_MESSAGE =
  "We couldn't apply your MyDoctors360 credit. Please try again.";

export function walletCreditShareIdempotencyKey(bookingId: string): string {
  return `wallet-credit-share-${bookingId}`;
}

export function walletCreditTransferGroup(bookingId: string): string {
  return `booking_${bookingId}`;
}

export function walletCreditReversalIdempotencyKey(
  bookingId: string,
  alreadyReversedCents: number,
  reversalCents: number
): string {
  return `wallet-credit-reversal-${bookingId}-${alreadyReversedCents}-${reversalCents}`;
}

export interface ConsultCheckoutMoney {
  cardCents: number;
  creditCents: number;
  cardCommissionCents: number;
  creditCommissionCents: number;
  /** Stripe application_fee_amount. 15% of the card only when credit is used. */
  applicationFeeCents: number;
  /** Whole-booking commission stored on bookings.commission_cents. */
  commissionCents: number;
  /** Credit minus 15%, sent as a platform transfer. */
  doctorCreditShareCents: number;
}

/**
 * Split a consult charge into card and MyDoctors360 credit.
 * With no credit, the application fee stays the historical deposit rule:
 * 15% of the consultation fee, capped at the amount Stripe will charge.
 */
export function consultCheckoutMoney(input: {
  consultationFeeCents: number;
  stripeChargeCents: number;
  walletCreditCents: number;
}): ConsultCheckoutMoney {
  const creditCents = Math.max(
    0,
    Math.min(input.walletCreditCents, input.stripeChargeCents)
  );
  const cardCents = input.stripeChargeCents - creditCents;
  const cardCommissionCents = getCommissionCents(cardCents);
  const creditCommissionCents = getCommissionCents(creditCents);
  const consultationCommission = getCommissionCents(input.consultationFeeCents);
  const baselineFee = Math.min(consultationCommission, input.stripeChargeCents);

  return {
    cardCents,
    creditCents,
    cardCommissionCents,
    creditCommissionCents,
    applicationFeeCents: creditCents > 0 ? cardCommissionCents : baselineFee,
    commissionCents:
      creditCents > 0
        ? cardCommissionCents + creditCommissionCents
        : consultationCommission,
    doctorCreditShareCents: Math.max(0, creditCents - creditCommissionCents),
  };
}

export function walletCreditDoctorShare(creditAmountCents: number): {
  creditAmountCents: number;
  commissionCents: number;
  amountCents: number;
} {
  const commissionCents = getCommissionCents(creditAmountCents);
  return {
    creditAmountCents,
    commissionCents,
    amountCents: Math.max(0, creditAmountCents - commissionCents),
  };
}

export function proportionalCreditTransferReversalCents(input: {
  transferAmountCents: number;
  alreadyReversedCents: number;
  refundAmountCents: number;
  paidAmountCents: number;
}): number {
  const remaining = Math.max(
    0,
    input.transferAmountCents - input.alreadyReversedCents
  );
  if (
    remaining <= 0 ||
    input.refundAmountCents <= 0 ||
    input.paidAmountCents <= 0
  ) {
    return 0;
  }
  if (input.refundAmountCents >= input.paidAmountCents) return remaining;
  const raw = Math.round(
    (input.transferAmountCents * input.refundAmountCents) / input.paidAmountCents
  );
  return Math.min(remaining, Math.max(0, raw));
}

export type WalletCreditTransferStatus =
  | "paid"
  | "reversed"
  | "partially_reversed";

export interface WalletCreditTransferRecord {
  id: string;
  booking_id: string;
  doctor_id: string;
  amount_cents: number;
  credit_amount_cents: number;
  commission_cents: number;
  stripe_transfer_id: string | null;
  status: WalletCreditTransferStatus;
  statement_line: string;
  currency: string;
  reversed_cents: number;
  kind: string;
  created_at: string;
}

export interface WalletCreditTransferStore {
  findByBookingId(
    bookingId: string
  ): Promise<WalletCreditTransferRecord | null>;
  insert(
    row: Omit<WalletCreditTransferRecord, "id" | "created_at">
  ): Promise<WalletCreditTransferRecord>;
  update(
    bookingId: string,
    patch: Partial<
      Pick<
        WalletCreditTransferRecord,
        "status" | "reversed_cents" | "stripe_transfer_id"
      >
    >
  ): Promise<void>;
}

export interface WalletCreditDeps {
  stripe?: ConnectTransferClient & {
    refunds?: {
      create(params: {
        payment_intent: string;
        amount: number;
        reverse_transfer: boolean;
        refund_application_fee: boolean;
      }): Promise<{ id: string }>;
    };
  };
  store?: WalletCreditTransferStore;
  alreadyDebited?: (bookingId: string) => Promise<boolean>;
  debit?: () => Promise<void>;
}

const TABLE = "doctor_wallet_credit_transfers";

async function findWalletCreditTransfer(
  bookingId: string
): Promise<WalletCreditTransferRecord | null> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from(TABLE)
    .select("*")
    .eq("booking_id", bookingId)
    .maybeSingle();
  if (error) {
    if (error.code === "42P01" || error.code === "PGRST205") {
      log.error("[wallet-credit] transfer table unavailable", {
        code: error.code,
        message: error.message,
      });
      return null;
    }
    throw new Error(error.message);
  }
  return (data as WalletCreditTransferRecord | null) ?? null;
}

function supabaseStore(): WalletCreditTransferStore {
  const supabase = createAdminClient();
  return {
    findByBookingId: findWalletCreditTransfer,
    async insert(row) {
      const { data, error } = await supabase
        .from(TABLE)
        .insert(row)
        .select("*")
        .single();
      if (error) {
        if (error.code === "23505") {
          const existing = await findWalletCreditTransfer(row.booking_id);
          if (existing) return existing;
        }
        throw new Error(error.message);
      }
      return data as WalletCreditTransferRecord;
    },
    async update(bookingId, patch) {
      const { error } = await supabase.from(TABLE).update(patch).eq("booking_id", bookingId);
      if (error) throw new Error(error.message);
    },
  };
}

function storeOf(deps?: WalletCreditDeps): WalletCreditTransferStore {
  return deps?.store ?? supabaseStore();
}

function transferClient(deps?: WalletCreditDeps): ConnectTransferClient {
  return deps?.stripe ?? (getStripe() as unknown as ConnectTransferClient);
}

export interface PayDoctorWalletCreditInput {
  bookingId: string;
  bookingNumber: string;
  doctorId: string;
  stripeAccountId: string;
  currency: string;
  creditAmountCents: number;
  commissionCents: number;
  amountCents: number;
}

/**
 * Transfer the doctor's share of wallet credit once per booking.
 * A second call returns the existing Stripe transfer and does not pay again.
 */
export async function payDoctorWalletCreditShare(
  input: PayDoctorWalletCreditInput,
  deps?: WalletCreditDeps
): Promise<
  | { ok: true; transferId: string; alreadyPaid: boolean }
  | { ok: false; error: string }
> {
  if (!input.stripeAccountId) {
    return { ok: false, error: DOCTOR_CARD_PAYMENTS_UNAVAILABLE_MESSAGE };
  }
  if (input.creditAmountCents <= 0 || input.amountCents <= 0) {
    return { ok: false, error: WALLET_CREDIT_PAYOUT_FAILED_MESSAGE };
  }
  if (input.amountCents + input.commissionCents !== input.creditAmountCents) {
    return { ok: false, error: WALLET_CREDIT_PAYOUT_FAILED_MESSAGE };
  }

  const store = storeOf(deps);
  try {
    const existing = await store.findByBookingId(input.bookingId);
    if (
      existing?.stripe_transfer_id &&
      (existing.status === "paid" ||
        existing.status === "partially_reversed" ||
        existing.status === "reversed")
    ) {
      return {
        ok: true,
        transferId: existing.stripe_transfer_id,
        alreadyPaid: true,
      };
    }

    const created = await createConnectTransfer({
      amountCents: input.amountCents,
      currency: input.currency,
      destinationAccountId: input.stripeAccountId,
      transferGroup: walletCreditTransferGroup(input.bookingId),
      idempotencyKey: walletCreditShareIdempotencyKey(input.bookingId),
      metadata: {
        booking_id: input.bookingId,
        booking_number: input.bookingNumber,
        credit_amount_cents: String(input.creditAmountCents),
        commission_cents: String(input.commissionCents),
        kind: WALLET_CREDIT_SHARE_KIND,
      },
      stripe: transferClient(deps),
    });

    try {
      await store.insert({
        booking_id: input.bookingId,
        doctor_id: input.doctorId,
        amount_cents: input.amountCents,
        credit_amount_cents: input.creditAmountCents,
        commission_cents: input.commissionCents,
        stripe_transfer_id: created.transferId,
        status: "paid",
        statement_line: PAID_WITH_WALLET_CREDIT_LINE,
        currency: input.currency.toUpperCase(),
        reversed_cents: 0,
        kind: WALLET_CREDIT_SHARE_KIND,
      });
    } catch (insertErr) {
      const again = await store.findByBookingId(input.bookingId);
      if (again?.stripe_transfer_id) {
        return {
          ok: true,
          transferId: again.stripe_transfer_id,
          alreadyPaid: true,
        };
      }
      throw insertErr;
    }

    return { ok: true, transferId: created.transferId, alreadyPaid: false };
  } catch (err) {
    log.error("[wallet-credit] doctor share transfer failed", {
      err,
      bookingId: input.bookingId,
    });
    return { ok: false, error: WALLET_CREDIT_PAYOUT_FAILED_MESSAGE };
  }
}

async function bookingWalletAlreadyDebited(bookingId: string): Promise<boolean> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("wallet_transactions")
    .select("id")
    .eq("target_booking_id", bookingId)
    .eq("type", "debit")
    .limit(1);
  if (error) throw new Error(error.message);
  return Boolean(data && data.length > 0);
}

/**
 * After the card payment succeeds: take the wallet credit once, then
 * transfer the doctor's share. Safe to run again for the same booking.
 */
export async function settlePartCreditAfterCardPayment(
  input: {
    patientId: string;
    currency: string;
    bookingId: string;
    bookingNumber: string;
    doctorId: string;
    stripeAccountId: string;
    creditAmountCents: number;
    description: string;
  },
  deps?: WalletCreditDeps
): Promise<{ transferId: string; alreadyPaid: boolean }> {
  if (!input.stripeAccountId) {
    throw new Error(DOCTOR_CARD_PAYMENTS_UNAVAILABLE_MESSAGE);
  }
  const already = deps?.alreadyDebited
    ? await deps.alreadyDebited(input.bookingId)
    : await bookingWalletAlreadyDebited(input.bookingId);
  if (!already) {
    if (deps?.debit) {
      await deps.debit();
    } else {
      await debitWallet({
        patientId: input.patientId,
        currency: input.currency,
        amountCents: input.creditAmountCents,
        sourceType: "refund",
        targetBookingId: input.bookingId,
        description: input.description,
      });
    }
  }

  const share = walletCreditDoctorShare(input.creditAmountCents);
  const paid = await payDoctorWalletCreditShare(
    {
      bookingId: input.bookingId,
      bookingNumber: input.bookingNumber,
      doctorId: input.doctorId,
      stripeAccountId: input.stripeAccountId,
      currency: input.currency,
      creditAmountCents: share.creditAmountCents,
      commissionCents: share.commissionCents,
      amountCents: share.amountCents,
    },
    deps
  );
  if (!paid.ok) throw new Error(paid.error);
  return { transferId: paid.transferId, alreadyPaid: paid.alreadyPaid };
}

type AccountsClient = Parameters<typeof doctorCanReceiveConsultCreditPayment>[0];

/**
 * Full-credit confirm path. Refuses before any wallet debit when the
 * doctor cannot be paid. Transfers first; a failed debit reverses it
 * and does not confirm.
 */
export async function runFullCreditSettlement(
  input: {
    stripeAccountId: string | null | undefined;
    accounts: AccountsClient;
    credit: Omit<PayDoctorWalletCreditInput, "stripeAccountId">;
    debit: () => Promise<void>;
  },
  deps?: WalletCreditDeps
): Promise<
  | { ok: true; transferId: string; alreadyPaid: boolean }
  | { ok: false; error: string }
> {
  if (!input.stripeAccountId) {
    return { ok: false, error: DOCTOR_CARD_PAYMENTS_UNAVAILABLE_MESSAGE };
  }
  const gate = await doctorCanReceiveConsultCreditPayment(
    input.accounts,
    input.stripeAccountId
  );
  if (!gate.ok) return gate;

  const paid = await payDoctorWalletCreditShare(
    { ...input.credit, stripeAccountId: input.stripeAccountId },
    deps
  );
  if (!paid.ok) return paid;

  try {
    await input.debit();
  } catch (err) {
    log.error("[wallet-credit] debit failed after doctor transfer", {
      err,
      bookingId: input.credit.bookingId,
    });
    await reverseDoctorWalletCreditShare(
      {
        bookingId: input.credit.bookingId,
        refundAmountCents: input.credit.creditAmountCents,
        paidAmountCents: input.credit.creditAmountCents,
      },
      deps
    ).catch((reverseErr) => {
      log.error("[wallet-credit] could not reverse transfer after debit failure", {
        err: reverseErr,
        bookingId: input.credit.bookingId,
      });
    });
    return { ok: false, error: CREDIT_DEBIT_FAILED_MESSAGE };
  }

  return {
    ok: true,
    transferId: paid.transferId,
    alreadyPaid: paid.alreadyPaid,
  };
}

/**
 * Reverse the credit-share transfer in proportion to the patient refund.
 * No row means this booking did not pay the doctor from wallet credit.
 */
export async function reverseDoctorWalletCreditShare(
  input: {
    bookingId: string;
    refundAmountCents: number;
    paidAmountCents: number;
  },
  deps?: WalletCreditDeps
): Promise<{ reversedCents: number; reversalId?: string }> {
  const store = storeOf(deps);
  let record: WalletCreditTransferRecord | null = null;
  try {
    record = await store.findByBookingId(input.bookingId);
  } catch (err) {
    log.error("[wallet-credit] could not load transfer for reversal", {
      err,
      bookingId: input.bookingId,
    });
    return { reversedCents: 0 };
  }
  if (!record?.stripe_transfer_id) return { reversedCents: 0 };

  const reversalCents = proportionalCreditTransferReversalCents({
    transferAmountCents: record.amount_cents,
    alreadyReversedCents: record.reversed_cents || 0,
    refundAmountCents: input.refundAmountCents,
    paidAmountCents: input.paidAmountCents,
  });
  if (reversalCents <= 0) return { reversedCents: 0 };

  const reversal = await reverseConnectTransfer({
    transferId: record.stripe_transfer_id,
    amountCents: reversalCents,
    metadata: {
      booking_id: input.bookingId,
      kind: "wallet_credit_share_reversal",
      credit_amount_cents: String(record.credit_amount_cents),
      commission_cents: String(record.commission_cents),
    },
    idempotencyKey: walletCreditReversalIdempotencyKey(
      input.bookingId,
      record.reversed_cents || 0,
      reversalCents
    ),
    stripe: transferClient(deps),
  });

  const reversedCents = (record.reversed_cents || 0) + reversalCents;
  const status: WalletCreditTransferStatus =
    reversedCents >= record.amount_cents ? "reversed" : "partially_reversed";
  await store.update(input.bookingId, {
    reversed_cents: reversedCents,
    status,
  });

  return { reversedCents: reversalCents, reversalId: reversal.reversalId };
}

/**
 * Refund the card charge (destination reversal + application fee) and
 * reverse the wallet-credit transfer. Card-only bookings have no transfer row.
 */
export async function refundConsultCardAndCreditShare(
  input: {
    paymentIntentId: string | null;
    cardRefundCents: number;
    bookingId: string;
    refundAmountCents: number;
    paidAmountCents: number;
  },
  deps?: WalletCreditDeps
): Promise<{ cardRefundId: string | null; reversedCents: number }> {
  let cardRefundId: string | null = null;
  if (input.paymentIntentId && input.cardRefundCents > 0) {
    const stripe =
      deps?.stripe ??
      (getStripe() as unknown as NonNullable<WalletCreditDeps["stripe"]>);
    if (!stripe.refunds) {
      throw new Error("Stripe refunds client is not available");
    }
    const refund = await stripe.refunds.create({
      payment_intent: input.paymentIntentId,
      amount: input.cardRefundCents,
      reverse_transfer: true,
      refund_application_fee: true,
    });
    cardRefundId = refund.id;
  }

  const reversed = await reverseDoctorWalletCreditShare(
    {
      bookingId: input.bookingId,
      refundAmountCents: input.refundAmountCents,
      paidAmountCents: input.paidAmountCents,
    },
    deps
  );

  return { cardRefundId, reversedCents: reversed.reversedCents };
}
