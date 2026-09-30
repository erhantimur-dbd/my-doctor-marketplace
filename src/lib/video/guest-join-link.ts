import "server-only";

import crypto from "crypto";

import { consultMeetingBounds } from "@/lib/video/meeting-window";
import { safeConsultEmailHref } from "@/lib/video/email-link";

export type ConsultEmailJoinSource = "email" | "confirm" | "guest";

export type ConsultJoinLinkTimes = {
  appointmentDate: string;
  startTime: string;
  endTime: string;
};

const MIN_SECRET_BYTES = 32;

/**
 * Guest links are signed only with CONSULT_JOIN_LINK_SECRET.
 * A missing or short secret fails closed: no signature is emitted and
 * verification returns false. The service role key is never a fallback.
 */
function joinLinkSecret(): Buffer | null {
  const raw = process.env.CONSULT_JOIN_LINK_SECRET;
  if (typeof raw !== "string" || raw.length === 0) return null;
  const bytes = Buffer.from(raw, "utf8");
  if (bytes.length < MIN_SECRET_BYTES) return null;
  return bytes;
}

function linkPayload(bookingId: string, bookingNumber: string, exp: number): string {
  return `v2.patient.${bookingId}.${bookingNumber}.${exp}`;
}

export function parseGuestLinkExp(value: unknown): number | null {
  if (typeof value === "number" && Number.isSafeInteger(value) && value > 0) {
    return value;
  }
  if (typeof value === "string" && /^[1-9]\d{0,15}$/.test(value)) {
    const parsed = Number(value);
    return Number.isSafeInteger(parsed) ? parsed : null;
  }
  return null;
}

/** HMAC for a guest who has the booking email but no session. */
export function signGuestConsultJoin(
  bookingId: string,
  bookingNumber: string,
  times: ConsultJoinLinkTimes
): { sig: string; exp: number } | null {
  const secret = joinLinkSecret();
  const bounds = consultMeetingBounds(times);
  if (!secret || !bounds) return null;
  const sig = crypto
    .createHmac("sha256", secret)
    .update(linkPayload(bookingId, bookingNumber, bounds.exp))
    .digest("base64url");
  return { sig, exp: bounds.exp };
}

export function verifyGuestConsultJoin(input: {
  bookingId: string;
  bookingNumber: string;
  signature: string | null | undefined;
  exp: number | null | undefined;
  times: ConsultJoinLinkTimes;
  now?: Date;
}): boolean {
  const secret = joinLinkSecret();
  if (!secret || !input.signature || input.exp == null) return false;
  const bounds = consultMeetingBounds(input.times);
  if (!bounds || input.exp !== bounds.exp) return false;
  const nowSec = Math.floor((input.now ?? new Date()).getTime() / 1000);
  if (nowSec >= input.exp) return false;

  const expected = crypto
    .createHmac("sha256", secret)
    .update(linkPayload(input.bookingId, input.bookingNumber, input.exp))
    .digest("base64url");
  const actual = Buffer.from(input.signature);
  const want = Buffer.from(expected);
  if (actual.length !== want.length) return false;
  return crypto.timingSafeEqual(actual, want);
}

/**
 * Sign the confirmation join link only when the visitor proved they paid
 * (Stripe Checkout session) or they are the signed-in patient. A bare
 * booking UUID on the direct-confirm URL is not enough.
 */
export function confirmationIncludeGuestSignature(input: {
  lookupMode: string;
  userId?: string | null;
  patientId?: string | null;
}): boolean {
  if (input.lookupMode === "stripe_session") return true;
  return Boolean(input.userId && input.patientId && input.userId === input.patientId);
}

export function consultJoinPagePath(input: {
  bookingId: string;
  bookingNumber: string;
  times?: ConsultJoinLinkTimes;
  source?: ConsultEmailJoinSource;
  includeSignature?: boolean;
}): string {
  const params = new URLSearchParams();
  params.set("src", input.source || "email");
  const include = input.includeSignature !== false;
  if (include && input.times) {
    const signed = signGuestConsultJoin(
      input.bookingId,
      input.bookingNumber,
      input.times
    );
    if (signed) {
      params.set("sig", signed.sig);
      params.set("exp", String(signed.exp));
    }
  }
  return `/join/${input.bookingId}?${params.toString()}`;
}

/** Absolute app URL. Never a Daily room, never a meeting token. */
export function consultJoinPageUrl(input: {
  bookingId: string;
  bookingNumber: string;
  times?: ConsultJoinLinkTimes;
  locale?: string | null;
  source?: ConsultEmailJoinSource;
  origin?: string;
  includeSignature?: boolean;
}): string {
  const origin = (
    input.origin ||
    process.env.NEXT_PUBLIC_APP_URL ||
    "https://mydoctors360.com"
  ).replace(/\/$/, "");
  const locale = input.locale || "en";
  return `${origin}/${locale}${consultJoinPagePath(input)}`;
}

export function confirmationVideoHref(input: {
  consultationType?: string | null;
  videoRoomUrl?: string | null;
  bookingId?: string | null;
  bookingNumber?: string | null;
  appointmentDate?: string | null;
  startTime?: string | null;
  endTime?: string | null;
  locale?: string | null;
  includeSignature?: boolean;
}): string | null {
  const looksVideo =
    /video/i.test(input.consultationType || "") || Boolean(input.videoRoomUrl);
  if (looksVideo && input.bookingId && input.bookingNumber) {
    const times =
      input.appointmentDate && input.startTime && input.endTime
        ? {
            appointmentDate: input.appointmentDate,
            startTime: input.startTime,
            endTime: input.endTime,
          }
        : undefined;
    return consultJoinPageUrl({
      bookingId: input.bookingId,
      bookingNumber: input.bookingNumber,
      times,
      locale: input.locale,
      source: "email",
      includeSignature: input.includeSignature !== false && Boolean(times),
    });
  }
  return safeConsultEmailHref(input.videoRoomUrl);
}
