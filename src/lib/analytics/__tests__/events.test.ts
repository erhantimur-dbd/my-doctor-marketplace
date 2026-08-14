import { describe, expect, it } from "vitest";
import { AnalyticsEvent } from "@/lib/analytics/events";

describe("AnalyticsEvent catalog", () => {
  it("uses snake_case event names", () => {
    for (const name of Object.values(AnalyticsEvent)) {
      expect(name).toMatch(/^[a-z][a-z0-9_]*$/);
    }
  });

  it("does not include clinical or identity event names", () => {
    const joined = Object.values(AnalyticsEvent).join(" ");
    expect(joined).not.toMatch(/email|symptom|diagnos|prescri|nhs/i);
  });
});
