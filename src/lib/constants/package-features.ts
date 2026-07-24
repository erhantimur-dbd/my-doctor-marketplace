/**
 * Doctor package packaging — single source of truth for marketing include/exclude
 * lists aligned with `hasFeature` enforcement in feature-flags.ts.
 *
 * Seat counts and list prices live on LICENSE_TIERS; capability bullets live here.
 * Annual billing (2 months free) is display-only on pricing UI — do not hardcode
 * annual totals in these strings except via dynamic formatting on the pricing page.
 */

import type { FeatureKey } from "@/lib/utils/feature-flags";
import { hasFeature, type LicenseTier } from "@/lib/utils/feature-flags";

export type PackageMarketing = {
  features: string[];
  excludedFeatures: string[];
};

/**
 * Marketing strings that map to enforced FeatureKeys for consistency tests.
 * If a package lists a string matching `pattern` as included, hasFeature must be
 * true for that tier (and inverse when the bullet is in excludedFeatures).
 */
export const MARKETING_CAPABILITY_CHECKS: {
  pattern: RegExp;
  feature: FeatureKey;
  side: "include" | "exclude" | "both";
}[] = [
  {
    pattern: /online booking|stripe payout/i,
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
    pattern: /email (appointment )?reminder/i,
    feature: "email_reminders",
    side: "both",
  },
  {
    pattern: /stripe connect|payout/i,
    feature: "stripe_connect",
    side: "both",
  },
  {
    pattern: /patient messaging/i,
    feature: "messaging",
    side: "both",
  },
  {
    pattern: /priority support/i,
    feature: "priority_support",
    side: "both",
  },
  {
    pattern: /bulk invoicing/i,
    feature: "bulk_invoicing",
    side: "both",
  },
];

/**
 * Explicit marketing include/exclude per package (doctor-facing language).
 * Inheritance is written out so cards read clearly without “see Starter”.
 *
 * Ladder (enforced):
 *   Free → profile/list only
 *   Starter → bookings, video, email, messaging, AI; testing add-on optional
 *   Professional → multi-channel reminders, analytics, CRM, waitlist (1 doctor)
 *   Clinic → multi-doctor (3–15), multi-location, team, testing included
 *   Enterprise → branding, API, SLA, dedicated AM
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
      "Free forever — no card required",
    ],
    excludedFeatures: [
      "Online bookings & Stripe payouts",
      "Video consultations",
      "Patient messaging",
      "AI review summaries",
      "Email, SMS & WhatsApp reminders",
      "Analytics, waitlist & care plans",
      "Medical testing, multi-location & team tools",
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
      "Advanced analytics dashboard",
      "Waitlist auto-notify",
      "Patient CRM & care plans",
      "Multi-location & team management",
      "Custom branding & API",
    ],
  },
  professional: {
    features: [
      "Everything in Starter",
      "SMS & WhatsApp reminders",
      "Advanced analytics dashboard",
      "Patient CRM",
      "Care plans & prescriptions",
      "Waitlist auto-notify",
      "Priority support",
      "Single doctor seat (solo practice)",
    ],
    excludedFeatures: [
      "Multi-doctor seats (Clinic 3–15)",
      "Multi-location clinic tools",
      "Team management & practice dashboard",
      "Medical testing included (optional +£49/mo add-on)",
      "Custom branding & API (Enterprise)",
    ],
  },
  clinic: {
    features: [
      "Everything in Professional",
      "3 doctor seats included (expand to 15)",
      "Multi-location clinic",
      "Team management & multi-doctor scheduling",
      "Medical testing included (no add-on fee)",
      "Centralised clinic dashboard",
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

    // "Everything in X" inheritance: included bullets may only appear as
    // inheritance for lower tiers — still require explicit capability bullets
    // for paid unlocks when they appear without "Everything".
    if (
      (check.side === "include" || check.side === "both") &&
      inFeatures &&
      !allowed
    ) {
      // Allow inheritance-only lines that don't claim the feature itself
      const claimingLines = marketing.features.filter((f) =>
        check.pattern.test(f)
      );
      const onlyInheritance = claimingLines.every((f) =>
        /^everything in /i.test(f)
      );
      if (!onlyInheritance) {
        errors.push(
          `${tier}: marketing includes "${check.feature}" but hasFeature is false`
        );
      }
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
    const freeClaimsBook = marketing.features.some((f) =>
      /online booking|stripe payout/i.test(f)
    );
    const freeClaimsAi = marketing.features.some((f) =>
      /\bAI\b|review summar/i.test(f)
    );
    if (freeClaimsBook) errors.push("free: must not include online bookings");
    if (freeClaimsAi) errors.push("free: must not include AI");
    if (
      !marketing.excludedFeatures.some((f) =>
        /online booking|stripe payout/i.test(f)
      )
    ) {
      errors.push("free: must list online bookings as excluded");
    }
    if (
      !marketing.excludedFeatures.some((f) => /\bAI\b|review summar/i.test(f))
    ) {
      errors.push("free: must list AI as excluded");
    }
  }

  // Starter must not claim SMS/WhatsApp as included
  if (tier === "starter") {
    const claimsWa = marketing.features.some(
      (f) => /whatsapp/i.test(f) && !/add-on|not included|optional/i.test(f)
    );
    if (claimsWa) {
      errors.push("starter: must not include WhatsApp as a core feature");
    }
  }

  // Clinic must include multi-location and testing included language
  if (tier === "clinic") {
    if (!marketing.features.some((f) => /multi-location/i.test(f))) {
      errors.push("clinic: must list multi-location");
    }
    if (
      !marketing.features.some(
        (f) => /medical testing/i.test(f) && /included/i.test(f)
      )
    ) {
      errors.push("clinic: must list medical testing as included");
    }
  }

  return errors;
}
