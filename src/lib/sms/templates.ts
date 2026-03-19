/**
 * SMS message templates — plain text, max 160 chars per segment.
 *
 * Keep messages concise. Twilio concatenates automatically if > 160 chars,
 * but each segment costs 1 SMS credit. Aim for 1 segment where possible.
 */

const BRAND = "MyDoctors360";

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
  bookingNumber: string;
}

export function bookingConfirmationSms({
  patientName,
  doctorName,
  date,
  time,
  bookingNumber,
}: ConfirmationParams): string {
  return `${BRAND}: Hi ${patientName}, your appointment with Dr. ${doctorName} on ${date} at ${time} is confirmed. Ref: ${bookingNumber}`;
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
