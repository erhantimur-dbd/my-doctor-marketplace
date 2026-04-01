"use server";

import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Returns a map of specialty slug → count of doctors with available slots
 * in the next 1 hour. Used for the live notification badges on the
 * specialty marquee.
 */
export async function getLiveAvailabilityCounts(): Promise<
  Record<string, number>
> {
  const supabase = createAdminClient();

  const now = new Date();
  const oneHourLater = new Date(now.getTime() + 60 * 60 * 1000);

  // Day of week: JS 0=Sun … 6=Sat → DB 0=Mon … 6=Sun
  const jsDay = now.getDay(); // 0=Sun
  const dbDay = jsDay === 0 ? 6 : jsDay - 1;

  // Current time as HH:MM:SS for TIME comparisons
  const pad = (n: number) => String(n).padStart(2, "0");
  const currentTime = `${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;
  const oneHourTime = `${pad(oneHourLater.getHours())}:${pad(oneHourLater.getMinutes())}:${pad(oneHourLater.getSeconds())}`;

  const todayStr = now.toISOString().slice(0, 10); // YYYY-MM-DD

  // Query: find verified doctors who have active schedules covering
  // any part of the next hour, are not overridden off today, and don't
  // have conflicting bookings for every slot in that window.
  // We count distinct doctors per specialty.
  const { data, error } = await supabase.rpc("get_live_availability_counts", {
    p_day_of_week: dbDay,
    p_current_time: currentTime,
    p_one_hour_time: oneHourTime,
    p_today: todayStr,
  });

  if (error || !data) {
    // Fallback: return empty — badges just won't show
    console.error("Live availability query failed:", error?.message);
    return {};
  }

  // data is array of { slug: string, count: number }
  const counts: Record<string, number> = {};
  for (const row of data as { slug: string; count: number }[]) {
    counts[row.slug] = row.count;
  }
  return counts;
}

/**
 * Returns a set of doctor IDs that have available slots in the next 1 hour.
 * Used for the "Available Now" indicator on doctor cards.
 */
export async function getLiveDoctorAvailability(
  doctorIds: string[]
): Promise<Record<string, boolean>> {
  if (doctorIds.length === 0) return {};

  const supabase = createAdminClient();
  const now = new Date();
  const oneHourLater = new Date(now.getTime() + 60 * 60 * 1000);

  const jsDay = now.getDay();
  const dbDay = jsDay === 0 ? 6 : jsDay - 1;

  const pad = (n: number) => String(n).padStart(2, "0");
  const currentTime = `${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;
  const oneHourTime = `${pad(oneHourLater.getHours())}:${pad(oneHourLater.getMinutes())}:${pad(oneHourLater.getSeconds())}`;
  const todayStr = now.toISOString().slice(0, 10);

  const { data, error } = await supabase.rpc("get_live_doctor_availability", {
    p_doctor_ids: doctorIds,
    p_day_of_week: dbDay,
    p_current_time: currentTime,
    p_one_hour_time: oneHourTime,
    p_today: todayStr,
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
