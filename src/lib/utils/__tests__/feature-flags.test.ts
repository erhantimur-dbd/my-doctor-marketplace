import { describe, expect, it } from "vitest";
import {
  hasFeature,
  isFreeLicenseTier,
  normalizeLicenseTier,
  getFeaturesForTier,
} from "@/lib/utils/feature-flags";

describe("feature-flags free gateway", () => {
  it("treats null/unknown tier as free", () => {
    expect(normalizeLicenseTier(null)).toBe("free");
    expect(normalizeLicenseTier(undefined)).toBe("free");
    expect(normalizeLicenseTier("weird")).toBe("free");
    expect(isFreeLicenseTier(null)).toBe(true);
  });

  it("denies all paid features including AI on free", () => {
    expect(hasFeature("online_bookings", "free")).toBe(false);
    expect(hasFeature("ai_review_summaries", "free")).toBe(false);
    expect(hasFeature("ai_sentiment_tags", "free")).toBe(false);
    expect(hasFeature("video_consultations", "free")).toBe(false);
    expect(hasFeature("stripe_connect", null)).toBe(false);
    expect(getFeaturesForTier("free")).toEqual([]);
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
