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

export interface GpInPersonAvailability {
  /** Distinct GPs with ≥1 free in-person slot in the window */
  doctorCount: number;
  /** Free in-person appointment slots in the window */
  slotCount: number;
}

/**
 * Live count of in-person GP slots (and doctors) in the next N hours.
 * Nearby only — requires lat/lng. Returns zeros without coordinates.
 */
export async function getGpInPersonAvailability(opts: {
  windowHours?: number;
  lat: number;
  lng: number;
  radiusKm?: number;
}): Promise<GpInPersonAvailability> {
  if (
    opts.lat == null ||
    opts.lng == null ||
    !Number.isFinite(opts.lat) ||
    !Number.isFinite(opts.lng)
  ) {
    return { doctorCount: 0, slotCount: 0 };
  }

  const supabase = createAdminClient();

  const { data, error } = await supabase.rpc("get_gp_in_person_availability", {
    p_window_hours: opts.windowHours ?? 2,
    p_country_code: null, // never country-wide for in-person counts
    p_lat: opts.lat,
    p_lng: opts.lng,
    p_radius_km: opts.radiusKm ?? 10,
  });

  if (error || !data) {
    console.error("GP in-person availability query failed:", error?.message);
    return { doctorCount: 0, slotCount: 0 };
  }

  // RPC returns a single row (or array of one row depending on client)
  const row = Array.isArray(data) ? data[0] : data;
  if (!row) return { doctorCount: 0, slotCount: 0 };

  return {
    doctorCount: Number(row.doctor_count ?? 0),
    slotCount: Number(row.slot_count ?? 0),
  };
}
