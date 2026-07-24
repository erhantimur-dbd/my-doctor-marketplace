/**
 * Pure helpers for doctor package signup + upgrade decisions.
 * Single source for “which licence row wins” and whether paid Checkout is allowed.
 */

export const ACTIVE_LICENSE_STATUSES = [
  "active",
  "trialing",
  "past_due",
] as const;

export type ActiveLicenseStatus = (typeof ACTIVE_LICENSE_STATUSES)[number];

/** Higher = more capable package (used to pick effective row and allow upgrades). */
export const TIER_RANK: Record<string, number> = {
  free: 0,
  starter: 1,
  professional: 2,
  clinic: 3,
  enterprise: 4,
};

export type LicenseLike = {
  id?: string;
  tier: string;
  status: string;
  stripe_subscription_id?: string | null;
  created_at?: string | null;
};

export function isActiveLicenseStatus(
  status: string | null | undefined
): boolean {
  return (
    !!status &&
    (ACTIVE_LICENSE_STATUSES as readonly string[]).includes(status)
  );
}

export function isPaidTier(tier: string | null | undefined): boolean {
  if (!tier || tier === "free") return false;
  return tier in TIER_RANK;
}

/**
 * Prefer highest paid active tier; among ties, newest row.
 * Ensures a leftover free row never shadows a paid licence after upgrade.
 */
export function pickEffectiveLicense<T extends LicenseLike>(
  licenses: T[]
): T | null {
  const active = licenses.filter((l) => isActiveLicenseStatus(l.status));
  if (active.length === 0) return null;

  active.sort((a, b) => {
    const rankDiff = (TIER_RANK[b.tier] ?? -1) - (TIER_RANK[a.tier] ?? -1);
    if (rankDiff !== 0) return rankDiff;
    const ta = a.created_at ? Date.parse(a.created_at) : 0;
    const tb = b.created_at ? Date.parse(b.created_at) : 0;
    return tb - ta;
  });

  return active[0] ?? null;
}

export type PaidCheckoutMode =
  | "new"
  | "upgrade_from_free"
  | "upgrade_paid"
  | "blocked";

export function resolvePaidCheckoutMode(
  currentLicenses: LicenseLike[],
  targetTier: string
): {
  mode: PaidCheckoutMode;
  reason?: string;
  current?: LicenseLike;
} {
  if (!targetTier || targetTier === "free") {
    return { mode: "blocked", reason: "Free tier does not require checkout" };
  }
  if (!(targetTier in TIER_RANK)) {
    return { mode: "blocked", reason: "Invalid plan" };
  }

  const effective = pickEffectiveLicense(currentLicenses);
  if (!effective) {
    return { mode: "new" };
  }

  if (effective.tier === "free") {
    return { mode: "upgrade_from_free", current: effective };
  }

  if (effective.tier === targetTier) {
    return {
      mode: "blocked",
      reason: "You are already on this plan",
      current: effective,
    };
  }

  const currentRank = TIER_RANK[effective.tier] ?? 0;
  const targetRank = TIER_RANK[targetTier] ?? 0;
  if (targetRank <= currentRank) {
    return {
      mode: "blocked",
      reason:
        "To downgrade or change seats, use Manage Billing in the Stripe portal",
      current: effective,
    };
  }

  return { mode: "upgrade_paid", current: effective };
}

/** Online bookings require an active paid licence (not free gateway). */
export function licenseAllowsOnlineBookings(
  tier: string | null | undefined,
  status: string | null | undefined
): boolean {
  if (!isPaidTier(tier)) return false;
  return isActiveLicenseStatus(status);
}

/**
 * After a paid subscription activates, free gateway rows for the org must not
 * remain active (webhook upserts on stripe_subscription_id leave free rows).
 */
export function freeLicensesToSupersede(
  licenses: LicenseLike[],
  paidSubscriptionOrgId: string
): LicenseLike[] {
  void paidSubscriptionOrgId;
  return licenses.filter(
    (l) => l.tier === "free" && isActiveLicenseStatus(l.status)
  );
}
