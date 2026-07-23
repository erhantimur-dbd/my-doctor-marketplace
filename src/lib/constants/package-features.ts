/**
 * Doctor package packaging — single source of truth for marketing include/exclude
 * lists aligned with `hasFeature` enforcement in feature-flags.ts.
 *
 * Seat counts and pricing stay on LICENSE_TIERS; capability bullets live here.
 */

import type { FeatureKey } from "@/lib/utils/feature-flags";
import { hasFeature, type LicenseTier } from "@/lib/utils/feature-flags";

export type PackageMarketing = {
  features: string[];
  excludedFeatures: string[];
};

/**
 * Marketing strings that map to enforced FeatureKeys for consistency tests.
 * If a package lists a string matching `includePattern` as included, hasFeature
 * must be true for that tier (and inverse for excludePattern in excludedFeatures).
 */
export const MARKETING_CAPABILITY_CHECKS: {
  /** Match against feature bullet text */
  pattern: RegExp;
  feature: FeatureKey;
  /** If true, only check when bullet is in features (include); false = excludedFeatures */
  side: "include" | "exclude" | "both";
}[] = [
  {
    pattern: /online booking/i,
    feature: "online_bookings",
    side: "both",
  },
  {
    pattern: /video consultation/i,
    feature: "video_consultations",
    side: "both",
  },
  {
    pattern: /\bAI\b|review summar/i,
    feature: "ai_review_summaries",
    side: "both",
  },
  {
    pattern: /whatsapp/i,
    feature: "whatsapp_notifications",
    side: "both",
  },
  {
    pattern: /waitlist/i,
    feature: "waitlist_auto_notify",
    side: "both",
  },
  {
    pattern: /analytics/i,
    feature: "analytics_dashboard",
    side: "both",
  },
  {
    pattern: /care plan/i,
    feature: "treatment_plans",
    side: "both",
  },
  {
    pattern: /multi-location|multi location/i,
    feature: "multi_location",
    side: "both",
  },
  {
    pattern: /team management|multi-doctor|multi doctor/i,
    feature: "team_management",
    side: "both",
  },
  {
    pattern: /custom branding/i,
    feature: "custom_branding",
    side: "both",
  },
  {
    pattern: /api access|integrations & api/i,
    feature: "api_access",
    side: "both",
  },
  {
    pattern: /email reminder/i,
    feature: "email_reminders",
    side: "both",
  },
  {
    pattern: /stripe connect|payout/i,
    feature: "stripe_connect",
    side: "both",
  },
];

/**
 * Explicit marketing include/exclude per package (doctor-facing language).
 * Inheritance is written out so cards read clearly without “see Starter”.
 */
export const PACKAGE_MARKETING: Record<
  "free" | "starter" | "professional" | "clinic" | "enterprise",
  PackageMarketing
> = {
  free: {
    features: [
      "Public profile after verification",
      "Practice profile, specialties & languages",
      "Doctor dashboard & completion checklist",
      "Free forever until you upgrade",
    ],
    excludedFeatures: [
      "Online bookings & payments",
      "Video consultations",
      "AI practice insights (review summaries)",
      "Email reminders",
      "SMS & WhatsApp reminders",
      "Analytics dashboard",
      "Waitlist auto-notify",
      "Patient CRM & care plans",
      "Multi-location & team tools",
    ],
  },
  starter: {
    features: [
      "Everything in Founding Free",
      "Online bookings & Stripe payouts",
      "Video consultations",
      "Email appointment reminders",
      "Patient messaging",
      "AI review summaries & sentiment tags",
      "Medical testing add-on available (+£49/mo)",
    ],
    excludedFeatures: [
      "SMS & WhatsApp reminders",
      "Advanced analytics",
      "Waitlist auto-notify",
      "Patient CRM & care plans",
      "Multi-location & team tools",
      "Custom branding",
    ],
  },
  professional: {
    features: [
      "Everything in Starter",
      "1–4 doctor seats (per-user pricing)",
      "SMS & WhatsApp reminders",
      "Advanced analytics dashboard",
      "Patient CRM",
      "Care plans & prescriptions",
      "Waitlist auto-notify",
      "Priority support",
    ],
    excludedFeatures: [
      "Multi-location clinic tools",
      "Team management (5+ seats)",
      "Medical testing included (use add-on)",
      "Custom branding",
      "API access",
    ],
  },
  clinic: {
    features: [
      "Everything in Professional",
      "5 doctor seats included (up to 15)",
      "Multi-location clinic",
      "Team management & multi-doctor scheduling",
      "Medical testing services included",
      "Centralized clinic dashboard",
      "Team performance analytics",
      "Bulk invoicing",
      "3 hours dedicated onboarding",
    ],
    excludedFeatures: [
      "Custom branding (Enterprise)",
      "API access & custom integrations",
      "SLA guarantee",
    ],
  },
  enterprise: {
    features: [
      "Everything in Clinic",
      "15+ doctor profiles & multi-location",
      "Custom branding",
      "API access & custom integrations",
      "Medical testing included",
      "SLA guarantee",
      "Dedicated account manager",
      "Priority support",
    ],
    excludedFeatures: [],
  },
};

export function getPackageMarketing(
  tierId: string
): PackageMarketing | undefined {
  if (tierId in PACKAGE_MARKETING) {
    return PACKAGE_MARKETING[tierId as keyof typeof PACKAGE_MARKETING];
  }
  return undefined;
}

/**
 * Validate marketing lists against hasFeature for a tier.
 * Returns list of human-readable consistency errors (empty = OK).
 */
export function validatePackageMarketingConsistency(
  tier: LicenseTier
): string[] {
  const marketing = getPackageMarketing(tier);
  if (!marketing) return [`No marketing package for tier ${tier}`];

  const errors: string[] = [];

  for (const check of MARKETING_CAPABILITY_CHECKS) {
    const inFeatures = marketing.features.some((f) => check.pattern.test(f));
    const inExcluded = marketing.excludedFeatures.some((f) =>
      check.pattern.test(f)
    );
    const allowed = hasFeature(check.feature, tier);

    if (
      (check.side === "include" || check.side === "both") &&
      inFeatures &&
      !allowed
    ) {
      errors.push(
        `${tier}: marketing includes "${check.feature}" but hasFeature is false`
      );
    }
    if (
      (check.side === "exclude" || check.side === "both") &&
      inExcluded &&
      allowed
    ) {
      errors.push(
        `${tier}: marketing excludes "${check.feature}" but hasFeature is true`
      );
    }
  }

  // Free must never claim bookings or AI
  if (tier === "free") {
    if (!hasFeature("online_bookings", "free")) {
      /* ok */
    }
    const freeClaimsBook = marketing.features.some((f) =>
      /online booking/i.test(f)
    );
    const freeClaimsAi = marketing.features.some((f) =>
      /\bAI\b|review summar/i.test(f)
    );
    if (freeClaimsBook) errors.push("free: must not include online bookings");
    if (freeClaimsAi) errors.push("free: must not include AI");
    if (
      !marketing.excludedFeatures.some((f) => /online booking/i.test(f))
    ) {
      errors.push("free: must list online bookings as excluded");
    }
    if (
      !marketing.excludedFeatures.some((f) => /\bAI\b|review summar/i.test(f))
    ) {
      errors.push("free: must list AI as excluded");
    }
  }

  return errors;
}
