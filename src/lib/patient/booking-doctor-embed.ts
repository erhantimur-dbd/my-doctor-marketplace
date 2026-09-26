/**
 * Patient booking embeds for the current doctor.
 *
 * `bookings` has two foreign keys to `doctors`:
 * `bookings_doctor_id_fkey` (doctor_id) and
 * `bookings_reassigned_from_doctor_id_fkey` (reassigned_from_doctor_id).
 * An unqualified `doctor:doctors(...)` is PGRST201, so the patient bookings
 * page shows "Unable to load bookings" even when the patient has no rows.
 *
 * `doctors` also reaches `profiles` more than one way (profile_id and the
 * favorites junction). The profile embed must name `doctors_profile_id_fkey`.
 */
export const BOOKING_CURRENT_DOCTOR_EMBED = "doctors!bookings_doctor_id_fkey";

/** Inner join on the current-doctor FK (not reassigned_from_doctor_id). */
export const BOOKING_CURRENT_DOCTOR_INNER_EMBED =
  "doctors!bookings_doctor_id_fkey!inner";

export const BOOKING_DOCTOR_PROFILE_EMBED = "profiles!doctors_profile_id_fkey";

export const PATIENT_BOOKINGS_LIST_SELECT = `
      id,
      booking_number,
      start_time,
      end_time,
      status,
      consultation_type,
      consultation_fee_cents,
      platform_fee_cents,
      total_amount_cents,
      currency,
      patient_notes,
      created_at,
      doctor:${BOOKING_CURRENT_DOCTOR_EMBED}(
        slug, title, clinic_name,
        profile:${BOOKING_DOCTOR_PROFILE_EMBED}(first_name, last_name, avatar_url)
      )
    `;

/** Payment history — same FK disambiguation as the bookings list. */
export const PATIENT_PAYMENTS_LIST_SELECT = `
      id, booking_number, appointment_date, start_time, consultation_type,
      total_amount_cents, currency, status, paid_at, created_at,
      doctor:${BOOKING_CURRENT_DOCTOR_EMBED}(
        title, clinic_name,
        profile:${BOOKING_DOCTOR_PROFILE_EMBED}(first_name, last_name)
      )
    `;

/** Completed bookings awaiting a review — same FK disambiguation. */
export const PATIENT_PENDING_REVIEW_BOOKINGS_SELECT = `
      id,
      booking_number,
      start_time,
      consultation_type,
      doctor_id,
      doctor:${BOOKING_CURRENT_DOCTOR_EMBED}(
        id, title, slug,
        profile:${BOOKING_DOCTOR_PROFILE_EMBED}(first_name, last_name),
        doctor_specialties(specialty:specialties(slug))
      )
    `;

type BookingDoctorNameSource = {
  title?: string | null;
  profile?: {
    first_name?: string | null;
    last_name?: string | null;
  } | null;
} | null;

/**
 * Label for a booking card. The doctor embed is null when RLS hides the
 * doctor row (for example a suspended soft-launch doctor). The booking
 * itself should still render.
 */
export function patientBookingDoctorName(
  doctor: BookingDoctorNameSource
): string {
  const profile = doctor?.profile;
  const name = `${doctor?.title || ""} ${profile?.first_name || ""} ${profile?.last_name || ""}`.trim();
  return name || "Doctor";
}
