import { describe, expect, it } from "vitest";
import {
  hasFeature,
  isFreeLicenseTier,
  normalizeLicenseTier,
  getFeaturesForTier,
  getEntitlementTier,
  hasProductEntitlements,
  FOUNDING_FREE_ENTITLEMENT_TIER,
  FOUNDING_FREE_CLAIM_VALUE_PENCE,
} from "@/lib/utils/feature-flags";

describe("feature-flags free gateway", () => {
  it("treats null/unknown tier as free billing identity", () => {
    expect(normalizeLicenseTier(null)).toBe("free");
    expect(normalizeLicenseTier(undefined)).toBe("free");
    expect(normalizeLicenseTier("weird")).toBe("free");
    expect(isFreeLicenseTier(null)).toBe(true);
  });

  it("maps explicit Founding Free to lifetime Professional entitlements", () => {
    expect(FOUNDING_FREE_ENTITLEMENT_TIER).toBe("professional");
    expect(FOUNDING_FREE_CLAIM_VALUE_PENCE).toBe(29900);
    expect(getEntitlementTier("free")).toBe("professional");
    expect(getEntitlementTier(null)).toBe("free");
    expect(hasFeature("online_bookings", "free")).toBe(true);
    expect(hasFeature("ai_review_summaries", "free")).toBe(true);
    expect(hasFeature("ai_sentiment_tags", "free")).toBe(true);
    expect(hasFeature("video_consultations", "free")).toBe(true);
    expect(hasFeature("waitlist_auto_notify", "free")).toBe(true);
    expect(hasFeature("analytics_dashboard", "free")).toBe(true);
    expect(hasFeature("multi_location", "free")).toBe(false);
    expect(hasFeature("stripe_connect", null)).toBe(false);
    expect(hasProductEntitlements("free")).toBe(true);
    expect(hasProductEntitlements(null)).toBe(false);
    expect(getFeaturesForTier("free")).toEqual(
      getFeaturesForTier("professional")
    );
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
