/**
 * Consult appointment window for Checkout descriptions and booking notifications.
 * Always Europe/London, 24-hour clock, no year:
 * "Sunday 27 September, 10:30 to 11:00 (UK time)".
 */

import { isAbsoluteTimestamp } from "@/lib/booking/appointment-instant";

const UK_TIME_ZONE = "Europe/London";
const DATE_ONLY = /^(\d{4})-(\d{2})-(\d{2})$/;
const TIME_ONLY = /^(\d{1,2}):(\d{2})(?::(\d{2})(?:\.\d+)?)?$/;

export interface AppointmentWindowOptions {
  /** Added to the start when `end` is missing. */
  durationMinutes?: number | null;
  /**
   * Civil date (`YYYY-MM-DD`) used when start/end are wall-clock
   * `HH:mm` / `HH:mm:ss` rather than an absolute timestamp.
   */
  appointmentDate?: string | null;
}

function part(
  parts: Intl.DateTimeFormatPart[],
  type: Intl.DateTimeFormatPartTypes
): string {
  return parts.find((p) => p.type === type)?.value ?? "";
}

function readOptions(
  durationOrOptions?: number | null | AppointmentWindowOptions
): AppointmentWindowOptions {
  if (durationOrOptions == null) return {};
  if (typeof durationOrOptions === "number") {
    return { durationMinutes: durationOrOptions };
  }
  return durationOrOptions;
}

/** Postgres `YYYY-MM-DD HH:mm:ss+00` and short offsets become a Date. */
function parseFlexibleTimestamp(value: string): Date {
  let timestamp = value.trim();
  if (/^\d{4}-\d{2}-\d{2} /.test(timestamp)) {
    timestamp = `${timestamp.slice(0, 10)}T${timestamp.slice(11)}`;
  }
  timestamp = timestamp.replace(/([+-]\d{2})$/, "$1:00");
  timestamp = timestamp.replace(/([+-])(\d{2})(\d{2})$/, "$1$2:$3");
  return new Date(timestamp);
}

function londonWallClock(date: string, time: string): Date {
  const dateMatch = DATE_ONLY.exec(date.trim());
  const timeMatch = TIME_ONLY.exec(time.trim());
  if (!dateMatch || !timeMatch) return new Date(NaN);

  const year = Number(dateMatch[1]);
  const month = Number(dateMatch[2]);
  const day = Number(dateMatch[3]);
  const hour = Number(timeMatch[1]);
  const minute = Number(timeMatch[2]);
  const second = Number(timeMatch[3] ?? 0);
  const desired = Date.UTC(year, month - 1, day, hour, minute, second);

  let utc = desired;
  for (let i = 0; i < 3; i += 1) {
    const parts = new Intl.DateTimeFormat("en-GB", {
      timeZone: UK_TIME_ZONE,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hourCycle: "h23",
    }).formatToParts(new Date(utc));
    let hourPart = Number(part(parts, "hour"));
    if (hourPart === 24) hourPart = 0;
    const asUtc = Date.UTC(
      Number(part(parts, "year")),
      Number(part(parts, "month")) - 1,
      Number(part(parts, "day")),
      hourPart,
      Number(part(parts, "minute")),
      Number(part(parts, "second"))
    );
    const diff = desired - asUtc;
    if (diff === 0) break;
    utc += diff;
  }
  return new Date(utc);
}

function resolveInstant(
  value: string | Date,
  appointmentDate?: string | null
): Date | null {
  if (value instanceof Date) {
    return Number.isFinite(value.getTime()) ? value : null;
  }
  const raw = value.trim();
  if (!raw) return null;
  if (isAbsoluteTimestamp(raw)) {
    const instant = parseFlexibleTimestamp(raw);
    return Number.isFinite(instant.getTime()) ? instant : null;
  }
  const date = appointmentDate?.trim() ?? "";
  if (TIME_ONLY.test(raw) && DATE_ONLY.test(date)) {
    const instant = londonWallClock(date, raw);
    return Number.isFinite(instant.getTime()) ? instant : null;
  }
  return null;
}

function londonDateLabel(instant: Date): string | null {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: UK_TIME_ZONE,
    weekday: "long",
    day: "numeric",
    month: "long",
  }).formatToParts(instant);
  const weekday = part(parts, "weekday");
  const day = part(parts, "day");
  const month = part(parts, "month");
  if (!weekday || !day || !month) return null;
  return `${weekday} ${day} ${month}`;
}

function londonClock(instant: Date): string | null {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: UK_TIME_ZONE,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(instant);
  let hours = Number(part(parts, "hour"));
  const minutes = Number(part(parts, "minute"));
  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return null;
  if (hours === 24) hours = 0;
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}

/**
 * Format a consult start (and end, when known) in UK time.
 * Accepts ISO strings or Dates. A missing end uses `durationMinutes` when
 * that is a positive number of minutes; otherwise only the start is shown.
 */
export function formatAppointmentWindow(
  start: string | Date,
  end?: string | Date | null,
  durationOrOptions?: number | null | AppointmentWindowOptions
): string {
  const options = readOptions(durationOrOptions);
  const startInstant = resolveInstant(start, options.appointmentDate);
  if (!startInstant) return "Date to be confirmed (UK time)";

  const dateLabel = londonDateLabel(startInstant);
  const startClock = londonClock(startInstant);
  if (!dateLabel || !startClock) return "Date to be confirmed (UK time)";

  let endInstant: Date | null = null;
  if (end != null && !(typeof end === "string" && end.trim() === "")) {
    endInstant = resolveInstant(end, options.appointmentDate);
  }
  const duration = options.durationMinutes;
  if (
    !endInstant &&
    typeof duration === "number" &&
    Number.isFinite(duration) &&
    duration > 0
  ) {
    endInstant = new Date(startInstant.getTime() + duration * 60_000);
  }

  if (!endInstant) {
    return `${dateLabel}, ${startClock} (UK time)`;
  }
  const endClock = londonClock(endInstant);
  if (!endClock) {
    return `${dateLabel}, ${startClock} (UK time)`;
  }
  return `${dateLabel}, ${startClock} to ${endClock} (UK time)`;
}
