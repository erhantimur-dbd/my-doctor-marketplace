/**
 * Shared availability display helpers.
 * Used by DoctorCard and the doctor profile page.
 */

/**
 * Returns a human-friendly label like "Available today", "Available tomorrow",
 * or "Available Wed, 5 Mar" for the given ISO date string.
 */
export function formatDateLabel(dateStr: string): string {
  const date = new Date(dateStr + "T00:00:00");
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  if (date.getTime() === today.getTime()) return "Available today";
  if (date.getTime() === tomorrow.getTime()) return "Available tomorrow";

  return `Available ${date.toLocaleDateString("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
  })}`;
}

/**
 * Short date label for tab pills: "Today", "Tomorrow", or "Wed 5".
 */
export function formatShortDateLabel(dateStr: string): string {
  const date = new Date(dateStr + "T00:00:00");
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  if (date.getTime() === today.getTime()) return "Today";
  if (date.getTime() === tomorrow.getTime()) return "Tomorrow";

  return date.toLocaleDateString("en-GB", {
    weekday: "short",
    day: "numeric",
  });
}

/**
 * Formats a TIMESTAMPTZ string (e.g. "2026-03-05T10:00:00+00:00") into "HH:mm".
 */
export function formatSlotTime(timestamptz: string): string {
  const d = new Date(timestamptz);
  return d.toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
  });
}
