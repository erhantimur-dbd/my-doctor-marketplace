/**
 * Feature flags — simple tier-based gating for organizations.
 *
 * Flags are resolved from the org's license tier. No external service needed.
 * Add new flags here; they are immediately available via `hasFeature()`.
 *
 * Usage:
 *   import { hasFeature, FEATURES } from "@/lib/utils/feature-flags";
 *
 *   // Check in server action:
 *   if (!hasFeature("video_consultations", orgTier)) {
 *     return { error: "Upgrade to access video consultations." };
 *   }
 *
 *   // Check in component (pass tier from server):
 *   {hasFeature("treatment_plans", tier) && <TreatmentPlanSection />}
 */

export type LicenseTier =
  | "free"
  | "starter"
  | "professional"
  | "clinic"
  | "enterprise";

export type FeatureKey =
  | "video_consultations"
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
  | "whatsapp_notifications";

/**
 * Feature matrix — which tiers unlock which features.
 * A feature is available if the org's tier is listed in its array.
 */
const FEATURE_MATRIX: Record<FeatureKey, LicenseTier[]> = {
  // Core features — available to all paid tiers
  video_consultations: ["starter", "professional", "clinic", "enterprise"],
  messaging: ["starter", "professional", "clinic", "enterprise"],
  treatment_plans: ["starter", "professional", "clinic", "enterprise"],

  // Professional+
  prescriptions: ["professional", "clinic", "enterprise"],
  recurring_bookings: ["professional", "clinic", "enterprise"],
  family_dependents: ["professional", "clinic", "enterprise"],
  analytics_dashboard: ["professional", "clinic", "enterprise"],
  whatsapp_notifications: ["professional", "clinic", "enterprise"],

  // Clinic+
  medical_testing: ["clinic", "enterprise"],
  multi_location: ["clinic", "enterprise"],
  team_management: ["clinic", "enterprise"],
  bulk_invoicing: ["clinic", "enterprise"],

  // Enterprise only
  custom_branding: ["enterprise"],
  api_access: ["enterprise"],
  priority_support: ["enterprise"],
};

/**
 * Check if a feature is available for the given tier.
 * Returns true if the tier is included in the feature's allowed tiers.
 * Returns true for null/undefined tier (graceful fallback for legacy doctors).
 */
export function hasFeature(
  feature: FeatureKey,
  tier: string | null | undefined
): boolean {
  // Legacy doctors without org/license — allow all features during transition
  if (!tier) return true;

  const allowed = FEATURE_MATRIX[feature];
  if (!allowed) return false;

  return allowed.includes(tier as LicenseTier);
}

/** Get all features available for a tier */
export function getFeaturesForTier(tier: string): FeatureKey[] {
  return (Object.entries(FEATURE_MATRIX) as [FeatureKey, LicenseTier[]][])
    .filter(([, tiers]) => tiers.includes(tier as LicenseTier))
    .map(([key]) => key);
}

/** Get all defined feature keys */
export const FEATURES = Object.keys(FEATURE_MATRIX) as FeatureKey[];
