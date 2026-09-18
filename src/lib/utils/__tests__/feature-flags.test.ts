import { describe, expect, it } from "vitest";
import {
  hasFeature,
  isFreeLicenseTier,
  normalizeLicenseTier,
  getFeaturesForTier,
  resolveEntitlementTier,
  CLINICAL_FEATURE_KEYS,
} from "@/lib/utils/feature-flags";

describe("feature-flags free gateway", () => {
  it("treats null/unknown tier as free for display labels only", () => {
    expect(normalizeLicenseTier(null)).toBe("free");
    expect(normalizeLicenseTier(undefined)).toBe("free");
    expect(normalizeLicenseTier("weird")).toBe("free");
    expect(isFreeLicenseTier(null)).toBe(true);
  });

  it("does not grant Founding Free entitlements to unlicensed rows", () => {
    expect(resolveEntitlementTier(null)).toBeNull();
    expect(resolveEntitlementTier(undefined)).toBeNull();
    expect(resolveEntitlementTier("weird")).toBeNull();
    expect(hasFeature("online_bookings", null)).toBe(false);
    expect(hasFeature("ai_review_summaries", undefined)).toBe(false);
    expect(hasFeature("stripe_connect", "weird")).toBe(false);
    expect(getFeaturesForTier("unknown")).toEqual([]);
  });

  it("maps explicit Founding Free to lifetime non-clinical Professional", () => {
    expect(resolveEntitlementTier("free")).toBe("professional");
    expect(hasFeature("online_bookings", "free")).toBe(true);
    expect(hasFeature("ai_review_summaries", "free")).toBe(true);
    expect(hasFeature("ai_sentiment_tags", "free")).toBe(true);
    expect(hasFeature("video_consultations", "free")).toBe(true);
    expect(hasFeature("stripe_connect", "free")).toBe(true);
    expect(hasFeature("waitlist_auto_notify", "free")).toBe(true);
    expect(hasFeature("analytics_dashboard", "free")).toBe(true);
    expect(hasFeature("whatsapp_notifications", "free")).toBe(true);
    expect(hasFeature("priority_support", "free")).toBe(true);
    expect(hasFeature("multi_location", "free")).toBe(false);
    expect(hasFeature("team_management", "free")).toBe(false);
    expect(getFeaturesForTier("free")).toEqual(getFeaturesForTier("professional").filter(
      (f) => !CLINICAL_FEATURE_KEYS.includes(f)
    ));
  });

  it("denies clinical Professional features on Founding Free", () => {
    expect(hasFeature("treatment_plans", "free")).toBe(false);
    expect(hasFeature("prescriptions", "free")).toBe(false);
    expect(hasFeature("treatment_plans", "professional")).toBe(true);
    expect(hasFeature("prescriptions", "professional")).toBe(true);
  });

  it("allows core paid + AI on starter", () => {
    expect(hasFeature("online_bookings", "starter")).toBe(true);
    expect(hasFeature("ai_review_summaries", "starter")).toBe(true);
    expect(hasFeature("video_consultations", "starter")).toBe(true);
    expect(hasFeature("waitlist_auto_notify", "starter")).toBe(false);
  });

  it("allows waitlist and analytics on professional", () => {
    expect(hasFeature("waitlist_auto_notify", "professional")).toBe(true);
    expect(hasFeature("analytics_dashboard", "professional")).toBe(true);
  });
});
