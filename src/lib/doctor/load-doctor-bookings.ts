import { createClient } from "@/lib/supabase/server";
import {
  DOCTOR_BOOKINGS_SELECT,
  DOCTOR_RESCHEDULE_SELECT,
  doctorHasBookingsEntitlement,
  type DoctorBookingsInitial,
} from "@/lib/doctor/doctor-bookings-query";

export type { DoctorBookingsInitial } from "@/lib/doctor/doctor-bookings-query";

export type DoctorBookingsAccess =
  | { status: "anonymous" }
  | { status: "free" }
  | ({ status: "subscribed" } & DoctorBookingsInitial);

/**
 * Load the signed-in doctor's bookings with the cookie session.
 * The browser panel was staying on Loader2 because its queries wait on
 * the GoTrue navigator lock. This read does not.
 */
export async function loadDoctorBookingsForSession(): Promise<DoctorBookingsAccess> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { status: "anonymous" };

  const { data: doctor } = await supabase
    .from("doctors")
    .select("id, base_currency, organization_id")
    .eq("profile_id", user.id)
    .maybeSingle();
  if (!doctor) return { status: "free" };

  if (!doctor.organization_id) return { status: "free" };

  const { data: licenses } = await supabase
    .from("licenses")
    .select("id, tier, status, created_at")
    .eq("organization_id", doctor.organization_id)
    .in("status", ["active", "trialing", "past_due"]);

  if (!doctorHasBookingsEntitlement(licenses)) return { status: "free" };

  const { data: bookings } = await supabase
    .from("bookings")
    .select(DOCTOR_BOOKINGS_SELECT)
    .eq("doctor_id", doctor.id)
    .order("appointment_date", { ascending: false })
    .order("start_time", { ascending: false });

  const { data: reschedules } = await supabase
    .from("reschedule_requests")
    .select(DOCTOR_RESCHEDULE_SELECT)
    .eq("status", "pending")
    .eq("booking.doctor_id", doctor.id)
    .order("created_at", { ascending: false });

  return {
    status: "subscribed",
    doctorId: doctor.id,
    doctorCurrency: doctor.base_currency || "EUR",
    bookings: bookings || [],
    reschedules: reschedules || [],
  };
}
