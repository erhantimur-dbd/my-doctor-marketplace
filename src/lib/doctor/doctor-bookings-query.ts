import { pickEffectiveLicense } from "@/lib/license/tier-lifecycle";
import { hasProductEntitlements } from "@/lib/utils/feature-flags";

/**
 * Same embed the doctor bookings table renders. Kept here so the server
 * render and the client refetch cannot drift.
 */
export const DOCTOR_BOOKINGS_SELECT =
  "id, booking_number, appointment_date, start_time, end_time, consultation_type, status, currency, total_amount_cents, patient_notes, video_room_url, visit_summary, visit_summary_at, is_gp_pool, gp_reassignment_status, display_doctor_as, patient:profiles!bookings_patient_id_fkey(first_name, last_name, email)";

export const DOCTOR_RESCHEDULE_SELECT = `*, booking:bookings!inner(
          id, booking_number, appointment_date, start_time, end_time,
          patient:profiles!bookings_patient_id_fkey(first_name, last_name, email)
        )`;

export type DoctorBookingsInitial = {
  doctorId: string;
  doctorCurrency: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  bookings: any[];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  reschedules: any[];
};

type LicenseRow = {
  id?: string;
  tier: string;
  status: string;
  created_at?: string | null;
};

/**
 * Founding Free (`tier=free`, active) is a product entitlement. A missing
 * licence is not. The bookings panel must not wait on a second client
 * check to learn this.
 */
export function doctorHasBookingsEntitlement(
  licenses: LicenseRow[] | null | undefined
): boolean {
  const license = pickEffectiveLicense(licenses || []);
  return Boolean(license && hasProductEntitlements(license.tier));
}
