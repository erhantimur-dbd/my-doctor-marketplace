/**
 * Soft Launch Soft CTA — Stripe Connect bypass for one internal smoke doctor.
 *
 * Dr. Vera Softsmoke is the Founding Free book deep-link. She must reach
 * BookingWizard without a live Connect account. Every other doctor stays on
 * the payment-pending wall.
 *
 * Gate is an explicit id + slug + email allowlist. It does not open Connect
 * for the marketplace, and it does not lift clinical dark, specialty invites,
 * billing crons, or outbound (SMS / WhatsApp / WABA).
 *
 * SOFT_LAUNCH_SOFTSMOKE_CONNECT_BYPASS=0 | false | off forces the bypass off.
 * Unset (production www default) keeps the allowlist active so no new
 * production env var is required.
 */

export const SOFT_LAUNCH_SOFTSMOKE_DOCTOR = {
  id: "8a9b6ac9-f6f1-4b6a-b108-837a704444dc",
  slug: "dr-vera-softsmoke-i6jv",
  email: "dbd.demo.email@gmail.com",
} as const;

export function isSoftLaunchSoftsmokeConnectBypassEnabled(): boolean {
  const flag = process.env.SOFT_LAUNCH_SOFTSMOKE_CONNECT_BYPASS
    ?.trim()
    .toLowerCase();
  return flag !== "0" && flag !== "false" && flag !== "off";
}

export function readJoinedProfileEmail(profile: unknown): string | null {
  const row = Array.isArray(profile) ? profile[0] : profile;
  if (!row || typeof row !== "object" || !("email" in row)) return null;
  const email = (row as { email?: unknown }).email;
  return typeof email === "string" ? email : null;
}

export function isSoftLaunchSoftsmokeDoctor(doctor: {
  id?: string | null;
  slug?: string | null;
  email?: string | null;
}): boolean {
  const email = doctor.email?.trim().toLowerCase() ?? "";
  return (
    doctor.id === SOFT_LAUNCH_SOFTSMOKE_DOCTOR.id &&
    doctor.slug === SOFT_LAUNCH_SOFTSMOKE_DOCTOR.slug &&
    email === SOFT_LAUNCH_SOFTSMOKE_DOCTOR.email
  );
}

/** True only for the allowlisted smoke doctor while the bypass is not forced off. */
export function allowsSoftLaunchSoftsmokeConnectBypass(doctor: {
  id?: string | null;
  slug?: string | null;
  email?: string | null;
}): boolean {
  if (!isSoftLaunchSoftsmokeConnectBypassEnabled()) return false;
  return isSoftLaunchSoftsmokeDoctor(doctor);
}

/**
 * Skip the Connect destination charge only when the smoke doctor is
 * allowlisted and Connect is incomplete. A completed Connect account
 * still uses the normal Checkout path.
 */
export function isSoftsmokeConnectChargeSkipped(doctor: {
  id?: string | null;
  slug?: string | null;
  email?: string | null;
  stripeAccountId?: string | null;
  stripeOnboardingComplete?: boolean | null;
}): boolean {
  const connectReady =
    !!doctor.stripeAccountId && !!doctor.stripeOnboardingComplete;
  if (connectReady) return false;
  return allowsSoftLaunchSoftsmokeConnectBypass(doctor);
}
