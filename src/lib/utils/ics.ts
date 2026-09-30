/**
 * ICS (iCalendar) file generation utility.
 * Generates .ics files for calendar event export (Google Calendar, Apple Calendar, Outlook, etc.)
 */

export type ICSMethod = "PUBLISH" | "REQUEST" | "CANCEL";
export type ICSStatus = "CONFIRMED" | "CANCELLED" | "TENTATIVE";

export interface ICSEvent {
  title: string;
  description?: string;
  start: Date;
  end: Date;
  location?: string;
  /** Stable UID. When omitted, a random id is used (dashboard download). */
  uid?: string;
  sequence?: number;
  method?: ICSMethod;
  status?: ICSStatus;
  url?: string;
  dtstamp?: Date;
  organizerEmail?: string;
  organizerName?: string;
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
export function formatICSDate(date: Date): string {
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
 * RFC 5545: backslash, semicolon, comma, and newlines.
 */
export function escapeICSText(text: string): string {
  return text
    .replace(/\\/g, "\\\\")
    .replace(/\r\n/g, "\\n")
    .replace(/\n/g, "\\n")
    .replace(/\r/g, "\\n")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,");
}

/**
 * Fold one content line at 75 octets (RFC 5545). Continuations start with a space.
 */
export function foldIcsLine(line: string): string {
  const bytes = new TextEncoder().encode(line);
  if (bytes.length <= 75) return line;
  const decoder = new TextDecoder();
  const chunks: string[] = [];
  let offset = 0;
  let budget = 75;
  while (offset < bytes.length) {
    let end = Math.min(offset + budget, bytes.length);
    while (end > offset && end < bytes.length && (bytes[end] & 0xc0) === 0x80) {
      end -= 1;
    }
    if (end === offset) end = Math.min(offset + budget, bytes.length);
    chunks.push(decoder.decode(bytes.subarray(offset, end)));
    offset = end;
    budget = 74;
  }
  return chunks.map((chunk, index) => (index === 0 ? chunk : ` ${chunk}`)).join("\r\n");
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
  const method = event.method ?? "PUBLISH";
  const status =
    event.status ?? (method === "CANCEL" ? "CANCELLED" : "CONFIRMED");
  const uid = event.uid ?? `${generateUID()}@mydoctors360.com`;
  const lines: string[] = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//MyDoctor//Booking//EN",
    "CALSCALE:GREGORIAN",
    `METHOD:${method}`,
    "BEGIN:VEVENT",
    `UID:${uid}`,
    `DTSTAMP:${formatICSDate(event.dtstamp ?? new Date())}`,
    `DTSTART:${formatICSDate(event.start)}`,
    `DTEND:${formatICSDate(event.end)}`,
    `SUMMARY:${escapeICSText(event.title)}`,
  ];

  if (event.sequence != null) {
    lines.push(`SEQUENCE:${event.sequence}`);
  }

  if (event.description) {
    lines.push(`DESCRIPTION:${escapeICSText(event.description)}`);
  }

  if (event.location) {
    lines.push(`LOCATION:${escapeICSText(event.location)}`);
  }

  if (event.url) {
    lines.push(`URL:${event.url}`);
  }

  if (event.organizerEmail) {
    const cn = event.organizerName
      ? `;CN=${escapeICSText(event.organizerName)}`
      : "";
    lines.push(`ORGANIZER${cn}:mailto:${event.organizerEmail}`);
  }

  lines.push(`STATUS:${status}`, "END:VEVENT", "END:VCALENDAR");

  return `${lines.map(foldIcsLine).join("\r\n")}\r\n`;
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
