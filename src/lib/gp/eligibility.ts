/**
 * GP pool eligibility helpers — who can take a reassigned same-slot booking.
 */

import { createAdminClient } from "@/lib/supabase/admin";
import { log } from "@/lib/utils/logger";

export const GP_SPECIALTY_SLUG = "general-practice";

export interface EligibleGp {
  id: string;
  slug: string;
  stripe_account_id: string;
  consultation_fee_cents: number;
  organization_id: string | null;
  profile: {
    first_name: string | null;
    last_name: string | null;
    email: string | null;
    phone: string | null;
  };
  recent_gp_reassignments: number;
}

/**
 * True if the booking is in the GP pool or the doctor’s primary specialty is GP.
 */
export async function isGpPoolBooking(booking: {
  is_gp_pool?: boolean | null;
  doctor_id: string;
}): Promise<boolean> {
  if (booking.is_gp_pool) return true;

  const supabase = createAdminClient();
  const { data } = await supabase
    .from("doctor_specialties")
    .select("specialty:specialties!inner(slug), is_primary")
    .eq("doctor_id", booking.doctor_id)
    .eq("is_primary", true)
    .maybeSingle();

  const specialty = data?.specialty as { slug?: string } | { slug?: string }[] | null;
  const slug = Array.isArray(specialty) ? specialty[0]?.slug : specialty?.slug;
  return slug === GP_SPECIALTY_SLUG;
}

/**
 * Decide named vs generic display for a GP booking.
 * Multi-doctor orgs with 2+ GPs → generic_gp.
 */
export async function resolveGpDisplayMode(
  doctorId: string,
  organizationId: string | null
): Promise<"named" | "generic_gp"> {
  if (!organizationId) return "named";

  const supabase = createAdminClient();
  const { count } = await supabase
    .from("doctors")
    .select("id", { count: "exact", head: true })
    .eq("organization_id", organizationId)
    .eq("is_active", true)
    .eq("verification_status", "verified");

  return (count ?? 0) >= 2 ? "generic_gp" : "named";
}

/**
 * Find GPs free at the same date/time with fee ≤ maxFeeCents.
 * Ordered for round-robin: fewest recent reassignments, then lower fee.
 */
export async function findSameSlotGpReplacements(params: {
  excludeDoctorId: string;
  appointmentDate: string; // YYYY-MM-DD
  startTime: string; // HH:MM or HH:MM:SS
  endTime: string;
  consultationType: string;
  maxFeeCents: number;
  limit?: number;
}): Promise<EligibleGp[]> {
  const supabase = createAdminClient();
  const startTime =
    params.startTime.length === 5
      ? `${params.startTime}:00`
      : params.startTime;
  const limit = params.limit ?? 10;

  // GPs with primary specialty general-practice, active, verified, stripe ready
  const { data: candidates, error } = await supabase
    .from("doctors")
    .select(
      `
      id,
      slug,
      stripe_account_id,
      consultation_fee_cents,
      organization_id,
      consultation_types,
      is_active,
      verification_status,
      profile:profiles!doctors_profile_id_fkey(first_name, last_name, email, phone),
      doctor_specialties!inner(
        is_primary,
        specialty:specialties!inner(slug)
      )
    `
    )
    .eq("is_active", true)
    .eq("verification_status", "verified")
    .not("stripe_account_id", "is", null)
    .lte("consultation_fee_cents", params.maxFeeCents)
    .neq("id", params.excludeDoctorId)
    .eq("doctor_specialties.is_primary", true)
    .eq("doctor_specialties.specialty.slug", GP_SPECIALTY_SLUG);

  if (error) {
    log.error("[GP] findSameSlotGpReplacements query failed", { err: error });
    return [];
  }

  if (!candidates?.length) return [];

  // Filter consultation type
  const typed = candidates.filter((d) => {
    const types = (d.consultation_types || []) as string[];
    return types.includes(params.consultationType);
  });

  // Exclude anyone already booked at that slot
  const doctorIds = typed.map((d) => d.id);
  const { data: conflicts } = await supabase
    .from("bookings")
    .select("doctor_id")
    .in("doctor_id", doctorIds)
    .eq("appointment_date", params.appointmentDate)
    .eq("start_time", startTime)
    .not(
      "status",
      "in",
      "(cancelled_patient,cancelled_doctor,refunded,rejected,expired,pending_payment)"
    );

  const busy = new Set((conflicts || []).map((c) => c.doctor_id));

  // Check schedule covers the day (has active schedule for DOW)
  const dow = new Date(`${params.appointmentDate}T12:00:00`).getDay();
  const { data: schedules } = await supabase
    .from("availability_schedules")
    .select("doctor_id")
    .in("doctor_id", doctorIds)
    .eq("day_of_week", dow)
    .eq("is_active", true);

  const hasSchedule = new Set((schedules || []).map((s) => s.doctor_id));

  // Round-robin: count recent reassignments TO each doctor (last 7 days)
  const weekAgo = new Date();
  weekAgo.setDate(weekAgo.getDate() - 7);
  const { data: recent } = await supabase
    .from("bookings")
    .select("doctor_id")
    .in("doctor_id", doctorIds)
    .eq("gp_reassignment_status", "auto_reassigned")
    .gte("reassigned_at", weekAgo.toISOString());

  const reassignCounts = new Map<string, number>();
  for (const r of recent || []) {
    reassignCounts.set(
      r.doctor_id,
      (reassignCounts.get(r.doctor_id) || 0) + 1
    );
  }

  const free: EligibleGp[] = [];
  for (const d of typed) {
    if (busy.has(d.id)) continue;
    if (!hasSchedule.has(d.id)) continue;
    if (!d.stripe_account_id) continue;

    const profileRaw = d.profile as
      | EligibleGp["profile"]
      | EligibleGp["profile"][]
      | null;
    const profile = Array.isArray(profileRaw) ? profileRaw[0] : profileRaw;
    if (!profile) continue;

    free.push({
      id: d.id,
      slug: d.slug,
      stripe_account_id: d.stripe_account_id,
      consultation_fee_cents: d.consultation_fee_cents,
      organization_id: d.organization_id,
      profile,
      recent_gp_reassignments: reassignCounts.get(d.id) || 0,
    });
  }

  free.sort((a, b) => {
    if (a.recent_gp_reassignments !== b.recent_gp_reassignments) {
      return a.recent_gp_reassignments - b.recent_gp_reassignments;
    }
    return a.consultation_fee_cents - b.consultation_fee_cents;
  });

  return free.slice(0, limit);
}
