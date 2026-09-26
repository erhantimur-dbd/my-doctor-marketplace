/**
 * Shared cancellation refund math + wallet-vs-bank payout rules.
 *
 * Wallet path must NOT call Stripe customer refunds (that returns money to
 * the card) and then also creditWallet — that double-pays the patient.
 * Wallet = reverse Connect transfer to platform + creditWallet.
 * Bank = Stripe refunds.create (card + reverse_transfer).
 *
 * Softsmoke / unpaid bookings (no payment_intent or paid_at) never mint
 * wallet credit from bare total_amount_cents.
 */

import { resolveBookingInstant } from "@/lib/booking/appointment-instant";

export type CancellationPolicyName = "flexible" | "moderate" | "strict" | string;

export function hoursUntilAppointment(
  appointmentDate: string,
  startTime: string,
  now: Date = new Date()
): number {
  const start = resolveBookingInstant(appointmentDate, startTime);
  const ms = start.getTime();
  if (!Number.isFinite(ms)) return 0;
  return (ms - now.getTime()) / (1000 * 60 * 60);
}

export function refundPercentForPolicy(
  policy: CancellationPolicyName | null | undefined,
  hoursUntil: number
): number {
  if (policy === "flexible") {
    return hoursUntil > 24 ? 100 : 0;
  }
  if (policy === "moderate") {
    if (hoursUntil > 48) return 100;
    if (hoursUntil > 24) return 50;
    return 0;
  }
  if (policy === "strict") {
    return hoursUntil > 72 ? 100 : 0;
  }
  return 0;
}

export function stripeChargedAmountCents(booking: {
  payment_mode?: string | null;
  deposit_amount_cents?: number | null;
  total_amount_cents: number;
}): number {
  if (
    booking.payment_mode === "deposit" &&
    booking.deposit_amount_cents != null
  ) {
    return booking.deposit_amount_cents;
  }
  return booking.total_amount_cents;
}

/** True when a real Stripe charge exists that can be refunded or reversed. */
export function bookingHasRefundableCharge(booking: {
  stripe_payment_intent_id?: string | null;
  paid_at?: string | null;
}): boolean {
  return Boolean(booking.stripe_payment_intent_id && booking.paid_at);
}

export function refundAmountCents(
  chargedCents: number,
  refundPercent: number
): number {
  if (chargedCents <= 0 || refundPercent <= 0) return 0;
  return Math.round((chargedCents * refundPercent) / 100);
}
