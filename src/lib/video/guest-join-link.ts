import crypto from "crypto";

import { safeConsultEmailHref } from "@/lib/video/email-link";

export type ConsultEmailJoinSource = "email" | "confirm" | "guest";

function joinLinkSecret(): string {
  return (
    process.env.CONSULT_JOIN_LINK_SECRET ||
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    ""
  );
}

function payload(bookingId: string, bookingNumber: string): string {
  return `v1.${bookingId}.${bookingNumber}`;
}

/** HMAC for a guest who has the booking email but no session. */
export function signGuestConsultJoin(
  bookingId: string,
  bookingNumber: string
): string | null {
  const secret = joinLinkSecret();
  if (!secret) return null;
  return crypto
    .createHmac("sha256", secret)
    .update(payload(bookingId, bookingNumber))
    .digest("base64url");
}

export function verifyGuestConsultJoin(
  bookingId: string,
  bookingNumber: string,
  signature: string | null | undefined
): boolean {
  if (!signature) return false;
  const expected = signGuestConsultJoin(bookingId, bookingNumber);
  if (!expected) return false;
  const actual = Buffer.from(signature);
  const want = Buffer.from(expected);
  if (actual.length !== want.length) return false;
  return crypto.timingSafeEqual(actual, want);
}

export function consultJoinPagePath(input: {
  bookingId: string;
  bookingNumber: string;
  source?: ConsultEmailJoinSource;
}): string {
  const params = new URLSearchParams();
  params.set("src", input.source || "email");
  const sig = signGuestConsultJoin(input.bookingId, input.bookingNumber);
  if (sig) params.set("sig", sig);
  return `/join/${input.bookingId}?${params.toString()}`;
}

/** Absolute app URL. Never a Daily room, never a meeting token. */
export function consultJoinPageUrl(input: {
  bookingId: string;
  bookingNumber: string;
  locale?: string;
  source?: ConsultEmailJoinSource;
  origin?: string;
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
}): string | null {
  const looksVideo =
    /video/i.test(input.consultationType || "") || Boolean(input.videoRoomUrl);
  if (looksVideo && input.bookingId && input.bookingNumber) {
    return consultJoinPageUrl({
      bookingId: input.bookingId,
      bookingNumber: input.bookingNumber,
      source: "email",
    });
  }
  return safeConsultEmailHref(input.videoRoomUrl);
}
