/**
 * Public "find my booking" match.
 * A miss is always the same sentence, whether the number is unknown,
 * the email does not match, or the input cannot be normalised.
 */

import { formatCurrency } from "@/lib/utils/currency";
import { patientBookingDoctorName } from "@/lib/patient/booking-doctor-embed";
import { normalizeBookingNumber } from "@/lib/booking/booking-number";
import {
  issueManageToken,
  manageLinkUrl,
  type ManageTokenStore,
} from "@/lib/booking/manage-token";

export const FIND_BOOKING_MISS =
  "We couldn't find a booking with those details";

export const FIND_BOOKING_RATE_LIMIT =
  "Too many attempts. Please try again later.";

export const FIND_BOOKING_LIMIT = 5;
export const FIND_BOOKING_WINDOW_MS = 15 * 60 * 1000;

const LONDON = "Europe/London";

const PAID_STATUSES = new Set([
  "confirmed",
  "approved",
  "completed",
  "cancelled_patient",
  "cancelled_doctor",
  "no_show",
  "refunded",
  "rejected",
]);

export type LookupBookingRow = {
  id: string;
  bookingNumber: string;
  appointmentDate: string;
  startTime: string;
  endTime: string | null;
  consultationType: string;
  status: string;
  currency: string;
  totalAmountCents: number;
  paymentMode: string | null;
  depositAmountCents: number | null;
  paidAt: string | null;
  videoRoomUrl: string | null;
  patientEmail: string | null;
  doctorTitle: string | null;
  doctorFirstName: string | null;
  doctorLastName: string | null;
};

export type PublicBookingView = {
  bookingNumber: string;
  dateLabel: string;
  timeLabel: string;
  doctorName: string;
  consultationType: string;
  consultationLabel: string;
  status: string;
  statusLabel: string;
  amountPaidCents: number;
  amountPaidLabel: string;
  currency: string;
  joinUrl: string | null;
  /** Lookup never authorises cancel, reschedule, or any other change. */
  canChangeBooking: false;
};

export type RateLimitFn = (
  key: string,
  limit: number,
  windowMs: number
) => Promise<{ limited: boolean; remaining: number; retryAfterMs: number }>;

export type Mailer = (input: {
  to: string;
  subject: string;
  html: string;
}) => Promise<{ success: boolean; error?: string }>;

export function normalizeLookupEmail(value: string | null | undefined): string {
  return (value ?? "").trim().toLowerCase();
}

export function emailsMatch(
  stored: string | null | undefined,
  submitted: string | null | undefined
): boolean {
  const a = normalizeLookupEmail(stored);
  const b = normalizeLookupEmail(submitted);
  if (!a.includes("@") || !b.includes("@")) return false;
  return a === b;
}

export function findBookingRateKeys(
  ip: string,
  bookingNumber: string
): { ipKey: string; bookingKey: string } {
  const normalized =
    normalizeBookingNumber(bookingNumber) ||
    bookingNumber.trim().toUpperCase().replace(/\s+/g, "") ||
    "invalid";
  const ipPart = ip.trim() || "unknown";
  return {
    ipKey: `find-booking:ip:${ipPart}`,
    bookingKey: `find-booking:ref:${normalized}`,
  };
}

export async function enforceFindBookingRateLimit(
  ip: string,
  bookingNumber: string,
  limitFn: RateLimitFn
): Promise<{ limited: boolean }> {
  const keys = findBookingRateKeys(ip, bookingNumber);
  const [ipResult, bookingResult] = await Promise.all([
    limitFn(keys.ipKey, FIND_BOOKING_LIMIT, FIND_BOOKING_WINDOW_MS),
    limitFn(keys.bookingKey, FIND_BOOKING_LIMIT, FIND_BOOKING_WINDOW_MS),
  ]);
  return { limited: ipResult.limited || bookingResult.limited };
}

export function publicFindBookingUrl(origin?: string, locale = "en"): string {
  const base = (
    origin ||
    process.env.NEXT_PUBLIC_APP_URL ||
    "https://mydoctors360.com"
  ).replace(/\/$/, "");
  return `${base}/${locale}/find-booking`;
}

export function lookupAmountPaidCents(row: LookupBookingRow): number {
  const paid = Boolean(row.paidAt) || PAID_STATUSES.has(row.status);
  if (!paid) return 0;
  if (row.paymentMode === "deposit" && row.depositAmountCents != null) {
    return row.depositAmountCents;
  }
  return row.totalAmountCents;
}

export function lookupJoinUrl(row: LookupBookingRow): string | null {
  if (row.consultationType !== "video") return null;
  if (row.status !== "confirmed" && row.status !== "approved") return null;
  const url = row.videoRoomUrl?.trim();
  return url || null;
}

export function formatLookupWhen(input: {
  appointmentDate: string;
  startTime: string;
  endTime?: string | null;
}): { dateLabel: string; timeLabel: string } {
  const startClock = clockOnly(input.startTime);
  if (startClock && !isAbsoluteTimestamp(input.startTime)) {
    const endClock = input.endTime ? clockOnly(input.endTime) : null;
    return {
      dateLabel: formatCalendarDate(input.appointmentDate),
      timeLabel: `${startClock}${endClock ? `–${endClock}` : ""} (London)`,
    };
  }

  const start = new Date(input.startTime);
  if (Number.isNaN(start.getTime())) {
    return {
      dateLabel: formatCalendarDate(input.appointmentDate),
      timeLabel: "Time unavailable (London)",
    };
  }

  const dateLabel = new Intl.DateTimeFormat("en-GB", {
    timeZone: LONDON,
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(start);
  const timeFmt = new Intl.DateTimeFormat("en-GB", {
    timeZone: LONDON,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  });
  let timeLabel = timeFmt.format(start);
  if (input.endTime && isAbsoluteTimestamp(input.endTime)) {
    const end = new Date(input.endTime);
    if (!Number.isNaN(end.getTime())) {
      timeLabel = `${timeLabel}–${timeFmt.format(end)}`;
    }
  }
  return { dateLabel, timeLabel: `${timeLabel} (London)` };
}

function isAbsoluteTimestamp(value: string): boolean {
  const trimmed = value.trim();
  return trimmed.includes("T") || /[zZ]$|[+-]\d{2}:?\d{2}$/.test(trimmed);
}

function clockOnly(value: string): string | null {
  const match = value.trim().match(/^(\d{2}):(\d{2})/);
  if (!match) return null;
  return `${match[1]}:${match[2]}`;
}

function formatCalendarDate(date: string): string {
  const [year, month, day] = date.split("-").map(Number);
  if (!year || !month || !day) return date;
  const utc = new Date(Date.UTC(year, month - 1, day, 12, 0, 0));
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: "UTC",
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(utc);
}

export function statusLabel(status: string): string {
  return status
    .replace(/_/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export function consultationLabel(type: string): string {
  if (type === "video") return "Video consultation";
  if (type === "in_person") return "In-person consultation";
  return statusLabel(type || "Consultation");
}

export function toPublicBookingView(row: LookupBookingRow): PublicBookingView {
  const when = formatLookupWhen({
    appointmentDate: row.appointmentDate,
    startTime: row.startTime,
    endTime: row.endTime,
  });
  const amountPaidCents = lookupAmountPaidCents(row);
  return {
    bookingNumber: row.bookingNumber,
    dateLabel: when.dateLabel,
    timeLabel: when.timeLabel,
    doctorName: patientBookingDoctorName({
      title: row.doctorTitle,
      profile: {
        first_name: row.doctorFirstName,
        last_name: row.doctorLastName,
      },
    }),
    consultationType: row.consultationType,
    consultationLabel: consultationLabel(row.consultationType),
    status: row.status,
    statusLabel: statusLabel(row.status),
    amountPaidCents,
    amountPaidLabel: formatCurrency(amountPaidCents, row.currency || "GBP"),
    currency: row.currency,
    joinUrl: lookupJoinUrl(row),
    canChangeBooking: false,
  };
}

export type LookupOutcome =
  | { ok: true; booking: PublicBookingView }
  | { ok: false; error: string; rateLimited?: boolean };

export async function performGuestBookingLookup(
  input: { bookingNumber: string; email: string; ip: string },
  deps: {
    limit: RateLimitFn;
    findByNumber: (bookingNumber: string) => Promise<LookupBookingRow | null>;
  }
): Promise<LookupOutcome> {
  const { limited } = await enforceFindBookingRateLimit(
    input.ip,
    input.bookingNumber,
    deps.limit
  );
  if (limited) {
    return { ok: false, error: FIND_BOOKING_RATE_LIMIT, rateLimited: true };
  }

  const bookingNumber = normalizeBookingNumber(input.bookingNumber);
  if (!bookingNumber || !normalizeLookupEmail(input.email).includes("@")) {
    return { ok: false, error: FIND_BOOKING_MISS };
  }

  const row = await deps.findByNumber(bookingNumber);
  if (!row || !emailsMatch(row.patientEmail, input.email)) {
    return { ok: false, error: FIND_BOOKING_MISS };
  }

  return { ok: true, booking: toPublicBookingView(row) };
}

export async function performManageLinkRequest(
  input: {
    bookingNumber: string;
    email: string;
    ip: string;
    origin: string;
    locale: string;
  },
  deps: {
    limit: RateLimitFn;
    findByNumber: (bookingNumber: string) => Promise<LookupBookingRow | null>;
    store: ManageTokenStore;
    send: Mailer;
    now: number;
    buildEmail: (input: {
      bookingNumber: string;
      manageUrl: string;
    }) => { subject: string; html: string };
  }
): Promise<{ ok: true } | { ok: false; error: string; rateLimited?: boolean }> {
  const { limited } = await enforceFindBookingRateLimit(
    input.ip,
    input.bookingNumber,
    deps.limit
  );
  if (limited) {
    return { ok: false, error: FIND_BOOKING_RATE_LIMIT, rateLimited: true };
  }

  const bookingNumber = normalizeBookingNumber(input.bookingNumber);
  if (!bookingNumber || !normalizeLookupEmail(input.email).includes("@")) {
    return { ok: false, error: FIND_BOOKING_MISS };
  }

  const row = await deps.findByNumber(bookingNumber);
  if (!row || !emailsMatch(row.patientEmail, input.email)) {
    return { ok: false, error: FIND_BOOKING_MISS };
  }

  const issued = issueManageToken({ bookingId: row.id, now: deps.now });
  await deps.store.put(issued.hash, issued.record);
  const manageUrl = manageLinkUrl(input.origin, input.locale, issued.token);
  const message = deps.buildEmail({
    bookingNumber: row.bookingNumber,
    manageUrl,
  });
  const sent = await deps.send({
    to: normalizeLookupEmail(row.patientEmail),
    subject: message.subject,
    html: message.html,
  });
  if (!sent.success) {
    return {
      ok: false,
      error: "We couldn't send the manage link. Please try again.",
    };
  }
  return { ok: true };
}
