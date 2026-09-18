/**
 * Feature flags — tier-based gating for organizations.
 *
 * Founding Free (`free`) is a lifetime Solo Professional perk for founding
 * doctors (value framing £299/mo): same non-clinical Professional
 * entitlements, not a trial. Soft Launch #18 still hard-disables
 * prescriptions, care plans, public chat, symptom analysis, and voice.
 *
 * Missing/unknown license still denies — do not treat unlicensed rows as
 * Founding Free.
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

/**
 * Clinical Professional features. Founding Free never grants these, and
 * Soft Launch #18 hard-disables the surfaces regardless of tier.
 */
export const CLINICAL_FEATURE_KEYS: readonly FeatureKey[] = [
  "treatment_plans",
  "prescriptions",
];

/**
 * Feature matrix — which paid / entitlement tiers unlock which features.
 * Founding Free is not listed here; `hasFeature` maps explicit `free` onto
 * Professional and then subtracts clinical keys.
 */
const FEATURE_MATRIX: Record<FeatureKey, LicenseTier[]> = {
  // Starter+ (core paid marketplace)
  online_bookings: ["starter", "professional", "clinic", "enterprise"],
  video_consultations: ["starter", "professional", "clinic", "enterprise"],
  email_reminders: ["starter", "professional", "clinic", "enterprise"],
  messaging: ["starter", "professional", "clinic", "enterprise"],
  stripe_connect: ["starter", "professional", "clinic", "enterprise"],
  // AI — never unlicensed
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

const KNOWN_TIERS: readonly LicenseTier[] = [
  "free",
  "starter",
  "professional",
  "clinic",
  "enterprise",
];

export function isKnownLicenseTier(
  tier: string | null | undefined
): tier is LicenseTier {
  return !!tier && (KNOWN_TIERS as readonly string[]).includes(tier);
}

/**
 * Normalize missing license to free (gateway) for display / billing labels.
 * Entitlement checks must use `hasFeature` / `resolveEntitlementTier` so
 * unlicensed rows do not inherit Founding Free Professional perks.
 */
export function normalizeLicenseTier(
  tier: string | null | undefined
): LicenseTier {
  if (isKnownLicenseTier(tier)) return tier;
  return "free";
}

/**
 * Map an explicit license row to the entitlement tier used by `hasFeature`.
 * Founding Free → Solo Professional. Null/unknown → no entitlements.
 */
export function resolveEntitlementTier(
  tier: string | null | undefined
): Exclude<LicenseTier, "free"> | null {
  if (tier === "free") return "professional";
  if (
    tier === "starter" ||
    tier === "professional" ||
    tier === "clinic" ||
    tier === "enterprise"
  ) {
    return tier;
  }
  return null;
}

/**
 * Check if a feature is available for the given tier.
 * Explicit Founding Free (`free`) = lifetime non-clinical Professional.
 * Null/unknown tier is denied (not Founding Free).
 */
export function hasFeature(
  feature: FeatureKey,
  tier: string | null | undefined
): boolean {
  const entitlement = resolveEntitlementTier(tier);
  if (!entitlement) return false;

  if (tier === "free" && CLINICAL_FEATURE_KEYS.includes(feature)) {
    return false;
  }

  const allowed = FEATURE_MATRIX[feature];
  if (!allowed) return false;

  return allowed.includes(entitlement);
}

/** True when org is on founding free gateway plan (billing SKU, not entitlements). */
export function isFreeLicenseTier(tier: string | null | undefined): boolean {
  return normalizeLicenseTier(tier) === "free";
}

/** Get all features available for a tier */
export function getFeaturesForTier(tier: string): FeatureKey[] {
  if (!isKnownLicenseTier(tier)) return [];
  return (Object.entries(FEATURE_MATRIX) as [FeatureKey, LicenseTier[]][])
    .filter(([feature]) => hasFeature(feature, tier))
    .map(([key]) => key);
}

/** Get all defined feature keys */
export const FEATURES = Object.keys(FEATURE_MATRIX) as FeatureKey[];
