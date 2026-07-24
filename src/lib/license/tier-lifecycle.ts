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
  cancel_at_period_end?: boolean | null;
  current_period_end?: string | null;
  metadata?: Record<string, unknown> | null;
};

/** Stripe / local metadata keys for scheduled downgrades (no mid-period price cut). */
export const PENDING_TIER_META = "pending_tier";
export const PENDING_CHANGE_META = "pending_change";

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
  if (targetRank < currentRank) {
    // Immediate Checkout/update is wrong for downgrades — schedule at period end
    return {
      mode: "blocked",
      reason:
        "Downgrades take effect at the end of your paid period. Use Switch Plan to schedule.",
      current: effective,
    };
  }

  return { mode: "upgrade_paid", current: effective };
}

export type PlanChangeMode =
  | "upgrade_now"
  | "schedule_downgrade"
  | "already_on_plan"
  | "blocked";

/**
 * Self-service plan change: upgrades apply now; downgrades (incl. to free)
 * are scheduled for period end — no pro-rata refunds / no mid-period feature cut.
 */
export function resolvePlanChange(
  currentLicenses: LicenseLike[],
  targetTier: string
): {
  mode: PlanChangeMode;
  reason?: string;
  current?: LicenseLike;
} {
  if (!(targetTier in TIER_RANK)) {
    return { mode: "blocked", reason: "Invalid plan" };
  }

  const effective = pickEffectiveLicense(currentLicenses);

  if (!effective) {
    if (targetTier === "free") {
      return { mode: "already_on_plan", reason: "No paid plan to change" };
    }
    return { mode: "upgrade_now" };
  }

  if (effective.tier === targetTier) {
    return {
      mode: "already_on_plan",
      reason: "You are already on this plan",
      current: effective,
    };
  }

  const currentRank = TIER_RANK[effective.tier] ?? 0;
  const targetRank = TIER_RANK[targetTier] ?? 0;

  if (targetRank > currentRank) {
    return { mode: "upgrade_now", current: effective };
  }

  // Downgrade (paid→lower paid or paid→free)
  if (!isPaidTier(effective.tier) && targetTier === "free") {
    return {
      mode: "already_on_plan",
      reason: "You are already on Founding Free",
      current: effective,
    };
  }

  if (!isPaidTier(effective.tier)) {
    return {
      mode: "blocked",
      reason: "Only paid plans can schedule a downgrade",
      current: effective,
    };
  }

  return { mode: "schedule_downgrade", current: effective };
}

export type PendingPlanChange = {
  targetTier: string;
  /** ISO date when change applies (period end), if known */
  effectiveAt: string | null;
  kind: "cancel_to_free" | "downgrade_paid";
};

/**
 * Read pending downgrade from cancel_at_period_end and/or metadata.pending_tier.
 * Features stay on current tier until effectiveAt.
 */
export function getPendingPlanChange(
  license: LicenseLike | null | undefined
): PendingPlanChange | null {
  if (!license || !isPaidTier(license.tier)) return null;

  const meta = license.metadata || {};
  const pendingTier =
    typeof meta[PENDING_TIER_META] === "string"
      ? (meta[PENDING_TIER_META] as string)
      : null;
  const periodEnd = license.current_period_end || null;

  if (license.cancel_at_period_end) {
    return {
      targetTier: "free",
      effectiveAt: periodEnd,
      kind: "cancel_to_free",
    };
  }

  if (pendingTier && pendingTier in TIER_RANK && pendingTier !== license.tier) {
    const pendingRank = TIER_RANK[pendingTier] ?? 0;
    const currentRank = TIER_RANK[license.tier] ?? 0;
    if (pendingRank < currentRank) {
      return {
        targetTier: pendingTier,
        effectiveAt: periodEnd,
        kind: "downgrade_paid",
      };
    }
  }

  return null;
}

/** Paid features remain until status leaves active set (even if cancel_at_period_end). */
export function paidFeaturesActiveDuringCancel(
  license: LicenseLike | null | undefined
): boolean {
  if (!license) return false;
  return (
    isPaidTier(license.tier) && isActiveLicenseStatus(license.status)
  );
}

/** Shape for free gateway row after paid subscription ends. */
export function buildFreeGatewayLicenseInsert(organizationId: string): {
  organization_id: string;
  tier: "free";
  status: "active";
  max_seats: number;
  used_seats: number;
  current_period_start: string;
  current_period_end: string;
  cancel_at_period_end: boolean;
  stripe_subscription_id: null;
} {
  return {
    organization_id: organizationId,
    tier: "free",
    status: "active",
    max_seats: 1,
    used_seats: 1,
    current_period_start: new Date().toISOString(),
    current_period_end: "2099-12-31T23:59:59.000Z",
    cancel_at_period_end: false,
    stripe_subscription_id: null,
  };
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
