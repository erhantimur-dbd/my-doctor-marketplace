/**
 * Guest checkout account claim — one-click magic session (no password first),
 * with optional set-password as a secondary CTA.
 */

import { createAdminClient } from "@/lib/supabase/admin";
import { sendEmail } from "@/lib/email/client";
import { guestAccountClaimEmail } from "@/lib/email/templates";
import { log } from "@/lib/utils/logger";

export type GuestClaimParams = {
  email: string;
  patientName: string;
  bookingNumber?: string;
  locale?: string;
};

/** Supabase admin generateLink types we use for guest claim */
export type GuestClaimLinkType = "magiclink" | "recovery";

/**
 * Primary claim path: magiclink (session without password).
 * Secondary: recovery (set password).
 */
export function selectGuestClaimLinkType(
  preferred: GuestClaimLinkType = "magiclink"
): GuestClaimLinkType {
  return preferred === "recovery" ? "recovery" : "magiclink";
}

/**
 * After magic link verify, land authenticated on patient bookings.
 */
export function buildGuestMagicRedirectUrl(
  origin: string,
  locale: string = "en"
): string {
  const base = origin.replace(/\/$/, "");
  return `${base}/${locale}/callback?next=/${locale}/dashboard/bookings`;
}

/**
 * Optional set-password recovery path (secondary CTA).
 */
export function buildGuestPasswordRedirectUrl(
  origin: string,
  locale: string = "en"
): string {
  const base = origin.replace(/\/$/, "");
  return `${base}/${locale}/callback?next=/${locale}/reset-password`;
}

/** @deprecated use buildGuestMagicRedirectUrl — kept for tests transitioning */
export function buildGuestClaimRedirectUrl(
  origin: string,
  locale: string = "en"
): string {
  return buildGuestMagicRedirectUrl(origin, locale);
}

/**
 * Pure helper: decide whether a claim email should be sent for a booking row.
 */
export function shouldSendGuestClaimEmail(booking: {
  is_guest?: boolean | null;
  patient_email?: string | null;
}): boolean {
  if (!booking.is_guest) return false;
  const email = (booking.patient_email || "").trim();
  return email.includes("@");
}

/**
 * Whether the claim email should use magic session as the primary CTA.
 */
export function isMagicSessionPrimaryClaim(): boolean {
  return selectGuestClaimLinkType("magiclink") === "magiclink";
}

async function generateActionLink(
  email: string,
  type: GuestClaimLinkType,
  redirectTo: string
): Promise<string | null> {
  const admin = createAdminClient();
  const { data, error } = await admin.auth.admin.generateLink({
    type,
    email,
    options: { redirectTo },
  });
  if (error || !data?.properties?.action_link) {
    log.error("guest claim generateLink failed", { err: error, email, type });
    return null;
  }
  return data.properties.action_link;
}

/**
 * Generate magiclink (primary) + optional recovery link; email one-click claim.
 * Safe to call fire-and-forget; never throws to caller.
 */
export async function sendGuestAccountClaimEmail(
  params: GuestClaimParams
): Promise<{ ok: boolean; error?: string; linkType?: GuestClaimLinkType }> {
  const email = params.email.trim().toLowerCase();
  if (!email.includes("@")) {
    return { ok: false, error: "invalid_email" };
  }

  const locale = params.locale || "en";
  const origin =
    process.env.NEXT_PUBLIC_APP_URL || "https://mydoctors360.com";

  try {
    const primaryType = selectGuestClaimLinkType("magiclink");
    const magicRedirect = buildGuestMagicRedirectUrl(origin, locale);
    let claimUrl = await generateActionLink(email, primaryType, magicRedirect);
    let usedType: GuestClaimLinkType = primaryType;

    // Fallback: if magiclink fails (project settings), recovery still grants access path
    if (!claimUrl) {
      const recoveryRedirect = buildGuestPasswordRedirectUrl(origin, locale);
      claimUrl = await generateActionLink(
        email,
        "recovery",
        recoveryRedirect
      );
      usedType = "recovery";
    }

    if (!claimUrl) {
      return { ok: false, error: "generate_link_failed" };
    }

    // Secondary set-password link only when primary is magic (session first)
    let setPasswordUrl: string | undefined;
    if (usedType === "magiclink") {
      const recoveryRedirect = buildGuestPasswordRedirectUrl(origin, locale);
      setPasswordUrl =
        (await generateActionLink(email, "recovery", recoveryRedirect)) ||
        undefined;
    }

    const { subject, html } = guestAccountClaimEmail({
      patientName: params.patientName || "there",
      claimUrl,
      bookingNumber: params.bookingNumber,
      setPasswordUrl,
      magicSession: usedType === "magiclink",
    });

    await sendEmail({ to: email, subject, html });
    return { ok: true, linkType: usedType };
  } catch (err) {
    log.error("guest claim email error", { err, email });
    return { ok: false, error: "send_failed" };
  }
}
