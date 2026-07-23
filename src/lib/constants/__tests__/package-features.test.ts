import { describe, expect, it } from "vitest";
import {
  PACKAGE_MARKETING,
  getPackageMarketing,
  validatePackageMarketingConsistency,
} from "@/lib/constants/package-features";
import { LICENSE_TIERS } from "@/lib/constants/license-tiers";
import {
  hasFeature,
  getFeaturesForTier,
  type LicenseTier,
} from "@/lib/utils/feature-flags";

const TIERS: LicenseTier[] = [
  "free",
  "starter",
  "professional",
  "clinic",
  "enterprise",
];

describe("hasFeature matrix (enforcement)", () => {
  it("free denies bookings, video, AI, WhatsApp, analytics, waitlist", () => {
    expect(hasFeature("online_bookings", "free")).toBe(false);
    expect(hasFeature("video_consultations", "free")).toBe(false);
    expect(hasFeature("ai_review_summaries", "free")).toBe(false);
    expect(hasFeature("whatsapp_notifications", "free")).toBe(false);
    expect(hasFeature("analytics_dashboard", "free")).toBe(false);
    expect(hasFeature("waitlist_auto_notify", "free")).toBe(false);
    expect(getFeaturesForTier("free")).toEqual([]);
  });

  it("starter allows bookings, video, AI, email; denies WhatsApp, waitlist, analytics, care plans", () => {
    expect(hasFeature("online_bookings", "starter")).toBe(true);
    expect(hasFeature("video_consultations", "starter")).toBe(true);
    expect(hasFeature("ai_review_summaries", "starter")).toBe(true);
    expect(hasFeature("email_reminders", "starter")).toBe(true);
    expect(hasFeature("whatsapp_notifications", "starter")).toBe(false);
    expect(hasFeature("waitlist_auto_notify", "starter")).toBe(false);
    expect(hasFeature("analytics_dashboard", "starter")).toBe(false);
    expect(hasFeature("treatment_plans", "starter")).toBe(false);
  });

  it("professional allows waitlist, analytics, WhatsApp, care plans", () => {
    expect(hasFeature("waitlist_auto_notify", "professional")).toBe(true);
    expect(hasFeature("analytics_dashboard", "professional")).toBe(true);
    expect(hasFeature("whatsapp_notifications", "professional")).toBe(true);
    expect(hasFeature("treatment_plans", "professional")).toBe(true);
    expect(hasFeature("multi_location", "professional")).toBe(false);
  });

  it("clinic allows multi-location and team; enterprise allows branding/API", () => {
    expect(hasFeature("multi_location", "clinic")).toBe(true);
    expect(hasFeature("team_management", "clinic")).toBe(true);
    expect(hasFeature("custom_branding", "clinic")).toBe(false);
    expect(hasFeature("custom_branding", "enterprise")).toBe(true);
    expect(hasFeature("api_access", "enterprise")).toBe(true);
  });
});

describe("package marketing lists", () => {
  it("every sellable tier has marketing include/exclude lists", () => {
    for (const tier of TIERS) {
      const m = getPackageMarketing(tier);
      expect(m, tier).toBeDefined();
      expect(m!.features.length).toBeGreaterThan(0);
      if (tier === "enterprise") {
        expect(m!.excludedFeatures.length).toBe(0);
      } else {
        expect(m!.excludedFeatures.length).toBeGreaterThan(0);
      }
    }
  });

  it("LICENSE_TIERS features match PACKAGE_MARKETING (pricing source of truth)", () => {
    for (const tier of LICENSE_TIERS) {
      const m = PACKAGE_MARKETING[tier.id as keyof typeof PACKAGE_MARKETING];
      if (!m) continue;
      expect(tier.features).toEqual(m.features);
      expect(tier.excludedFeatures ?? []).toEqual(m.excludedFeatures);
    }
  });

  it("marketing is consistent with hasFeature for every tier", () => {
    for (const tier of TIERS) {
      const errors = validatePackageMarketingConsistency(tier);
      expect(errors, `${tier}: ${errors.join("; ")}`).toEqual([]);
    }
  });
});
