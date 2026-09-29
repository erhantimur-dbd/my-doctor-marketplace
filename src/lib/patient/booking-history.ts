import { BOOKING_STATUSES } from "@/lib/constants/booking-status";
import {
  isAbsoluteTimestamp,
  resolveBookingInstant,
} from "@/lib/booking/appointment-instant";

/** Statuses that remain actionable / future-facing when the appointment is still ahead. */
export const PATIENT_UPCOMING_STATUSES = [
  BOOKING_STATUSES.CONFIRMED,
  BOOKING_STATUSES.APPROVED,
  BOOKING_STATUSES.PENDING_PAYMENT,
  BOOKING_STATUSES.PENDING_APPROVAL,
  BOOKING_STATUSES.PENDING_RESCHEDULE_PAYMENT,
] as const;

/** Terminal / historical statuses — always Past regardless of date. */
export const PATIENT_PAST_STATUSES = [
  BOOKING_STATUSES.COMPLETED,
  BOOKING_STATUSES.CANCELLED_PATIENT,
  BOOKING_STATUSES.CANCELLED_DOCTOR,
  BOOKING_STATUSES.NO_SHOW,
  BOOKING_STATUSES.REFUNDED,
  BOOKING_STATUSES.REJECTED,
  BOOKING_STATUSES.EXPIRED,
] as const;

export type PatientBookingHistoryBucket = "upcoming" | "past" | "other";

export type PatientBookingHistoryInput = {
  status: string;
  appointment_date?: string | null;
  start_time?: string | null;
};

function resolveStart(booking: PatientBookingHistoryInput): Date | null {
  const appointmentDate = (booking.appointment_date ?? "").trim();
  const startTime = (booking.start_time ?? "").trim();

  if (startTime && isAbsoluteTimestamp(startTime)) {
    const start = new Date(startTime);
    return Number.isFinite(start.getTime()) ? start : null;
  }

  if (appointmentDate && startTime) {
    const start = resolveBookingInstant(appointmentDate, startTime);
    return Number.isFinite(start.getTime()) ? start : null;
  }

  if (appointmentDate) {
    const start = new Date(`${appointmentDate}T00:00:00`);
    return Number.isFinite(start.getTime()) ? start : null;
  }

  return null;
}

/**
 * Classify a patient booking into Upcoming vs Past.
 *
 * Matches doctor-dashboard behaviour: active statuses whose appointment
 * start has already passed belong in Past, not Upcoming. Terminal statuses
 * (cancelled, completed, rejected, expired, …) are always Past.
 */
export function classifyPatientBookingHistory(
  booking: PatientBookingHistoryInput,
  now: Date = new Date()
): PatientBookingHistoryBucket {
  const status = booking.status;

  if ((PATIENT_PAST_STATUSES as readonly string[]).includes(status)) {
    return "past";
  }

  if (!(PATIENT_UPCOMING_STATUSES as readonly string[]).includes(status)) {
    return "other";
  }

  const start = resolveStart(booking);
  if (start && start.getTime() < now.getTime()) {
    return "past";
  }

  return "upcoming";
}

export function partitionPatientBookings<T extends PatientBookingHistoryInput>(
  bookings: T[],
  now: Date = new Date()
): { upcoming: T[]; past: T[] } {
  const upcoming: T[] = [];
  const past: T[] = [];

  for (const booking of bookings) {
    const bucket = classifyPatientBookingHistory(booking, now);
    if (bucket === "upcoming") {
      upcoming.push(booking);
    } else {
      // "other" orphan statuses surface in Past so they are not lost.
      past.push(booking);
    }
  }

  return { upcoming, past };
}
