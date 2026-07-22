/**
 * Shared availability display helpers.
 * Used by DoctorCard and the doctor profile page.
 */

import { localeToBcp47 } from "@/lib/voice/locale";

/**
 * Returns a human-friendly label like "Available today", "Available tomorrow",
 * or "Available Wed, 5 Mar" for the given ISO date string.
 */
export function formatDateLabel(dateStr: string, locale = "en"): string {
  const date = new Date(dateStr + "T00:00:00");
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  if (date.getTime() === today.getTime()) return "Available today";
  if (date.getTime() === tomorrow.getTime()) return "Available tomorrow";

  return `Available ${date.toLocaleDateString(localeToBcp47(locale), {
    weekday: "short",
    day: "numeric",
    month: "short",
  })}`;
}

/**
 * Short date label for tab pills: "Today", "Tomorrow", or "Wed 5".
 */
export function formatShortDateLabel(dateStr: string, locale = "en"): string {
  const date = new Date(dateStr + "T00:00:00");
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  if (date.getTime() === today.getTime()) return "Today";
  if (date.getTime() === tomorrow.getTime()) return "Tomorrow";

  return date.toLocaleDateString(localeToBcp47(locale), {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
}

/**
 * Formats a TIMESTAMPTZ string (e.g. "2026-03-05T10:00:00+00:00") or
 * time-only "HH:mm:ss" / "HH:mm" into a locale-aware clock string.
 */
export function formatSlotTime(
  timestamptz: string,
  locale: string = "en"
): string {
  const bcp47 = localeToBcp47(locale);

  // Time-only values (common for slot_start from Postgres time / one-tap params)
  if (/^\d{1,2}:\d{2}(:\d{2})?$/.test(timestamptz)) {
    const [h, m] = timestamptz.split(":");
    const d = new Date();
    d.setHours(Number(h), Number(m), 0, 0);
    return d.toLocaleTimeString(bcp47, {
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  const d = new Date(timestamptz);
  if (Number.isNaN(d.getTime())) {
    // Fallback: slice HH:mm from ISO-like strings
    if (timestamptz.includes("T")) {
      return timestamptz.slice(11, 16);
    }
    return timestamptz;
  }
  return d.toLocaleTimeString(bcp47, {
    hour: "2-digit",
    minute: "2-digit",
  });
}
