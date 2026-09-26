/**
 * Shared calendar → availability_overrides import helpers.
 *
 * get_available_slots interprets override times in the doctor's location
 * timezone. Writing UTC wall-clock via toISOString()/toTimeString() shifts
 * busy blocks for non-UTC clinics.
 *
 * Also: never delete existing sync overrides before the new insert succeeds —
 * a failed insert would leave the doctor fully bookable despite external busy.
 */

export type CalendarSyncOverride = {
  doctor_id: string;
  override_date: string;
  is_available: boolean;
  start_time: string;
  end_time: string;
  reason: string;
};

const DEFAULT_TZ = "Europe/London";

/**
 * Convert an absolute instant to YYYY-MM-DD + HH:MM in the given IANA zone.
 */
export function wallClockInTimeZone(
  instant: Date | string,
  timeZone: string = DEFAULT_TZ
): { date: string; time: string } {
  const d = typeof instant === "string" ? new Date(instant) : instant;
  if (!Number.isFinite(d.getTime())) {
    return { date: "1970-01-01", time: "00:00" };
  }

  const tz = timeZone || DEFAULT_TZ;

  const dateParts = new Intl.DateTimeFormat("en-CA", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(d);
  const year = dateParts.find((p) => p.type === "year")?.value ?? "1970";
  const month = dateParts.find((p) => p.type === "month")?.value ?? "01";
  const day = dateParts.find((p) => p.type === "day")?.value ?? "01";

  const timeParts = new Intl.DateTimeFormat("en-GB", {
    timeZone: tz,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(d);
  const hour = timeParts.find((p) => p.type === "hour")?.value ?? "00";
  const minute = timeParts.find((p) => p.type === "minute")?.value ?? "00";

  return {
    date: `${year}-${month}-${day}`,
    time: `${hour.padStart(2, "0")}:${minute.padStart(2, "0")}`,
  };
}

export function buildBusyOverride(input: {
  doctorId: string;
  start: Date | string;
  end: Date | string;
  timeZone: string;
  reason: string;
}): CalendarSyncOverride {
  const startWall = wallClockInTimeZone(input.start, input.timeZone);
  const endWall = wallClockInTimeZone(input.end, input.timeZone);
  return {
    doctor_id: input.doctorId,
    // Use start date; overnight events still block the start day slot window.
    override_date: startWall.date,
    is_available: false,
    start_time: startWall.time,
    end_time: endWall.time,
    reason: input.reason,
  };
}

type AdminLike = {
  from: (table: string) => any;
};

/**
 * Replace upcoming sync overrides safely: insert first, then delete prior rows
 * by id. If insert fails, existing busy blocks remain.
 */
export async function replaceCalendarSyncOverrides(input: {
  supabase: AdminLike;
  doctorId: string;
  reason: string;
  overrides: CalendarSyncOverride[];
  fromDate: string;
}): Promise<{ error?: string }> {
  const { supabase, doctorId, reason, overrides, fromDate } = input;

  const { data: existing, error: selectError } = await supabase
    .from("availability_overrides")
    .select("id")
    .eq("doctor_id", doctorId)
    .eq("reason", reason)
    .gte("override_date", fromDate);

  if (selectError) {
    return { error: selectError.message };
  }

  const oldIds = ((existing || []) as { id: string }[]).map((r) => r.id);

  if (overrides.length > 0) {
    const { error: insertError } = await supabase
      .from("availability_overrides")
      .insert(overrides);
    if (insertError) {
      return { error: insertError.message };
    }
  }

  if (oldIds.length > 0) {
    // Delete in chunks to stay under URL/body limits
    const chunkSize = 200;
    for (let i = 0; i < oldIds.length; i += chunkSize) {
      const chunk = oldIds.slice(i, i + chunkSize);
      const { error: deleteError } = await supabase
        .from("availability_overrides")
        .delete()
        .in("id", chunk);
      if (deleteError) {
        return { error: deleteError.message };
      }
    }
  }

  return {};
}

/** Load doctor location timezone; default Europe/London. */
export async function getDoctorLocationTimezone(
  supabase: AdminLike,
  doctorId: string
): Promise<string> {
  const { data } = await supabase
    .from("doctors")
    .select("location:locations(timezone)")
    .eq("id", doctorId)
    .maybeSingle();

  const location = Array.isArray(data?.location)
    ? data.location[0]
    : data?.location;
  const tz = location?.timezone;
  return typeof tz === "string" && tz.length > 0 ? tz : DEFAULT_TZ;
}
