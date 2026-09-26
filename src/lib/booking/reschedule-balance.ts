import { createAdminClient } from "@/lib/supabase/admin";
import { getStripe } from "@/lib/stripe/client";
import { getCommissionCents } from "@/lib/utils/currency";
import { log } from "@/lib/utils/logger";

export const DOCTOR_CHANGE_RESCHEDULE_MESSAGE =
  "Please cancel and rebook with the other clinician";

/**
 * Same-doctor reschedules continue. A different clinician is refused
 * before any charge or slot change: the original transfer is not moved.
 * Returns null when the doctor is unchanged.
 */
export function rescheduleDoctorChangeError(
  originalDoctorId: string | null | undefined,
  newDoctorId: string | null | undefined
): string | null {
  if (
    originalDoctorId &&
    newDoctorId &&
    originalDoctorId === newDoctorId
  ) {
    return null;
  }
  return DOCTOR_CHANGE_RESCHEDULE_MESSAGE;
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

export type RescheduleRefundBooking = {
  id?: string | null;
  payment_mode?: string | null;
  deposit_amount_cents?: number | null;
  total_amount_cents?: number | null;
  stripe_payment_intent_id?: string | null;
  reschedule_payment_intent_id?: string | null;
  reschedule_price_diff_cents?: number | null;
  reschedule_payment_status?: string | null;
  rescheduled_from_booking_id?: string | null;
};

export type DestinationRefundLeg = {
  paymentIntentId: string;
  amountCents: number;
};

export type ReschedulePairRefundResult =
  | { applied: false }
  | { applied: true; error: string }
  | {
      applied: true;
      totalCents: number;
      rowRefundCents: number;
      refundIds: string[];
    };

type StripeRefundClient = {
  refunds: {
    create(params: {
      payment_intent: string;
      amount: number;
      reverse_transfer: true;
      refund_application_fee: true;
    }): Promise<{ id?: string | null }>;
  };
};

const REFUND_BOOKING_COLUMNS =
  "id, payment_mode, deposit_amount_cents, total_amount_cents, stripe_payment_intent_id, reschedule_payment_intent_id, reschedule_price_diff_cents, reschedule_payment_status, rescheduled_from_booking_id";

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

export async function createDestinationRefunds(
  stripe: StripeRefundClient,
  legs: DestinationRefundLeg[]
): Promise<string[]> {
  const ids: string[] = [];
  for (const leg of legs) {
    const refund = await stripe.refunds.create({
      payment_intent: leg.paymentIntentId,
      amount: leg.amountCents,
      reverse_transfer: true,
      refund_application_fee: true,
    });
    if (refund?.id) ids.push(refund.id);
  }
  return ids;
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
  if (amountCents <= 0) return;
  const admin = createAdminClient();
  const { error } = await admin
    .from("bookings")
    .update({
      refund_amount_cents: amountCents,
      refunded_at: new Date().toISOString(),
    })
    .eq("id", id);
  if (error) {
    log.error("Failed to record the other reschedule refund", {
      err: error,
      bookingId: id,
      amountCents,
    });
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
  const originalCharged = stripeChargedCents(original);

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

  const legs = rescheduleRefundLegs({
    refundPercent: 100,
    balancePaymentIntentId: balanceCents > 0 ? balanceIntent : null,
    balanceChargedCents: balanceCents,
    originalPaymentIntentId: originalCents > 0 ? originalIntent : null,
    originalChargedCents: originalCents,
  });

  if (legs.length === 0) {
    return { applied: false };
  }

  const currentId = (full.id ?? "").trim();
  const successorId = (successor.id ?? "").trim();
  const originalId = (original.id ?? "").trim();
  const rowRefundCents = currentId === successorId ? balanceCents : originalCents;
  const otherId = currentId === successorId ? originalId : successorId;
  const otherCents = currentId === successorId ? originalCents : balanceCents;

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
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Refund failed";
    log.error("Reschedule pair refund failed", { err, bookingId: currentId });
    return { applied: true, error: message };
  }
}
