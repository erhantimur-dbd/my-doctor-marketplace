"use server";

import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Returns a map of specialty slug → count of doctors with available slots
 * in the next 1 hour. Used for the live notification badges on the
 * specialty marquee.
 *
 * Timezone is resolved per-doctor inside the RPC (from their location),
 * so we don't need to pass day/time from the server.
 */
export async function getLiveAvailabilityCounts(): Promise<
  Record<string, number>
> {
  const supabase = createAdminClient();

  const { data, error } = await supabase.rpc("get_live_availability_counts");

  if (error || !data) {
    console.error("Live availability query failed:", error?.message);
    return {};
  }

  const counts: Record<string, number> = {};
  for (const row of data as { slug: string; count: number }[]) {
    counts[row.slug] = row.count;
  }
  return counts;
}

/**
 * Returns a set of doctor IDs that have available slots in the next 1 hour.
 * Used for the "Available Now" indicator on doctor cards.
 *
 * Timezone is resolved per-doctor inside the RPC (from their location).
 */
export async function getLiveDoctorAvailability(
  doctorIds: string[]
): Promise<Record<string, boolean>> {
  if (doctorIds.length === 0) return {};

  const supabase = createAdminClient();

  const { data, error } = await supabase.rpc("get_live_doctor_availability", {
    p_doctor_ids: doctorIds,
  });

  if (error || !data) {
    console.error("Live doctor availability query failed:", error?.message);
    return {};
  }

  const result: Record<string, boolean> = {};
  for (const row of data as { doctor_id: string }[]) {
    result[row.doctor_id] = true;
  }
  return result;
}
