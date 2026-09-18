/**
 * Feature flags — tier-based gating for organizations.
 *
 * Soft Launch product lock: Founding Free (`tier=free`) is a lifetime
 * Solo Professional perk (thank-you for helping launch). Stored billing
 * identity stays `free` (£0, no Stripe). Capability checks use
 * `getEntitlementTier`, which maps an explicit `free` licence to
 * `professional`. Missing / unknown licences still deny paid features.
 *
 * Soft Launch #18 clinical kill-switch stays fail-closed regardless of
 * these flags (prescriptions, care plans, public chat).
 *
 * Keep in sync with PACKAGE_MARKETING in package-features.ts
 * (tests enforce consistency).
 */

export type LicenseTier =
  | "free"
  | "starter"
  | "professional"
  | "clinic"
  | "enterprise";

export type FeatureKey =
  | "online_bookings"
  | "video_consultations"
  | "email_reminders"
  | "treatment_plans"
  | "prescriptions"
  | "medical_testing"
  | "messaging"
  | "recurring_bookings"
  | "family_dependents"
  | "analytics_dashboard"
  | "custom_branding"
  | "api_access"
  | "priority_support"
  | "multi_location"
  | "team_management"
  | "bulk_invoicing"
  | "whatsapp_notifications"
  | "waitlist_auto_notify"
  | "ai_review_summaries"
  | "ai_sentiment_tags"
  | "stripe_connect";

/** Solo Professional is the entitlement source for Founding Free. */
export const FOUNDING_FREE_ENTITLEMENT_TIER: LicenseTier = "professional";

/** Soft Launch claim value for the Founding Free lifetime perk. */
export const FOUNDING_FREE_CLAIM_VALUE_PENCE = 29900;

/**
 * Feature matrix — which entitlement tiers unlock which features.
 * Founding Free maps onto Professional via getEntitlementTier — do not
 * list `free` here (billing identity ≠ entitlement tier).
 */
const FEATURE_MATRIX: Record<FeatureKey, LicenseTier[]> = {
  // Starter+ (core paid marketplace)
  online_bookings: ["starter", "professional", "clinic", "enterprise"],
  video_consultations: ["starter", "professional", "clinic", "enterprise"],
  email_reminders: ["starter", "professional", "clinic", "enterprise"],
  messaging: ["starter", "professional", "clinic", "enterprise"],
  stripe_connect: ["starter", "professional", "clinic", "enterprise"],
  // AI — Starter+ and Founding Free (via Professional entitlement map)
  ai_review_summaries: ["starter", "professional", "clinic", "enterprise"],
  ai_sentiment_tags: ["starter", "professional", "clinic", "enterprise"],
  // Medical testing: available on paid (addon on Starter/Pro; included Clinic+)
  medical_testing: ["starter", "professional", "clinic", "enterprise"],

  // Professional+ (growth tools)
  treatment_plans: ["professional", "clinic", "enterprise"],
  prescriptions: ["professional", "clinic", "enterprise"],
  recurring_bookings: ["professional", "clinic", "enterprise"],
  family_dependents: ["professional", "clinic", "enterprise"],
  analytics_dashboard: ["professional", "clinic", "enterprise"],
  whatsapp_notifications: ["professional", "clinic", "enterprise"],
  waitlist_auto_notify: ["professional", "clinic", "enterprise"],
  priority_support: ["professional", "clinic", "enterprise"],

  // Clinic+
  multi_location: ["clinic", "enterprise"],
  team_management: ["clinic", "enterprise"],
  bulk_invoicing: ["clinic", "enterprise"],

  // Enterprise only
  custom_branding: ["enterprise"],
  api_access: ["enterprise"],
};

/**
 * Normalize missing license to free (gateway) — do not grant paid features
 * to unlicensed/legacy rows by default.
 */
export function normalizeLicenseTier(
  tier: string | null | undefined
): LicenseTier {
  if (
    tier === "starter" ||
    tier === "professional" ||
    tier === "clinic" ||
    tier === "enterprise" ||
    tier === "free"
  ) {
    return tier;
  }
  return "free";
}

/**
 * Map a stored licence tier to the feature-entitlement tier.
 * Explicit Founding Free (`"free"`) inherits Solo Professional for life.
 * Null / unknown stay on the empty gateway (no paid features).
 */
export function getEntitlementTier(
  tier: string | null | undefined
): LicenseTier {
  if (tier === "free") return FOUNDING_FREE_ENTITLEMENT_TIER;
  return normalizeLicenseTier(tier);
}

/**
 * Check if a feature is available for the given stored licence tier.
 * Explicit `free` = Professional entitlements. Null/unknown deny paid features.
 */
export function hasFeature(
  feature: FeatureKey,
  tier: string | null | undefined
): boolean {
  const entitlement = getEntitlementTier(tier);
  if (entitlement === "free") return false;

  const allowed = FEATURE_MATRIX[feature];
  if (!allowed) return false;

  return allowed.includes(entitlement);
}

/** True when org is on the Founding Free billing plan (£0) or has no paid tier. */
export function isFreeLicenseTier(tier: string | null | undefined): boolean {
  return normalizeLicenseTier(tier) === "free";
}

/**
 * True when an explicit stored licence grants product entitlements
 * (Founding Free lifetime Professional, or any paid plan).
 */
export function hasProductEntitlements(
  tier: string | null | undefined
): boolean {
  return hasFeature("online_bookings", tier);
}

/** Get all features available for a stored licence tier */
export function getFeaturesForTier(tier: string): FeatureKey[] {
  const entitlement = getEntitlementTier(tier);
  if (entitlement === "free") return [];
  return (Object.entries(FEATURE_MATRIX) as [FeatureKey, LicenseTier[]][])
    .filter(([, tiers]) => tiers.includes(entitlement))
    .map(([key]) => key);
}

/** Get all defined feature keys */
export const FEATURES = Object.keys(FEATURE_MATRIX) as FeatureKey[];
