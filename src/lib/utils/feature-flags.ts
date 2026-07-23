/**
 * Feature flags — tier-based gating for organizations.
 *
 * Free is a deliberate GTM gateway: listing + profile only.
 * All paid marketplace ops and AI are Starter+.
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
 * Feature matrix — which tiers unlock which features.
 * Free intentionally has an empty set for paid product features.
 */
const FEATURE_MATRIX: Record<FeatureKey, LicenseTier[]> = {
  // Starter+ (core paid marketplace)
  online_bookings: ["starter", "professional", "clinic", "enterprise"],
  video_consultations: ["starter", "professional", "clinic", "enterprise"],
  email_reminders: ["starter", "professional", "clinic", "enterprise"],
  messaging: ["starter", "professional", "clinic", "enterprise"],
  treatment_plans: ["starter", "professional", "clinic", "enterprise"],
  stripe_connect: ["starter", "professional", "clinic", "enterprise"],
  // AI — never free
  ai_review_summaries: ["starter", "professional", "clinic", "enterprise"],
  ai_sentiment_tags: ["starter", "professional", "clinic", "enterprise"],
  // Medical testing: Starter+ with paid addon OR included on clinic+
  medical_testing: ["starter", "professional", "clinic", "enterprise"],

  // Professional+
  prescriptions: ["professional", "clinic", "enterprise"],
  recurring_bookings: ["professional", "clinic", "enterprise"],
  family_dependents: ["professional", "clinic", "enterprise"],
  analytics_dashboard: ["professional", "clinic", "enterprise"],
  whatsapp_notifications: ["professional", "clinic", "enterprise"],
  waitlist_auto_notify: ["professional", "clinic", "enterprise"],

  // Clinic+
  multi_location: ["clinic", "enterprise"],
  team_management: ["clinic", "enterprise"],
  bulk_invoicing: ["clinic", "enterprise"],

  // Enterprise only
  custom_branding: ["enterprise"],
  api_access: ["enterprise"],
  priority_support: ["enterprise"],
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
 * Check if a feature is available for the given tier.
 * Null/unknown tier is treated as free (deny paid features).
 */
export function hasFeature(
  feature: FeatureKey,
  tier: string | null | undefined
): boolean {
  const normalized = normalizeLicenseTier(tier);
  if (normalized === "free") return false;

  const allowed = FEATURE_MATRIX[feature];
  if (!allowed) return false;

  return allowed.includes(normalized);
}

/** True when org is on founding free gateway plan */
export function isFreeLicenseTier(tier: string | null | undefined): boolean {
  return normalizeLicenseTier(tier) === "free";
}

/** Get all features available for a tier */
export function getFeaturesForTier(tier: string): FeatureKey[] {
  const normalized = normalizeLicenseTier(tier);
  if (normalized === "free") return [];
  return (Object.entries(FEATURE_MATRIX) as [FeatureKey, LicenseTier[]][])
    .filter(([, tiers]) => tiers.includes(normalized))
    .map(([key]) => key);
}

/** Get all defined feature keys */
export const FEATURES = Object.keys(FEATURE_MATRIX) as FeatureKey[];
