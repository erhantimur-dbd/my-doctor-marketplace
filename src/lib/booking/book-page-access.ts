/**
 * Pre-wizard gate for /doctors/[slug]/book.
 *
 * Explicit Founding Free (`tier=free`, active/trialing/past_due) is lifetime
 * Solo Professional: `licenseAllowsOnlineBookings` is true via
 * `hasFeature("online_bookings")`. Do not hard-block on stored tier=free.
 *
 * Null, unknown, or inactive licences are not Founding Free
 * (`hasFeature(*, null)` is false) and stay `plan_blocked`.
 *
 * Unverified or inactive doctors stay `unavailable`.
 * Connect-incomplete doctors stay `payment_pending`. Softsmoke is Founding
 * Free with incomplete Connect, so she still hits that existing wall until
 * a later product choice bypasses Connect or switches the smoke doctor.
 */

import {
  licenseAllowsOnlineBookings,
  pickEffectiveLicense,
  type LicenseLike,
} from "@/lib/license/tier-lifecycle";

export type BookPageAccess =
  | "wizard"
  | "plan_blocked"
  | "unavailable"
  | "payment_pending";

export type BookPageDoctorGate = {
  isActive: boolean;
  verificationStatus: string | null | undefined;
  stripeAccountId: string | null | undefined;
  stripeOnboardingComplete: boolean | null | undefined;
  licenses: LicenseLike[] | null | undefined;
};

export function resolveBookPageAccess(
  doctor: BookPageDoctorGate
): BookPageAccess {
  const effective = pickEffectiveLicense(doctor.licenses ?? []);
  if (
    !effective ||
    !licenseAllowsOnlineBookings(effective.tier, effective.status)
  ) {
    return "plan_blocked";
  }

  if (doctor.verificationStatus !== "verified" || !doctor.isActive) {
    return "unavailable";
  }

  const connectReady =
    !!doctor.stripeAccountId && !!doctor.stripeOnboardingComplete;
  if (!connectReady) {
    return "payment_pending";
  }

  return "wizard";
}
