"use server";

import { requireOrgMember } from "@/actions/organization";
import { createAdminClient } from "@/lib/supabase/admin";
import { log } from "@/lib/utils/logger";

/**
 * Get all bookings across the organization (for org admin/owner view).
 */
export async function getOrgBookings(filters?: {
  status?: string;
  tab?: "upcoming" | "past" | "all";
}) {
  const { error: authError, org } = await requireOrgMember(["owner", "admin"]);
  if (authError || !org) return { error: authError, data: [] };

  const adminClient = createAdminClient();
  const today = new Date().toISOString().split("T")[0];

  let query = adminClient
    .from("bookings")
    .select(
      `id, booking_number, appointment_date, start_time, end_time, status,
       consultation_type, total_amount_cents, platform_fee_cents, currency,
       doctor_id, paid_at, stripe_payment_intent_id,
       patient:profiles!bookings_patient_id_fkey(first_name, last_name),
       doctor:doctors!inner(
         id,
         profile:profiles!doctors_profile_id_fkey(first_name, last_name)
       )`
    )
    .eq("organization_id", org.id)
    .limit(200);

  const tab = filters?.tab || "upcoming";

  if (tab === "upcoming") {
    query = query
      .gte("appointment_date", today)
      .in("status", ["confirmed", "approved", "pending_payment", "pending_approval"])
      .order("appointment_date", { ascending: true });
  } else if (tab === "past") {
    query = query
      .lt("appointment_date", today)
      .order("appointment_date", { ascending: false });
  } else {
    query = query.order("created_at", { ascending: false });
  }

  if (filters?.status) {
    query = query.eq("status", filters.status);
  }

  const { data, error } = await query;

  if (error) {
    log.error("Org bookings fetch error", { err: error, orgId: org.id });
    return { error: "Failed to load bookings.", data: [] };
  }

  return { data: data || [] };
}

/**
 * Get org-wide analytics (for org admin/owner view).
 */
export async function getOrgAnalytics() {
  const { error: authError, org } = await requireOrgMember(["owner", "admin"]);
  if (authError || !org) return { error: authError };

  const adminClient = createAdminClient();
  const today = new Date().toISOString().split("T")[0];

  const [
    { count: totalBookings },
    { count: upcomingBookings },
    { data: revenueData },
    { data: doctorPerformance },
  ] = await Promise.all([
    adminClient
      .from("bookings")
      .select("*", { count: "exact", head: true })
      .eq("organization_id", org.id),
    adminClient
      .from("bookings")
      .select("*", { count: "exact", head: true })
      .eq("organization_id", org.id)
      .gte("appointment_date", today)
      .in("status", ["confirmed", "approved"]),
    adminClient
      .from("bookings")
      .select("total_amount_cents, platform_fee_cents, currency")
      .eq("organization_id", org.id)
      .in("status", ["confirmed", "approved", "completed"]),
    adminClient
      .from("bookings")
      .select(
        `doctor_id, status,
         doctor:doctors!inner(
           profile:profiles!doctors_profile_id_fkey(first_name, last_name)
         )`
      )
      .eq("organization_id", org.id)
      .in("status", ["confirmed", "approved", "completed"]),
  ]);

  // Compute revenue
  const totalRevenue = (revenueData || []).reduce(
    (sum, b: any) => sum + (b.total_amount_cents - b.platform_fee_cents),
    0
  );

  // Compute per-doctor stats
  const doctorStats: Record<string, { name: string; bookings: number }> = {};
  (doctorPerformance || []).forEach((b: any) => {
    const doctor = b.doctor;
    const profile: any = doctor?.profile
      ? (Array.isArray(doctor.profile) ? doctor.profile[0] : doctor.profile)
      : null;
    const name = profile
      ? `Dr. ${profile.first_name} ${profile.last_name}`
      : "Unknown";
    if (!doctorStats[b.doctor_id]) {
      doctorStats[b.doctor_id] = { name, bookings: 0 };
    }
    doctorStats[b.doctor_id].bookings++;
  });

  const doctorBreakdown = Object.values(doctorStats).sort(
    (a, b) => b.bookings - a.bookings
  );

  return {
    totalBookings: totalBookings || 0,
    upcomingBookings: upcomingBookings || 0,
    totalRevenue,
    currency: (revenueData?.[0] as any)?.currency || "EUR",
    doctorBreakdown,
  };
}
