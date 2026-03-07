/**
 * ICS (iCalendar) file generation utility.
 * Generates .ics files for calendar event export (Google Calendar, Apple Calendar, Outlook, etc.)
 */

export interface ICSEvent {
  title: string;
  description?: string;
  start: Date;
  end: Date;
  location?: string;
}

/**
 * Pad a number to two digits.
 */
function pad(n: number): string {
  return n.toString().padStart(2, "0");
}

/**
 * Format a Date to UTC ICS timestamp: YYYYMMDDTHHMMSSZ
 */
function formatICSDate(date: Date): string {
  return (
    date.getUTCFullYear().toString() +
    pad(date.getUTCMonth() + 1) +
    pad(date.getUTCDate()) +
    "T" +
    pad(date.getUTCHours()) +
    pad(date.getUTCMinutes()) +
    pad(date.getUTCSeconds()) +
    "Z"
  );
}

/**
 * Escape special characters for ICS text fields.
 * ICS spec requires escaping backslashes, semicolons, commas, and newlines.
 */
function escapeICSText(text: string): string {
  return text
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\n/g, "\\n");
}

/**
 * Generate a UID for the ICS event.
 * Uses crypto.randomUUID if available, otherwise falls back to a timestamp-based ID.
 */
function generateUID(): string {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
}

/**
 * Generate an ICS (iCalendar) format string from an event.
 */
export function generateICS(event: ICSEvent): string {
  const lines: string[] = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//MyDoctor//Booking//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:${generateUID()}@mydoctors360.com`,
    `DTSTAMP:${formatICSDate(new Date())}`,
    `DTSTART:${formatICSDate(event.start)}`,
    `DTEND:${formatICSDate(event.end)}`,
    `SUMMARY:${escapeICSText(event.title)}`,
  ];

  if (event.description) {
    lines.push(`DESCRIPTION:${escapeICSText(event.description)}`);
  }

  if (event.location) {
    lines.push(`LOCATION:${escapeICSText(event.location)}`);
  }

  lines.push("STATUS:CONFIRMED", "END:VEVENT", "END:VCALENDAR");

  return lines.join("\r\n");
}

/**
 * Download an ICS string as a .ics file in the browser.
 */
export function downloadICS(icsString: string, filename: string): void {
  const blob = new Blob([icsString], { type: "text/calendar;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename.endsWith(".ics") ? filename : `${filename}.ics`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
