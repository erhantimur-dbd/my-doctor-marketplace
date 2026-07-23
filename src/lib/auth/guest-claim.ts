/**
 * Guest checkout account claim — generate a recovery/magic link and email it
 * so passwordless shadow users can set a password after booking.
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

/**
 * Build claim redirect URL (callback → reset-password after recovery verify).
 */
export function buildGuestClaimRedirectUrl(
  origin: string,
  locale: string = "en"
): string {
  const base = origin.replace(/\/$/, "");
  // recovery type is verified in callback → /{locale}/reset-password
  return `${base}/${locale}/callback?next=/${locale}/reset-password`;
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
 * Generate Supabase recovery link and send guest claim email.
 * Safe to call fire-and-forget; never throws to caller.
 */
export async function sendGuestAccountClaimEmail(
  params: GuestClaimParams
): Promise<{ ok: boolean; error?: string }> {
  const email = params.email.trim().toLowerCase();
  if (!email.includes("@")) {
    return { ok: false, error: "invalid_email" };
  }

  const locale = params.locale || "en";
  const origin =
    process.env.NEXT_PUBLIC_APP_URL || "https://mydoctors360.com";
  const redirectTo = buildGuestClaimRedirectUrl(origin, locale);

  try {
    const admin = createAdminClient();
    const { data, error } = await admin.auth.admin.generateLink({
      type: "recovery",
      email,
      options: {
        redirectTo,
      },
    });

    if (error || !data?.properties?.action_link) {
      log.error("guest claim generateLink failed", {
        err: error,
        email,
      });
      return { ok: false, error: error?.message || "generate_link_failed" };
    }

    const claimUrl = data.properties.action_link;
    const { subject, html } = guestAccountClaimEmail({
      patientName: params.patientName || "there",
      claimUrl,
      bookingNumber: params.bookingNumber,
    });

    await sendEmail({ to: email, subject, html });
    return { ok: true };
  } catch (err) {
    log.error("guest claim email error", { err, email });
    return { ok: false, error: "send_failed" };
  }
}
