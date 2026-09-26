/**
 * Human-readable appointment date/time for email bodies.
 * Never returns an ISO-8601 dump (for example 2026-09-26T08:00:00+00:00).
 */

import { isAbsoluteTimestamp } from "@/lib/booking/appointment-instant";

const DEFAULT_TIME_ZONE = "Europe/London";

export interface AppointmentWhen {
  date: string;
  time: string;
  timezone: string;
}

function part(
  parts: Intl.DateTimeFormatPart[],
  type: Intl.DateTimeFormatPartTypes
): string {
  return parts.find((p) => p.type === type)?.value ?? "";
}

function timezoneAbbrev(instant: Date, timeZone: string): string {
  if (!Number.isFinite(instant.getTime())) return "GMT";
  const label = part(
    new Intl.DateTimeFormat("en-GB", {
      timeZone,
      timeZoneName: "short",
    }).formatToParts(instant),
    "timeZoneName"
  );
  return label || "GMT";
}

/** Saturday 26 September 2026 — no comma, no ISO date. */
export function formatAppointmentDate(
  instant: Date,
  timeZone: string = DEFAULT_TIME_ZONE
): string {
  if (!Number.isFinite(instant.getTime())) return "Date to be confirmed";
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone,
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).formatToParts(instant);
  const weekday = part(parts, "weekday");
  const day = part(parts, "day");
  const month = part(parts, "month");
  const year = part(parts, "year");
  if (!weekday || !day || !month || !year) return "Date to be confirmed";
  return `${weekday} ${day} ${month} ${year}`;
}

/** 9:00am — lowercase meridiem, no space, 12-hour clock. */
export function formatAppointmentClock(
  instant: Date,
  timeZone: string = DEFAULT_TIME_ZONE
): string {
  if (!Number.isFinite(instant.getTime())) return "Time to be confirmed";
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(instant);
  let hours = Number(part(parts, "hour"));
  const minutes = Number(part(parts, "minute"));
  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) {
    return "Time to be confirmed";
  }
  if (hours === 24) hours = 0;
  return clockFromParts(hours, minutes);
}

export function clockFromParts(hours: number, minutes: number): string {
  const suffix = hours >= 12 ? "pm" : "am";
  const h12 = hours % 12 === 0 ? 12 : hours % 12;
  const mm = String(minutes).padStart(2, "0");
  return `${h12}:${mm}${suffix}`;
}

function civilNoon(dateOnly: string): Date {
  return new Date(`${dateOnly}T12:00:00Z`);
}

function looksLikeIsoDump(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}([T\s]|$)/.test(value.trim());
}

/**
 * Format a booking date + time for email.
 * Wall-clock `HH:mm` / `HH:mm:ss` is shown as given (not shifted).
 * Absolute timestamps are converted into `timeZone` (default Europe/London).
 */
export function formatAppointmentWhen(input: {
  date?: string | null;
  time?: string | null;
  timeZone?: string;
}): AppointmentWhen {
  const timeZone = input.timeZone?.trim() || DEFAULT_TIME_ZONE;
  const dateRaw = (input.date ?? "").trim();
  const timeRaw = (input.time ?? "").trim();

  if (timeRaw && isAbsoluteTimestamp(timeRaw)) {
    const instant = new Date(timeRaw);
    return {
      date: formatAppointmentDate(instant, timeZone),
      time: formatAppointmentClock(instant, timeZone),
      timezone: timezoneAbbrev(instant, timeZone),
    };
  }

  if (dateRaw && isAbsoluteTimestamp(dateRaw) && !/^\d{4}-\d{2}-\d{2}$/.test(dateRaw)) {
    const instant = new Date(dateRaw);
    const wall = timeRaw.match(/^(\d{1,2}):(\d{2})/);
    return {
      date: formatAppointmentDate(instant, timeZone),
      time: wall
        ? clockFromParts(Number(wall[1]), Number(wall[2]))
        : formatAppointmentClock(instant, timeZone),
      timezone: timezoneAbbrev(instant, timeZone),
    };
  }

  const dateOnly = /^\d{4}-\d{2}-\d{2}$/.test(dateRaw) ? dateRaw : "";
  const wall = timeRaw.match(/^(\d{1,2}):(\d{2})/);
  const dateInstant = dateOnly ? civilNoon(dateOnly) : new Date(NaN);

  return {
    date: dateOnly
      ? formatAppointmentDate(dateInstant, timeZone)
      : "Date to be confirmed",
    time: wall
      ? clockFromParts(Number(wall[1]) % 24, Number(wall[2]))
      : "Time to be confirmed",
    timezone: dateOnly ? timezoneAbbrev(dateInstant, timeZone) : "GMT",
  };
}

/** Human date, or date + clock + zone when the value is an absolute timestamp. */
export function formatEmailDateTime(
  value: string | null | undefined,
  timeZone: string = DEFAULT_TIME_ZONE
): string {
  const raw = (value ?? "").trim();
  if (!raw) return "Date to be confirmed";
  if (looksLikeIsoDump(raw) || isAbsoluteTimestamp(raw)) {
    const when = formatAppointmentWhen({ date: raw, time: raw, timeZone });
    if (when.time === "Time to be confirmed") return when.date;
    if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return when.date;
    return `${when.date}, ${when.time} ${when.timezone}`;
  }
  return raw;
}

export function assertNoIsoDump(value: string): void {
  if (looksLikeIsoDump(value)) {
    throw new Error(`Refusing to place an ISO timestamp in email copy: ${value}`);
  }
}
