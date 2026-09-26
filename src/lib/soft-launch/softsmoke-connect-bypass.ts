/**
 * Soft Launch Soft CTA — Stripe Connect bypass for one internal smoke doctor.
 *
 * Dr. Vera Softsmoke must reach BookingWizard without a completed Connect
 * account. This is not a Production exception for other doctors. Id, slug,
 * and email must all match. A completed Connect account still uses normal
 * destination Checkout.
 *
 * SOFT_LAUNCH_SOFTSMOKE_CONNECT_BYPASS=0 | false | off forces the bypass off.
 * Any other value, including unset, does not widen the allowlist. Unset keeps
 * the allowlist active so www does not need a new env var.
 *
 * Does not change Connect onboarding, marketplace gating, or clinical
 * surfaces (prescriptions, care plans, symptom chat).
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
 * Nightly credentials cron kill switch for the Softsmoke test doctor.
 *
 * Matched by doctor id only. Slug and email are ignored so a renamed
 * listing cannot widen or shrink the skip.
 *
 * `SOFT_LAUNCH_SOFTSMOKE_CREDENTIALS_SKIP` must be exactly `1` (after trim).
 * Unset, `0`, `true`, and every other value do not skip. This default is
 * the opposite of `SOFT_LAUNCH_SOFTSMOKE_CONNECT_BYPASS`, which stays on
 * unless forced off.
 */
export const SOFTSMOKE_CREDENTIALS_SKIP_ENV =
  "SOFT_LAUNCH_SOFTSMOKE_CREDENTIALS_SKIP";

export const SOFTSMOKE_CREDENTIALS_SKIP_REASON =
  "SOFT_LAUNCH_SOFTSMOKE_CREDENTIALS_SKIP=1; Softsmoke test doctor matched by doctor id";

export function isSoftLaunchSoftsmokeCredentialsSkip(
  doctorId: string | null | undefined
): boolean {
  if (process.env[SOFTSMOKE_CREDENTIALS_SKIP_ENV]?.trim() !== "1") return false;
  return doctorId === SOFT_LAUNCH_SOFTSMOKE_DOCTOR.id;
}

/**
 * Skip the Connect destination charge only when the smoke doctor is
 * allowlisted and Connect is incomplete.
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
