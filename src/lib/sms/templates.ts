/**
 * SMS message templates — plain text, max 160 chars per segment.
 *
 * Keep messages concise. Twilio concatenates automatically if > 160 chars,
 * but each segment costs 1 SMS credit. Aim for 1 segment where possible.
 */

import { formatAppointmentWindow } from "@/lib/utils/appointment-window";

const BRAND = "MyDoctors360";

function consultWindow(
  date: string,
  time: string,
  end?: string | null,
  durationMinutes?: number | null
): string {
  const start = time?.trim() || date?.trim();
  if (!start) return date || "your appointment";
  const label = formatAppointmentWindow(start, end, {
    durationMinutes,
    appointmentDate: date,
  });
  if (label.startsWith("Date to be confirmed")) {
    const clock = /^\d{1,2}:\d{2}/.test(time) ? time.slice(0, 5) : "";
    if (date && clock && !/^\d{4}-/.test(time)) return `${date} at ${clock}`;
    return date || "your appointment";
  }
  return label;
}

// ---------------------------------------------------------------------------
// Appointment Reminder
// ---------------------------------------------------------------------------

interface ReminderParams {
  patientName: string;
  doctorName: string;
  date: string;         // "15 Apr"
  time: string;         // "10:00"
  minutesBefore: number;
}

export function appointmentReminderSms({
  patientName,
  doctorName,
  date,
  time,
  minutesBefore,
}: ReminderParams): string {
  let timeLabel = "tomorrow";
  if (minutesBefore <= 60) timeLabel = `in ${minutesBefore} min`;
  else if (minutesBefore <= 120) timeLabel = "in 2 hrs";
  else if (minutesBefore < 1440) {
    timeLabel = `in ${Math.round(minutesBefore / 60)} hrs`;
  }

  return `${BRAND}: Hi ${patientName}, your appointment with Dr. ${doctorName} is ${timeLabel} (${date} at ${time}). Reply HELP for support.`;
}

// ---------------------------------------------------------------------------
// Booking Confirmation
// ---------------------------------------------------------------------------

interface ConfirmationParams {
  patientName: string;
  doctorName: string;
  date: string;
  time: string;
  end?: string | null;
  durationMinutes?: number | null;
  bookingNumber: string;
}

export function bookingConfirmationSms({
  patientName,
  doctorName,
  date,
  time,
  end,
  durationMinutes,
  bookingNumber,
}: ConfirmationParams): string {
  const when = consultWindow(date, time, end, durationMinutes);
  return `${BRAND}: Hi ${patientName}, your appointment with Dr. ${doctorName} on ${when} is confirmed. Ref: ${bookingNumber}`;
}

// ---------------------------------------------------------------------------
// Booking Cancellation
// ---------------------------------------------------------------------------

interface CancellationParams {
  patientName: string;
  doctorName: string;
  date: string;
  bookingNumber: string;
  refundPercent: number;
}

export function bookingCancellationSms({
  patientName,
  doctorName,
  date,
  bookingNumber,
  refundPercent,
}: CancellationParams): string {
  const refundNote =
    refundPercent > 0
      ? ` A ${refundPercent}% refund has been initiated.`
      : "";

  return `${BRAND}: Hi ${patientName}, your appointment with Dr. ${doctorName} on ${date} (${bookingNumber}) has been cancelled.${refundNote}`;
}

// ---------------------------------------------------------------------------
// Payment Link (admin-created booking)
// ---------------------------------------------------------------------------

interface PaymentLinkParams {
  patientName: string;
  bookingNumber: string;
  amount: string;       // e.g. "£120.00"
}

export function paymentLinkSms({
  patientName,
  bookingNumber,
  amount,
}: PaymentLinkParams): string {
  return `${BRAND}: Hi ${patientName}, please complete your ${amount} payment for booking ${bookingNumber}. Check your email for the payment link.`;
}

// ---------------------------------------------------------------------------
// Doctor — New / Urgent Booking
// ---------------------------------------------------------------------------

interface DoctorNewBookingSmsParams {
  doctorName: string;
  patientName: string;
  date: string; // YYYY-MM-DD or a preformatted date
  time: string; // ISO timestamp or HH:mm
  end?: string | null;
  durationMinutes?: number | null;
  bookingNumber: string;
  isUrgent?: boolean;
  minutesUntil?: number | null;
}

/**
 * Notify a doctor of a new booking. Keep short for single SMS segment when possible.
 * Urgent variant is used when the appointment starts within ~1 hour.
 */
export function doctorNewBookingSms({
  doctorName,
  patientName,
  date,
  time,
  end,
  durationMinutes,
  bookingNumber,
  isUrgent = false,
  minutesUntil = null,
}: DoctorNewBookingSmsParams): string {
  const window = consultWindow(date, time, end, durationMinutes);
  if (isUrgent) {
    const soon =
      minutesUntil != null && minutesUntil > 0
        ? `in ~${Math.max(1, Math.round(minutesUntil))} min`
        : "soon";
    return `${BRAND}: Dr. ${doctorName}, URGENT new booking ${soon}: ${patientName} — ${window}. Ref: ${bookingNumber}`;
  }
  return `${BRAND}: Dr. ${doctorName}, new booking: ${patientName} on ${window}. Ref: ${bookingNumber}`;
}
