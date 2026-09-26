import { createAdminClient } from "@/lib/supabase/admin";
import { getStripe } from "@/lib/stripe/client";
import { getCommissionCents } from "@/lib/utils/currency";
import { log } from "@/lib/utils/logger";
import {
  CLINIC_CANCEL_STATUS,
  DOCTOR_CHANGE_RESCHEDULE_MESSAGE,
} from "@/lib/booking/reschedule-copy";

export { CLINIC_CANCEL_STATUS, DOCTOR_CHANGE_RESCHEDULE_MESSAGE };

/**
 * Any move to a different clinician is refused before a refund, slot
 * update, or charge, whatever the price. The original transfer is not
 * moved. Same-doctor reschedules continue. Price is ignored.
 * Returns null when the doctor is unchanged.
 */
export function rescheduleDoctorChangeError(
  originalDoctorId: string | null | undefined,
  newDoctorId: string | null | undefined,
  _priceDiffCents?: number
): string | null {
  void _priceDiffCents;
  if (
    originalDoctorId &&
    newDoctorId &&
    originalDoctorId === newDoctorId
  ) {
    return null;
  }
  return DOCTOR_CHANGE_RESCHEDULE_MESSAGE;
}

/** A paid -R row is not rescheduled onto a third PaymentIntent. */
export const DEARER_CHAIN_RESCHEDULE_MESSAGE =
  "This booking already has a paid reschedule balance. Cancel it and rebook instead of moving it to a dearer slot.";

export function dearerChainRescheduleError(
  booking: Pick<
    RescheduleRefundBooking,
    "rescheduled_from_booking_id" | "reschedule_payment_status"
  >
): string | null {
  if (isPaidRescheduleSuccessor(booking)) return DEARER_CHAIN_RESCHEDULE_MESSAGE;
  return null;
}

/**
 * Platform fee on the price difference, at the original booking's
 * commission rate. When the original row did not store a commission,
 * fall back to the current platform rate (`getCommissionCents`).
 * The fee is capped at the difference so Stripe will accept it.
 */
export function rescheduleBalanceApplicationFeeCents(input: {
  priceDiffCents: number;
  originalCommissionCents: number;
  originalFeeBasisCents: number;
}): number {
  const diff = Math.max(0, Math.round(input.priceDiffCents));
  if (diff === 0) return 0;

  const basis = Math.max(0, Math.round(input.originalFeeBasisCents));
  const commission = Math.max(0, Math.round(input.originalCommissionCents));
  if (basis > 0 && commission > 0) {
    return Math.min(diff, Math.round((diff * commission) / basis));
  }
  return Math.min(diff, getCommissionCents(diff));
}

/**
 * A paid -R row with no stored commission is the old platform balance:
 * there is no transfer and no application fee to reverse. Every other
 * charge, including an original booking whose commission was never
 * stored, still reverses. That is the same split the activity statement
 * uses.
 */
export function refundReversesTransfer(booking: {
  commission_cents?: number | null;
  commissionCents?: number | null;
  rescheduled_from_booking_id?: string | null;
  rescheduledFromBookingId?: string | null;
  reschedule_payment_status?: string | null;
  reschedulePaymentStatus?: string | null;
}): boolean {
  const commission = nonNegCents(
    booking.commission_cents ?? booking.commissionCents
  );
  const from = (
    booking.rescheduled_from_booking_id ??
    booking.rescheduledFromBookingId ??
    ""
  ).trim();
  const status =
    booking.reschedule_payment_status ??
    booking.reschedulePaymentStatus ??
    null;
  const legacyBalance = Boolean(from) && status === "paid" && commission <= 0;
  return !legacyBalance;
}

export function refundIdempotencyKey(input: {
  bookingId: string;
  paymentIntentId: string;
  amountCents: number;
  reason: string;
}): string {
  return [
    "refund",
    input.bookingId,
    input.paymentIntentId,
    String(Math.max(0, Math.round(input.amountCents))),
    input.reason,
  ].join(":");
}

export function rescheduleBalanceIdempotencyKey(input: {
  bookingId: string;
  priceDiffCents: number;
  startTime: string;
}): string {
  return `reschedule_balance:${input.bookingId}:${input.priceDiffCents}:${input.startTime}`;
}

export function addedRefundCents(
  existingCents: number | null | undefined,
  addedCents: number
): number {
  return nonNegCents(existingCents) + nonNegCents(addedCents);
}

/**
 * Commission rate of the first booking in a reschedule chain.
 * `chainNewestFirst` starts at the row being moved and ends at the root.
 */
export function rootCommissionFromChain(
  chainNewestFirst: Array<{
    commissionCents: number;
    feeBasisCents: number;
    rescheduledFromBookingId?: string | null;
  }>
): { commissionCents: number; feeBasisCents: number } {
  const root =
    [...chainNewestFirst]
      .reverse()
      .find((row) => !(row.rescheduledFromBookingId ?? "").trim()) ??
    chainNewestFirst[chainNewestFirst.length - 1];
  return {
    commissionCents: nonNegCents(root?.commissionCents),
    feeBasisCents: nonNegCents(root?.feeBasisCents),
  };
}

/**
 * Fee stored on a -R row. A row created before the fee was written
 * (commission still 0) uses the original booking's rate, else 15%.
 */
export function balanceFeeToRecord(input: {
  storedCommissionCents: number | null | undefined;
  priceDiffCents: number;
  originalCommissionCents: number;
  originalFeeBasisCents: number;
}): number {
  const diff = nonNegCents(input.priceDiffCents);
  const stored = nonNegCents(input.storedCommissionCents);
  if (stored > 0) return diff > 0 ? Math.min(stored, diff) : stored;
  return rescheduleBalanceApplicationFeeCents({
    priceDiffCents: diff,
    originalCommissionCents: input.originalCommissionCents,
    originalFeeBasisCents: input.originalFeeBasisCents,
  });
}

const ACTIVE_ORIGINAL_STATUSES = new Set([
  "confirmed",
  "approved",
  "pending_approval",
  "pending_payment",
  "pending_reschedule_payment",
]);

/**
 * What to do when a reschedule-balance PaymentIntent succeeds.
 * A replay of an already confirmed -R does nothing. A payment that
 * arrives after the original was cancelled is refunded.
 */
export function rescheduleBalanceSuccessAction(input: {
  newStatus: string | null | undefined;
  originalStatus: string | null | undefined;
  balanceRefundedAt?: string | null;
}): "confirm" | "replay" | "refund_orphan" {
  if (input.newStatus === "confirmed") return "replay";
  if (input.balanceRefundedAt) return "replay";
  const pending = input.newStatus === "pending_reschedule_payment";
  const originalActive = ACTIVE_ORIGINAL_STATUSES.has(input.originalStatus ?? "");
  if (pending && originalActive) return "confirm";
  if (pending && !originalActive) return "refund_orphan";
  return "refund_orphan";
}

/** A declined card can be retried. Only a canceled PaymentIntent abandons the -R row. */
export function shouldAbandonRescheduleBalance(input: {
  eventType: string;
  paymentIntentStatus: string | null | undefined;
}): boolean {
  if (input.eventType === "payment_intent.canceled") return true;
  return (input.paymentIntentStatus ?? "") === "canceled";
}

/**
 * Wallet credit to give the patient on cancel.
 * Bank refunds return only wallet credit that was spent.
 * A wallet-destination refund still credits the original card amount
 * (existing behaviour on the first charge) and does not also credit
 * the balance charge, which is refunded to the card.
 */
export function walletCreditOnCancel(input: {
  destination: "wallet" | "bank";
  appliedWalletCents: number;
  originalCardCents: number;
  balanceCardCents?: number;
}): number {
  const applied = nonNegCents(input.appliedWalletCents);
  if (input.destination === "bank") return applied;
  return applied + nonNegCents(input.originalCardCents);
}

export type RescheduleRefundBooking = {
  id?: string | null;
  payment_mode?: string | null;
  deposit_amount_cents?: number | null;
  total_amount_cents?: number | null;
  wallet_credit_applied_cents?: number | null;
  stripe_payment_intent_id?: string | null;
  reschedule_payment_intent_id?: string | null;
  reschedule_price_diff_cents?: number | null;
  reschedule_payment_status?: string | null;
  rescheduled_from_booking_id?: string | null;
  commission_cents?: number | null;
  refund_amount_cents?: number | null;
  refunded_at?: string | null;
  status?: string | null;
};

export type DestinationRefundLeg = {
  paymentIntentId: string;
  amountCents: number;
  bookingId?: string;
  reason?: string;
  /** Omit reverse flags when this is an old platform balance. */
  reverseTransfer?: boolean;
};

export type ReschedulePairRefundResult =
  | { applied: false }
  | { applied: true; error: string }
  | {
      applied: true;
      totalCents: number;
      rowRefundCents: number;
      refundIds: string[];
      /** Wallet credit spent on these rows, scaled by the refund percent. */
      walletCreditCents: number;
      /** Card cents refunded on the original PaymentIntent. */
      originalCardCents: number;
      /** Card cents refunded on the balance PaymentIntent. */
      balanceCardCents: number;
      successorId: string | null;
    };

type RefundCreateParams = {
  payment_intent: string;
  amount: number;
  reverse_transfer?: true;
  refund_application_fee?: true;
};

export type StripeRefundClient = {
  refunds: {
    create(
      params: RefundCreateParams,
      options?: { idempotencyKey?: string }
    ): Promise<{ id?: string | null }>;
    list?(params: { payment_intent: string; limit?: number }): Promise<{
      data?: Array<{
        id?: string | null;
        amount?: number | null;
        status?: string | null;
      }>;
    }>;
  };
};

const REFUND_BOOKING_COLUMNS =
  "id, payment_mode, deposit_amount_cents, total_amount_cents, wallet_credit_applied_cents, stripe_payment_intent_id, reschedule_payment_intent_id, reschedule_price_diff_cents, reschedule_payment_status, rescheduled_from_booking_id, commission_cents, refund_amount_cents, refunded_at, status";

function nonNegCents(value: number | null | undefined): number {
  if (value == null || !Number.isFinite(value)) return 0;
  return Math.max(0, Math.round(value));
}

/**
 * Card amount actually captured. Wallet credit is not part of the
 * PaymentIntent, so it is returned separately rather than refunded twice.
 */
export function cardChargeNetOfWallet(
  chargedCents: number,
  walletCreditCents: number | null | undefined
): number {
  const charged = nonNegCents(chargedCents);
  const wallet = Math.min(charged, nonNegCents(walletCreditCents));
  return charged - wallet;
}

/**
 * What a clinic cancellation returns to the patient. Cancellation policy
 * and hours until the appointment are ignored: cancel-and-rebook must not
 * keep a late-cancellation fee. The status is the clinic/doctor cancel.
 */
export function clinicCancelMakeWhole(input: {
  cancellationPolicy?: string | null;
  hoursUntilAppointment?: number | null;
  originalPaymentIntentId: string | null;
  originalChargedCents: number;
  originalWalletCreditCents?: number | null;
  balancePaymentIntentId?: string | null;
  balanceChargedCents?: number | null;
  balanceWalletCreditCents?: number | null;
}): {
  status: typeof CLINIC_CANCEL_STATUS;
  refundPercent: 100;
  legs: DestinationRefundLeg[];
  walletCreditCents: number;
} {
  void input.cancellationPolicy;
  void input.hoursUntilAppointment;

  const originalCard = cardChargeNetOfWallet(
    input.originalChargedCents,
    input.originalWalletCreditCents
  );
  const balanceCard = nonNegCents(input.balanceChargedCents);
  const legs = rescheduleRefundLegs({
    refundPercent: 100,
    originalPaymentIntentId: input.originalPaymentIntentId,
    originalChargedCents: originalCard,
    balancePaymentIntentId: input.balancePaymentIntentId ?? null,
    balanceChargedCents: balanceCard,
  });

  return {
    status: CLINIC_CANCEL_STATUS,
    refundPercent: 100,
    legs,
    walletCreditCents:
      nonNegCents(input.originalWalletCreditCents) +
      nonNegCents(input.balanceWalletCreditCents),
  };
}

export function stripeChargedCents(booking: {
  payment_mode?: string | null;
  deposit_amount_cents?: number | null;
  total_amount_cents?: number | null;
}): number {
  if (
    booking.payment_mode === "deposit" &&
    booking.deposit_amount_cents != null
  ) {
    return Math.max(0, booking.deposit_amount_cents);
  }
  return Math.max(0, booking.total_amount_cents ?? 0);
}

export function isPaidRescheduleSuccessor(
  booking: RescheduleRefundBooking
): boolean {
  return (
    Boolean((booking.rescheduled_from_booking_id ?? "").trim()) &&
    booking.reschedule_payment_status === "paid"
  );
}

function balancePaymentIntentId(
  successor: RescheduleRefundBooking
): string | null {
  const id =
    successor.reschedule_payment_intent_id ||
    successor.stripe_payment_intent_id ||
    null;
  const trimmed = (id ?? "").trim();
  return trimmed || null;
}

/**
 * Both charges of a paid dearer-slot reschedule, scaled by the
 * cancellation percentage. Each amount is capped at what that
 * PaymentIntent actually collected.
 */
export function rescheduleRefundLegs(input: {
  refundPercent: number;
  balancePaymentIntentId: string | null;
  balanceChargedCents: number;
  originalPaymentIntentId: string | null;
  originalChargedCents: number;
}): DestinationRefundLeg[] {
  const percent = Math.min(100, Math.max(0, input.refundPercent));
  const scale = (cents: number) => {
    const charged = Math.max(0, Math.round(cents));
    if (charged === 0 || percent === 0) return 0;
    return Math.min(charged, Math.round((charged * percent) / 100));
  };

  const legs: DestinationRefundLeg[] = [];
  const push = (id: string | null, charged: number) => {
    if (!id) return;
    const amountCents = scale(charged);
    if (amountCents <= 0) return;
    if (legs.some((leg) => leg.paymentIntentId === id)) return;
    legs.push({ paymentIntentId: id, amountCents });
  };

  push(input.originalPaymentIntentId, input.originalChargedCents);
  push(input.balancePaymentIntentId, input.balanceChargedCents);
  return legs;
}

/**
 * Split an explicit refund amount across the original charge and the
 * balance charge in proportion to what each PaymentIntent collected.
 */
export function allocateRescheduleRefundCents(input: {
  requestedCents: number;
  balanceChargedCents: number;
  originalChargedCents: number;
}): { balanceCents: number; originalCents: number } {
  const balanceCap = Math.max(0, Math.round(input.balanceChargedCents));
  const originalCap = Math.max(0, Math.round(input.originalChargedCents));
  const total = balanceCap + originalCap;
  const requested = Math.max(0, Math.min(Math.round(input.requestedCents), total));
  if (requested === 0 || total === 0) {
    return { balanceCents: 0, originalCents: 0 };
  }
  const balanceCents = Math.min(
    balanceCap,
    Math.round((balanceCap * requested) / total)
  );
  const originalCents = Math.min(originalCap, requested - balanceCents);
  return { balanceCents, originalCents };
}

function refundAlreadyCovers(
  row: RescheduleRefundBooking,
  requestedCents: number
): boolean {
  const requested = nonNegCents(requestedCents);
  if (requested <= 0) return true;
  const recorded = nonNegCents(row.refund_amount_cents);
  if (recorded >= requested) return true;
  // A refunded row with no amount recorded has already been closed.
  return Boolean(row.refunded_at) && recorded === 0;
}

function refundRemainderCents(
  row: RescheduleRefundBooking,
  requestedCents: number
): number {
  const requested = nonNegCents(requestedCents);
  if (requested <= 0 || refundAlreadyCovers(row, requested)) return 0;
  return requested - nonNegCents(row.refund_amount_cents);
}

/**
 * Refund one card charge. Lists refunds already on the PaymentIntent so a
 * retry after a failed database write does not refund again, and sends an
 * idempotency key of booking id + PaymentIntent id + amount + reason.
 * Reverse flags are included only when `reverseTransfer` is true.
 */
export async function refundCardCharge(
  stripe: StripeRefundClient,
  leg: DestinationRefundLeg
): Promise<string | null> {
  const paymentIntentId = (leg.paymentIntentId ?? "").trim();
  const amount = nonNegCents(leg.amountCents);
  if (!paymentIntentId || amount <= 0) return null;

  let remaining = amount;
  if (stripe.refunds.list) {
    try {
      const listed = await stripe.refunds.list({
        payment_intent: paymentIntentId,
        limit: 100,
      });
      const rows = (listed.data ?? []).filter((row) => {
        const status = row.status ?? "succeeded";
        return status !== "failed" && status !== "canceled";
      });
      const already = rows.reduce(
        (sum, row) => sum + nonNegCents(row.amount),
        0
      );
      if (already >= amount) {
        return rows.find((row) => row.id)?.id ?? null;
      }
      remaining = amount - already;
    } catch (err) {
      log.error("Could not list Stripe refunds before creating one", {
        err,
        paymentIntentId,
      });
    }
  }

  const params: RefundCreateParams = {
    payment_intent: paymentIntentId,
    amount: remaining,
  };
  if (leg.reverseTransfer) {
    params.reverse_transfer = true;
    params.refund_application_fee = true;
  }
  const refund = await stripe.refunds.create(params, {
    idempotencyKey: refundIdempotencyKey({
      bookingId: (leg.bookingId ?? "").trim() || "booking",
      paymentIntentId,
      amountCents: remaining,
      reason: (leg.reason ?? "").trim() || "refund",
    }),
  });
  return refund?.id ?? null;
}

export async function createDestinationRefunds(
  stripe: StripeRefundClient,
  legs: DestinationRefundLeg[]
): Promise<string[]> {
  const ids: string[] = [];
  for (const leg of legs) {
    const id = await refundCardCharge(stripe, leg);
    if (id) ids.push(id);
  }
  return ids;
}

/** Add a refund onto the amount already stored. Throws when the read or write fails. */
export async function persistAddedRefund(
  id: string,
  amountCents: number,
  db: {
    read: (id: string) => Promise<{
      refund_amount_cents?: number | null;
      error?: string | null;
    }>;
    write: (
      id: string,
      refundAmountCents: number
    ) => Promise<{ error?: string | null }>;
  }
): Promise<void> {
  const added = nonNegCents(amountCents);
  if (!id || added <= 0) return;
  const current = await db.read(id);
  if (current.error) throw new Error(current.error);
  const next = addedRefundCents(current.refund_amount_cents, added);
  const written = await db.write(id, next);
  if (written.error) throw new Error(written.error);
}

async function defaultLoadBooking(
  id: string
): Promise<RescheduleRefundBooking | null> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("bookings")
    .select(REFUND_BOOKING_COLUMNS)
    .eq("id", id)
    .maybeSingle();
  return data;
}

async function defaultFindPaidSuccessor(
  originalId: string
): Promise<RescheduleRefundBooking | null> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("bookings")
    .select(REFUND_BOOKING_COLUMNS)
    .eq("rescheduled_from_booking_id", originalId)
    .eq("reschedule_payment_status", "paid")
    .limit(1);
  return data?.[0] ?? null;
}

async function defaultPersistOtherRefund(
  id: string,
  amountCents: number
): Promise<void> {
  const admin = createAdminClient();
  try {
    await persistAddedRefund(id, amountCents, {
      read: async (bookingId) => {
        const { data, error } = await admin
          .from("bookings")
          .select("refund_amount_cents")
          .eq("id", bookingId)
          .maybeSingle();
        return {
          refund_amount_cents: data?.refund_amount_cents,
          error: error?.message,
        };
      },
      write: async (bookingId, refundAmountCents) => {
        const { error } = await admin
          .from("bookings")
          .update({
            refund_amount_cents: refundAmountCents,
            refunded_at: new Date().toISOString(),
          })
          .eq("id", bookingId);
        return { error: error?.message };
      },
    });
  } catch (err) {
    log.error("Failed to record the other reschedule refund", {
      err,
      bookingId: id,
      amountCents,
    });
    throw err;
  }
}

/**
 * Refund a paid dearer-slot reschedule on both PaymentIntents.
 * Returns `{ applied: false }` when this booking is not part of a paid
 * balance pair, so the caller keeps its single-charge refund.
 *
 * `rowRefundCents` is the portion that belongs on the booking being
 * cancelled. The other row is updated with its own portion so the
 * activity statement does not count the same money twice.
 */
export async function refundReschedulePairIfPaid(
  booking: RescheduleRefundBooking,
  options: {
    refundPercent?: number;
    requestedCents?: number;
    stripe?: StripeRefundClient;
    loadBooking?: (id: string) => Promise<RescheduleRefundBooking | null>;
    findPaidSuccessor?: (
      originalId: string
    ) => Promise<RescheduleRefundBooking | null>;
    persistOtherRefund?: (id: string, amountCents: number) => Promise<void>;
    /**
     * Kept for callers. The card refund is always the amount charged to
     * the card. Wallet credit is reported separately and is not sent to Stripe.
     */
    netOfWallet?: boolean;
  } = {}
): Promise<ReschedulePairRefundResult> {
  const load = options.loadBooking ?? defaultLoadBooking;
  const bookingId = (booking.id ?? "").trim();
  const full = bookingId ? (await load(bookingId)) ?? booking : booking;

  let successor: RescheduleRefundBooking | null = null;
  let original: RescheduleRefundBooking | null = null;

  if (isPaidRescheduleSuccessor(full)) {
    successor = full;
    const originalId = (full.rescheduled_from_booking_id ?? "").trim();
    if (!originalId) return { applied: false };
    original = await load(originalId);
    if (!original) {
      return {
        applied: true,
        error: "Could not find the original charge to refund.",
      };
    }
  } else if ((full.id ?? "").trim()) {
    const found = await (
      options.findPaidSuccessor ?? defaultFindPaidSuccessor
    )((full.id ?? "").trim());
    if (!found || !isPaidRescheduleSuccessor(found)) {
      return { applied: false };
    }
    successor = found;
    original = full;
  } else {
    return { applied: false };
  }

  const balanceIntent = balancePaymentIntentId(successor);
  const balanceCharged = Math.max(
    0,
    Math.round(successor.reschedule_price_diff_cents ?? 0)
  );
  const originalIntent = (original.stripe_payment_intent_id ?? "").trim() || null;
  const originalBasis = stripeChargedCents(original);
  // The PaymentIntent is the card charge. Wallet credit was never on it.
  const originalCharged = cardChargeNetOfWallet(
    originalBasis,
    original.wallet_credit_applied_cents
  );
  const walletBase =
    nonNegCents(original.wallet_credit_applied_cents) +
    nonNegCents(successor.wallet_credit_applied_cents);
  const walletPercent =
    options.requestedCents != null
      ? 100
      : Math.min(100, Math.max(0, options.refundPercent ?? 0));
  const fullWalletCreditCents = Math.round((walletBase * walletPercent) / 100);

  let balanceCents = 0;
  let originalCents = 0;
  if (options.requestedCents != null) {
    const split = allocateRescheduleRefundCents({
      requestedCents: options.requestedCents,
      balanceChargedCents: balanceCharged,
      originalChargedCents: originalCharged,
    });
    balanceCents = split.balanceCents;
    originalCents = split.originalCents;
  } else {
    const percent = options.refundPercent ?? 0;
    const legsForScale = rescheduleRefundLegs({
      refundPercent: percent,
      balancePaymentIntentId: balanceIntent,
      balanceChargedCents: balanceCharged,
      originalPaymentIntentId: originalIntent,
      originalChargedCents: originalCharged,
    });
    for (const leg of legsForScale) {
      if (leg.paymentIntentId === balanceIntent) balanceCents = leg.amountCents;
      if (leg.paymentIntentId === originalIntent) originalCents = leg.amountCents;
    }
  }

  const originalRequested = originalCents;
  const balanceRequested = balanceCents;
  originalCents = refundRemainderCents(original, originalCents);
  balanceCents = refundRemainderCents(successor, balanceCents);
  const coveredAlready =
    originalRequested + balanceRequested > 0 &&
    originalCents === 0 &&
    balanceCents === 0;

  const currentId = (full.id ?? "").trim();
  const successorId = (successor.id ?? "").trim() || null;
  const originalId = (original.id ?? "").trim();
  const rowRefundCents = currentId === successorId ? balanceCents : originalCents;
  const otherId = currentId === successorId ? originalId : successorId ?? "";
  const otherCents = currentId === successorId ? originalCents : balanceCents;

  const legs: DestinationRefundLeg[] = [];
  if (originalIntent && originalCents > 0) {
    legs.push({
      paymentIntentId: originalIntent,
      amountCents: originalCents,
      bookingId: originalId,
      reason: "reschedule_pair",
      reverseTransfer: refundReversesTransfer(original),
    });
  }
  if (balanceIntent && balanceCents > 0 && balanceIntent !== originalIntent) {
    legs.push({
      paymentIntentId: balanceIntent,
      amountCents: balanceCents,
      bookingId: successorId ?? originalId,
      reason: "reschedule_pair",
      reverseTransfer: refundReversesTransfer(successor),
    });
  }

  if (legs.length === 0) {
    if (coveredAlready) {
      return {
        applied: true,
        totalCents: 0,
        rowRefundCents: 0,
        refundIds: [],
        walletCreditCents: 0,
        originalCardCents: 0,
        balanceCardCents: 0,
        successorId,
      };
    }
    if (fullWalletCreditCents > 0) {
      return {
        applied: true,
        totalCents: 0,
        rowRefundCents: 0,
        refundIds: [],
        walletCreditCents: fullWalletCreditCents,
        originalCardCents: 0,
        balanceCardCents: 0,
        successorId,
      };
    }
    return { applied: false };
  }

  try {
    const stripe = options.stripe ?? getStripe();
    const refundIds = await createDestinationRefunds(stripe, legs);
    if (otherId && otherCents > 0) {
      const persist = options.persistOtherRefund ?? defaultPersistOtherRefund;
      await persist(otherId, otherCents);
    }
    return {
      applied: true,
      totalCents: balanceCents + originalCents,
      rowRefundCents,
      refundIds,
      walletCreditCents: fullWalletCreditCents,
      originalCardCents: originalCents,
      balanceCardCents: balanceCents,
      successorId,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Refund failed";
    log.error("Reschedule pair refund failed", { err, bookingId: currentId });
    return { applied: true, error: message };
  }
}

const PENDING_RESCHEDULE_STATUS = "pending_reschedule_payment";

/** Which open balance PaymentIntent a cancellation must cancel. */
export function openBalancePaymentToCancel(input: {
  bookingId: string;
  bookingStatus?: string | null;
  bookingPaymentIntentId?: string | null;
  pendingSuccessor?: {
    id: string;
    paymentIntentId?: string | null;
    status?: string | null;
  } | null;
}): { closeBookingId: string | null; paymentIntentId: string } | null {
  const ownIntent = (input.bookingPaymentIntentId ?? "").trim();
  if (input.bookingStatus === PENDING_RESCHEDULE_STATUS && ownIntent) {
    return { closeBookingId: null, paymentIntentId: ownIntent };
  }
  const successor = input.pendingSuccessor;
  const successorIntent = (successor?.paymentIntentId ?? "").trim();
  if (
    successor &&
    (successor.status ?? PENDING_RESCHEDULE_STATUS) === PENDING_RESCHEDULE_STATUS &&
    successorIntent
  ) {
    return { closeBookingId: successor.id, paymentIntentId: successorIntent };
  }
  return null;
}

function balanceIntentOnRow(row: {
  reschedule_payment_intent_id?: string | null;
  stripe_payment_intent_id?: string | null;
}): string | null {
  const id =
    (row.reschedule_payment_intent_id ?? "").trim() ||
    (row.stripe_payment_intent_id ?? "").trim();
  return id || null;
}

async function defaultFindPendingSuccessor(originalId: string): Promise<{
  id: string;
  paymentIntentId: string | null;
  status: string | null;
} | null> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("bookings")
    .select("id, status, reschedule_payment_intent_id, stripe_payment_intent_id")
    .eq("rescheduled_from_booking_id", originalId)
    .eq("status", PENDING_RESCHEDULE_STATUS)
    .limit(1);
  const row = data?.[0];
  if (!row) return null;
  return {
    id: row.id,
    status: row.status,
    paymentIntentId: balanceIntentOnRow(row),
  };
}

async function defaultMarkBalanceCancelled(id: string): Promise<void> {
  const admin = createAdminClient();
  const { error } = await admin
    .from("bookings")
    .update({
      status: CLINIC_CANCEL_STATUS,
      reschedule_payment_status: "expired",
      cancelled_at: new Date().toISOString(),
      cancellation_reason: "Reschedule balance cancelled before payment",
    })
    .eq("id", id)
    .eq("status", PENDING_RESCHEDULE_STATUS);
  if (error) {
    log.error("Failed to cancel a pending reschedule balance", { err: error, bookingId: id });
    throw new Error(error.message);
  }
}

/**
 * Cancel a balance PaymentIntent that has not been paid: the -R row
 * itself, or the pending successor of the booking being cancelled.
 */
export async function cancelOpenRescheduleBalance(
  booking: {
    id?: string | null;
    status?: string | null;
    reschedule_payment_intent_id?: string | null;
    stripe_payment_intent_id?: string | null;
  },
  options: {
    stripe?: { paymentIntents: { cancel(id: string): Promise<unknown> } };
    findPendingSuccessor?: (originalId: string) => Promise<{
      id: string;
      paymentIntentId: string | null;
      status: string | null;
    } | null>;
    markCancelled?: (id: string) => Promise<void>;
  } = {}
): Promise<void> {
  const bookingId = (booking.id ?? "").trim();
  if (!bookingId) return;
  const pending =
    booking.status === PENDING_RESCHEDULE_STATUS
      ? null
      : await (options.findPendingSuccessor ?? defaultFindPendingSuccessor)(bookingId);
  const target = openBalancePaymentToCancel({
    bookingId,
    bookingStatus: booking.status,
    bookingPaymentIntentId: balanceIntentOnRow(booking),
    pendingSuccessor: pending,
  });
  if (!target) return;
  const stripe = options.stripe ?? getStripe();
  try {
    await stripe.paymentIntents.cancel(target.paymentIntentId);
  } catch (err) {
    log.error("Could not cancel open reschedule balance PaymentIntent", {
      err,
      paymentIntentId: target.paymentIntentId,
    });
  }
  if (target.closeBookingId) {
    const mark = options.markCancelled ?? defaultMarkBalanceCancelled;
    await mark(target.closeBookingId);
  }
}

export async function loadCommissionChain(
  start: {
    id: string;
    commission_cents?: number | null;
    consultation_fee_cents?: number | null;
    rescheduled_from_booking_id?: string | null;
  },
  loadParent: (id: string) => Promise<{
    id: string;
    commission_cents?: number | null;
    consultation_fee_cents?: number | null;
    rescheduled_from_booking_id?: string | null;
  } | null>
) {
  const chain: Array<{
    commissionCents: number;
    feeBasisCents: number;
    rescheduledFromBookingId?: string | null;
  }> = [];
  let current: {
    id: string;
    commission_cents?: number | null;
    consultation_fee_cents?: number | null;
    rescheduled_from_booking_id?: string | null;
  } | null = start;
  const seen = new Set<string>();
  for (let step = 0; step < 8 && current; step += 1) {
    if (seen.has(current.id)) break;
    seen.add(current.id);
    chain.push({
      commissionCents: current.commission_cents ?? 0,
      feeBasisCents: current.consultation_fee_cents ?? 0,
      rescheduledFromBookingId: current.rescheduled_from_booking_id,
    });
    const parentId = (current.rescheduled_from_booking_id ?? "").trim();
    if (!parentId || parentId === current.id) break;
    current = await loadParent(parentId);
  }
  return chain;
}

export function balanceCommissionForReschedule(input: {
  chainNewestFirst: Array<{
    commissionCents: number;
    feeBasisCents: number;
    rescheduledFromBookingId?: string | null;
  }>;
  priceDiffCents: number;
}): number {
  const root = rootCommissionFromChain(input.chainNewestFirst);
  return rescheduleBalanceApplicationFeeCents({
    priceDiffCents: input.priceDiffCents,
    originalCommissionCents: root.commissionCents,
    originalFeeBasisCents: root.feeBasisCents,
  });
}

export type RescheduleBalanceBookingRow = {
  id: string;
  status?: string | null;
  commission_cents?: number | null;
  consultation_fee_cents?: number | null;
  reschedule_price_diff_cents?: number | null;
  doctor_id?: string | null;
  currency?: string | null;
  refunded_at?: string | null;
};

function escapeAlert(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

export async function alertRescheduleBalanceAdmins(message: string): Promise<void> {
  log.error(message);
  const emails = (process.env.ADMIN_EMAILS || "")
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);
  if (emails.length === 0) return;
  const { sendEmail } = await import("@/lib/email/client");
  for (const to of emails) {
    await sendEmail({
      to,
      subject: "Reschedule balance payment needs a refund",
      html: `<p>${escapeAlert(message)}</p>`,
    }).catch((err) =>
      log.error("Admin reschedule alert email failed", { err, to })
    );
  }
}

/**
 * Confirm a paid reschedule balance, ignore a replay, or refund the
 * charge when the original booking is no longer active.
 */
export async function applyRescheduleBalanceSuccess(input: {
  newBooking: RescheduleBalanceBookingRow;
  originalBooking: RescheduleBalanceBookingRow;
  paymentIntentId: string;
  paymentIntentAmountCents?: number | null;
  stripe: StripeRefundClient;
  updateBooking: (
    id: string,
    patch: Record<string, unknown>,
    match?: { status?: string; statusIn?: string[] }
  ) => Promise<number>;
  insertPlatformFee: (row: {
    booking_id: string;
    doctor_id: string;
    fee_type: "commission";
    amount_cents: number;
    currency: string;
  }) => Promise<void>;
  alertAdmin: (message: string) => Promise<void>;
}): Promise<"confirm" | "replay" | "refund_orphan"> {
  const action = rescheduleBalanceSuccessAction({
    newStatus: input.newBooking.status,
    originalStatus: input.originalBooking.status,
    balanceRefundedAt: input.newBooking.refunded_at,
  });
  if (action === "replay") return "replay";
  if (action === "refund_orphan") {
    await refundOrphanBalance(input);
    return "refund_orphan";
  }

  const originalUpdated = await input.updateBooking(
    input.originalBooking.id,
    { status: "cancelled_doctor" },
    { statusIn: [...ACTIVE_ORIGINAL_STATUSES] }
  );
  if (originalUpdated === 0) {
    await refundOrphanBalance(input);
    return "refund_orphan";
  }

  const confirmed = await input.updateBooking(
    input.newBooking.id,
    {
      status: "confirmed",
      reschedule_payment_status: "paid",
      stripe_payment_intent_id: input.paymentIntentId,
      paid_at: new Date().toISOString(),
    },
    { status: "pending_reschedule_payment" }
  );
  if (confirmed === 0) {
    await refundOrphanBalance(input);
    return "refund_orphan";
  }

  const diff = nonNegCents(input.newBooking.reschedule_price_diff_cents);
  const fee = balanceFeeToRecord({
    storedCommissionCents: input.newBooking.commission_cents,
    priceDiffCents: diff || nonNegCents(input.paymentIntentAmountCents),
    originalCommissionCents: input.originalBooking.commission_cents ?? 0,
    originalFeeBasisCents: input.originalBooking.consultation_fee_cents ?? 0,
  });
  if (fee > 0 && nonNegCents(input.newBooking.commission_cents) === 0) {
    await input.updateBooking(input.newBooking.id, { commission_cents: fee });
  }
  if (fee > 0 && input.newBooking.doctor_id) {
    await input.insertPlatformFee({
      booking_id: input.newBooking.id,
      doctor_id: input.newBooking.doctor_id,
      fee_type: "commission",
      amount_cents: fee,
      currency: input.newBooking.currency || "gbp",
    });
  }
  return "confirm";
}

async function refundOrphanBalance(input: {
  newBooking: RescheduleBalanceBookingRow;
  originalBooking: RescheduleBalanceBookingRow;
  paymentIntentId: string;
  paymentIntentAmountCents?: number | null;
  stripe: StripeRefundClient;
  updateBooking: (
    id: string,
    patch: Record<string, unknown>,
    match?: { status?: string; statusIn?: string[] }
  ) => Promise<number>;
  alertAdmin: (message: string) => Promise<void>;
}): Promise<void> {
  const amount =
    nonNegCents(input.newBooking.reschedule_price_diff_cents) ||
    nonNegCents(input.paymentIntentAmountCents);
  await refundCardCharge(input.stripe, {
    paymentIntentId: input.paymentIntentId,
    amountCents: amount,
    bookingId: input.newBooking.id,
    reason: "orphan_balance",
    reverseTransfer: refundReversesTransfer({
      commission_cents: input.newBooking.commission_cents,
      rescheduled_from_booking_id: input.originalBooking.id,
      reschedule_payment_status: "paid",
    }),
  });
  const refundedAt = new Date().toISOString();
  await input.updateBooking(input.newBooking.id, {
    status: "cancelled_doctor",
    reschedule_payment_status: "refunded",
    refund_amount_cents: amount,
    refunded_at: refundedAt,
    cancelled_at: refundedAt,
    cancellation_reason: "Balance paid after the original booking was already closed",
  });
  await input.alertAdmin(
    `Reschedule balance ${input.paymentIntentId} for booking ${input.newBooking.id} was paid after original booking ${input.originalBooking.id} was already ${input.originalBooking.status ?? "closed"}. The balance charge was refunded.`
  );
}
