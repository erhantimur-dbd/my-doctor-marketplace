/**
 * Patient label for a doctor booking row.
 *
 * The browser query embeds
 * `patient:profiles!bookings_patient_id_fkey(first_name, last_name, email)`.
 * Profiles SELECT policies only allow the owner, admins, public verified
 * doctors, and review authors — not the doctor on the booking. PostgREST
 * then returns `patient: null` (or, for some relationship shapes, an array).
 * Reading `.first_name` on that null throws and the bookings error boundary
 * replaces the list.
 */
export const DOCTOR_BOOKING_PATIENT_FALLBACK = "Patient";
export const DOCTOR_BOOKING_PATIENT_EMAIL_FALLBACK = "—";

export type BookingPatientEmbed = {
  first_name?: string | null;
  last_name?: string | null;
  email?: string | null;
};

export function unwrapBookingPatient(
  patient: BookingPatientEmbed | BookingPatientEmbed[] | null | undefined
): BookingPatientEmbed | null {
  if (Array.isArray(patient)) return patient[0] ?? null;
  return patient ?? null;
}

export function doctorBookingPatientName(
  patient: BookingPatientEmbed | BookingPatientEmbed[] | null | undefined
): string {
  const row = unwrapBookingPatient(patient);
  const name = `${row?.first_name ?? ""} ${row?.last_name ?? ""}`.trim();
  return name || DOCTOR_BOOKING_PATIENT_FALLBACK;
}

export function doctorBookingPatientEmail(
  patient: BookingPatientEmbed | BookingPatientEmbed[] | null | undefined
): string {
  const email = (unwrapBookingPatient(patient)?.email ?? "").trim();
  return email || DOCTOR_BOOKING_PATIENT_EMAIL_FALLBACK;
}
