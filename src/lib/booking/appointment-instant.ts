/**
 * Build a Date for a booking start/end.
 *
 * `bookings.start_time` / `end_time` are TIMESTAMPTZ. PostgREST usually returns
 * full ISO strings; older callers and form input still pass time-only
 * `HH:mm` / `HH:mm:ss`. Concatenating `appointment_date` with an ISO
 * timestamptz yields Invalid Date (NaN), which breaks reminder timing and
 * Daily room expiry.
 */

export function isAbsoluteTimestamp(value: string): boolean {
  const v = value.trim();
  if (!v) return false;
  // ISO-ish: contains T, or date+time with space, or explicit offset/Z
  return /T/.test(v) || /\d{4}-\d{2}-\d{2}\s+\d/.test(v) || /[zZ]|[+-]\d{2}:?\d{2}$/.test(v);
}

export function resolveBookingInstant(
  appointmentDate: string,
  timeOrTimestamp: string
): Date {
  const raw = (timeOrTimestamp ?? "").trim();
  if (isAbsoluteTimestamp(raw)) {
    return new Date(raw);
  }
  const date = (appointmentDate ?? "").trim();
  const time = raw || "00:00:00";
  return new Date(`${date}T${time}`);
}

/** Unix seconds for Daily room expiry: appointment end + 1 hour. */
export function dailyRoomExpiresAtUnixFromBooking(
  appointmentDate: string,
  endTime: string
): number {
  const end = resolveBookingInstant(appointmentDate, endTime);
  const ms = end.getTime();
  if (!Number.isFinite(ms)) {
    // Fall back to "now + 2h" so Daily still gets a finite expires_at.
    return Math.floor(Date.now() / 1000) + 7200;
  }
  return Math.floor(ms / 1000) + 3600;
}
