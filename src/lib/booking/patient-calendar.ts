/**
 * Patient booking calendar invites.
 *
 * Reuses the ICS generator (`src/lib/utils/ics.ts`) and the UK instant
 * converter (`resolveUkAppointmentInstant` / `formatAppointmentWindow`).
 * Doctor labels reuse the transactional name/type helpers.
 *
 * SEQUENCE is the whole seconds between `created_at` and the lifecycle
 * anchor (`updated_at`, or the timestamp persisted with the reschedule or
 * cancellation). The same booking id always maps to
 * `booking-<id>@mydoctors360.co.uk`. No extra column.
 */

import {
  escapeHtml,
  formatAppointmentType,
  formatDoctorDisplayName,
} from "@/lib/email/softsmoke-templates";
import {
  formatAppointmentWindow,
  resolveUkAppointmentInstant,
} from "@/lib/utils/appointment-window";
import {
  formatICSDate,
  generateICS,
  type ICSMethod,
} from "@/lib/utils/ics";

export const PATIENT_CALENDAR_UID_HOST = "mydoctors360.co.uk";
export const PATIENT_CALENDAR_ORGANIZER = "noreply@mydoctors360.co.uk";

export type PatientCalendarKind = "confirm" | "reschedule" | "cancel";

export interface PatientCalendarAttachment {
  filename: string;
  /** Base64 ICS body for Resend. */
  content: string;
  contentType: string;
}

export interface PatientCalendarLinks {
  google: string;
  outlook: string;
  office365: string;
  yahoo: string;
}

export interface PatientCalendarEvent {
  uid: string;
  sequence: number;
  method: ICSMethod;
  ics: string;
  filename: string;
  contentType: string;
  attachment: PatientCalendarAttachment;
  links: PatientCalendarLinks;
  linksHtml: string;
  title: string;
  location: string;
  description: string;
  manageUrl: string;
  joinUrl: string | null;
}

export interface PatientCalendarInput {
  bookingId: string;
  doctorName: string;
  consultationType: string;
  appointmentDate: string;
  startTime: string;
  endTime?: string | null;
  durationMinutes?: number | null;
  clinicName?: string | null;
  address?: string | null;
  bookingNumber?: string | null;
  createdAt?: string | Date | null;
  updatedAt?: string | Date | null;
  /** Overrides timestamp-derived SEQUENCE when set. */
  sequence?: number;
  kind?: PatientCalendarKind;
  method?: ICSMethod;
  dtstamp?: Date;
  appUrl?: string;
}

export function patientCalendarUid(bookingId: string): string {
  return `booking-${bookingId}@${PATIENT_CALENDAR_UID_HOST}`;
}

function toMs(value: string | Date | null | undefined): number | null {
  if (value == null || value === "") return null;
  const ms = value instanceof Date ? value.getTime() : new Date(value).getTime();
  return Number.isFinite(ms) ? ms : null;
}

/**
 * Deterministic SEQUENCE from booking timestamps.
 * A reschedule or cancellation moves `updated_at` (or the persisted
 * rescheduled_at / cancelled_at used as the anchor) later than `created_at`,
 * so the next invite is strictly newer while the UID stays put.
 */
export function patientCalendarSequence(input: {
  createdAt?: string | Date | null;
  updatedAt?: string | Date | null;
  sequence?: number;
}): number {
  if (typeof input.sequence === "number" && Number.isFinite(input.sequence)) {
    return Math.max(0, Math.floor(input.sequence));
  }
  const created = toMs(input.createdAt);
  const updated = toMs(input.updatedAt);
  if (created == null || updated == null) return 0;
  return Math.max(0, Math.floor((updated - created) / 1000));
}

function appOrigin(explicit?: string): string {
  const raw = (explicit || process.env.NEXT_PUBLIC_APP_URL || "https://mydoctors360.com")
    .trim()
    .replace(/\/$/, "");
  return raw || "https://mydoctors360.com";
}

export function patientBookingUrl(bookingId: string, appUrl?: string): string {
  return `${appOrigin(appUrl)}/en/dashboard/bookings/${bookingId}`;
}

export function patientVideoJoinUrl(bookingId: string, appUrl?: string): string {
  return `${patientBookingUrl(bookingId, appUrl)}/video-room`;
}

function isVideoConsult(raw: string): boolean {
  const value = raw.trim().toLowerCase();
  return value === "video" || value.includes("video");
}

function isInPersonConsult(raw: string): boolean {
  const value = raw.trim().toLowerCase();
  return (
    value === "in_person" ||
    value.includes("in-person") ||
    value.includes("in person")
  );
}

function practiceAddress(
  clinicName?: string | null,
  address?: string | null
): string {
  return [clinicName?.trim(), address?.trim()].filter(Boolean).join(", ");
}

function formatUtcIso(date: Date): string {
  return date.toISOString().replace(/\.\d{3}Z$/, "Z");
}

function enc(value: string): string {
  return encodeURIComponent(value);
}

function calendarLinks(input: {
  title: string;
  details: string;
  location: string;
  start: Date;
  end: Date;
}): PatientCalendarLinks {
  const compactStart = formatICSDate(input.start);
  const compactEnd = formatICSDate(input.end);
  const isoStart = formatUtcIso(input.start);
  const isoEnd = formatUtcIso(input.end);
  const dates = `${compactStart}/${compactEnd}`;
  const shared = [
    `subject=${enc(input.title)}`,
    `body=${enc(input.details)}`,
    input.location ? `location=${enc(input.location)}` : "",
  ]
    .filter(Boolean)
    .join("&");

  const googleParts = [
    "action=TEMPLATE",
    `text=${enc(input.title)}`,
    `dates=${enc(dates)}`,
    `details=${enc(input.details)}`,
    input.location ? `location=${enc(input.location)}` : "",
    `ctz=${enc("Europe/London")}`,
  ].filter(Boolean);

  const yahooParts = [
    "v=60",
    `title=${enc(input.title)}`,
    `st=${enc(compactStart)}`,
    `et=${enc(compactEnd)}`,
    `desc=${enc(input.details)}`,
    input.location ? `in_loc=${enc(input.location)}` : "",
  ].filter(Boolean);

  return {
    google: `https://calendar.google.com/calendar/render?${googleParts.join("&")}`,
    outlook: `https://outlook.live.com/calendar/0/deeplink/compose?path=/calendar/action/compose&rru=addevent&startdt=${enc(isoStart)}&enddt=${enc(isoEnd)}&${shared}`,
    office365: `https://outlook.office.com/calendar/0/deeplink/compose?path=/calendar/action/compose&rru=addevent&startdt=${enc(isoStart)}&enddt=${enc(isoEnd)}&${shared}`,
    yahoo: `https://calendar.yahoo.com/?${yahooParts.join("&")}`,
  };
}

export function patientCalendarLinksHtml(links: PatientCalendarLinks): string {
  const buttons: Array<[string, string]> = [
    ["Google Calendar", links.google],
    ["Outlook.com", links.outlook],
    ["Office 365", links.office365],
    ["Yahoo Calendar", links.yahoo],
  ];
  const cells = buttons
    .map(
      ([label, href]) => `
        <td style="padding: 0 8px 8px 0;">
          <a href="${escapeHtml(href)}" target="_blank" style="display: inline-block; padding: 8px 12px; border: 1px solid #0284c7; border-radius: 6px; color: #0284c7; font-size: 13px; font-weight: 600; text-decoration: none;">
            ${escapeHtml(label)}
          </a>
        </td>`
    )
    .join("");

  return `
    <p style="margin: 0 0 8px; font-size: 14px; font-weight: 600; color: #111827;">Add to calendar</p>
    <table role="presentation" cellpadding="0" cellspacing="0" style="margin: 0 0 8px;">
      <tr>${cells}</tr>
    </table>
    <p style="margin: 0 0 16px; font-size: 12px; color: #6b7280; line-height: 1.5;">
      A calendar file is attached for Apple Calendar and Outlook. The buttons open Google Calendar, Outlook.com, Office 365, and Yahoo Calendar.
    </p>`;
}

function methodFor(input: PatientCalendarInput): ICSMethod {
  if (input.method) return input.method;
  if (input.kind === "cancel") return "CANCEL";
  return "REQUEST";
}

export function buildPatientCalendarEvent(
  input: PatientCalendarInput
): PatientCalendarEvent | null {
  const bookingId = input.bookingId.trim();
  if (!bookingId) return null;

  const start = resolveUkAppointmentInstant(input.startTime, input.appointmentDate);
  if (!start) return null;

  let end = input.endTime
    ? resolveUkAppointmentInstant(input.endTime, input.appointmentDate)
    : null;
  const duration = input.durationMinutes;
  if (
    !end &&
    typeof duration === "number" &&
    Number.isFinite(duration) &&
    duration > 0
  ) {
    end = new Date(start.getTime() + duration * 60_000);
  }
  if (!end) end = new Date(start.getTime() + 30 * 60_000);
  if (end.getTime() <= start.getTime()) {
    end = new Date(start.getTime() + 30 * 60_000);
  }

  const doctor = formatDoctorDisplayName(input.doctorName);
  const consultLabel = formatAppointmentType(input.consultationType);
  const title = `${doctor} — ${consultLabel}`;
  const video = isVideoConsult(input.consultationType);
  const inPerson = isInPersonConsult(input.consultationType);
  const place = practiceAddress(input.clinicName, input.address);
  const manageUrl = patientBookingUrl(bookingId, input.appUrl);
  const joinUrl = video ? patientVideoJoinUrl(bookingId, input.appUrl) : null;
  const location = video ? joinUrl || "" : inPerson ? place : "";
  const when = formatAppointmentWindow(start, end);
  const descriptionLines = [
    `${consultLabel} with ${doctor}`,
    when,
    input.bookingNumber ? `Booking ${input.bookingNumber}` : "",
    joinUrl ? `Join video call: ${joinUrl}` : "",
    inPerson && place ? `Address: ${place}` : "",
    `Manage booking: ${manageUrl}`,
  ].filter(Boolean);
  const description = descriptionLines.join("\n");

  const method = methodFor(input);
  const sequence = patientCalendarSequence({
    createdAt: input.createdAt,
    updatedAt: input.updatedAt,
    sequence: input.sequence,
  });
  const uid = patientCalendarUid(bookingId);
  const ics = generateICS({
    title,
    description,
    start,
    end,
    location: location || undefined,
    uid,
    sequence,
    method,
    status: method === "CANCEL" ? "CANCELLED" : "CONFIRMED",
    url: manageUrl,
    dtstamp: input.dtstamp,
    organizerEmail: PATIENT_CALENDAR_ORGANIZER,
    organizerName: "MyDoctors360",
  });

  const links = calendarLinks({
    title,
    details: description,
    location,
    start,
    end,
  });
  const filenameSafe = (input.bookingNumber || bookingId).replace(/[^\w.-]+/g, "-");
  const filename = `booking-${filenameSafe}.ics`;
  const contentType =
    method === "CANCEL"
      ? "text/calendar; method=CANCEL; charset=UTF-8"
      : "text/calendar; method=REQUEST; charset=UTF-8";

  return {
    uid,
    sequence,
    method,
    ics,
    filename,
    contentType,
    attachment: {
      filename,
      content: Buffer.from(ics, "utf8").toString("base64"),
      contentType,
    },
    links,
    linksHtml: method === "CANCEL" ? "" : patientCalendarLinksHtml(links),
    title,
    location,
    description,
    manageUrl,
    joinUrl,
  };
}
