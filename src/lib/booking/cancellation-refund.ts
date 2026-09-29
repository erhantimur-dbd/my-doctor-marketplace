import { resolveBookingInstant } from "@/lib/booking/appointment-instant";
import type { CancellationPolicy } from "@/lib/constants/booking-status";

/**
 * Hours remaining until the appointment start.
 * Uses resolveBookingInstant so ISO TIMESTAMPTZ start_time values are not
 * corrupted by concatenating appointment_date.
 */
export function hoursUntilAppointmentStart(
  appointmentDate: string,
  startTime: string,
  now: Date = new Date()
): number {
  const start = resolveBookingInstant(appointmentDate, startTime);
  const ms = start.getTime();
  if (!Number.isFinite(ms)) {
    return Number.NaN;
  }
  return (ms - now.getTime()) / (1000 * 60 * 60);
}

/**
 * Refund percent from cancellation policy + hours until appointment.
 * Mirrors cancelBooking / admin cancel rules.
 */
export function refundPercentForCancellationPolicy(
  policy: string | null | undefined,
  hoursUntil: number
): number {
  if (!Number.isFinite(hoursUntil)) {
    return 0;
  }

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

export function computeCancellationRefundPercent(
  appointmentDate: string,
  startTime: string,
  policy: CancellationPolicy | string | null | undefined,
  now: Date = new Date()
): { hoursUntil: number; refundPercent: number } {
  const hoursUntil = hoursUntilAppointmentStart(
    appointmentDate,
    startTime,
    now
  );
  return {
    hoursUntil,
    refundPercent: refundPercentForCancellationPolicy(policy, hoursUntil),
  };
}
