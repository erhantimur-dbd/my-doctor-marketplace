import { describe, expect, it } from "vitest";
import {
  computeCancellationRefundPercent,
  hoursUntilAppointmentStart,
  refundPercentForCancellationPolicy,
} from "@/lib/booking/cancellation-refund";

describe("hoursUntilAppointmentStart", () => {
  it("uses ISO timestamptz start_time without corrupting via date concat", () => {
    const now = new Date("2026-09-29T10:00:00.000Z");
    const hours = hoursUntilAppointmentStart(
      "2026-09-29",
      "2026-09-29T14:00:00.000Z",
      now
    );
    expect(hours).toBe(4);
  });

  it("supports time-only start values", () => {
    const now = new Date("2026-09-29T08:00:00.000");
    const hours = hoursUntilAppointmentStart(
      "2026-09-29",
      "12:00:00",
      now
    );
    expect(hours).toBe(4);
  });
});

describe("refundPercentForCancellationPolicy", () => {
  it("applies flexible / moderate / strict thresholds", () => {
    expect(refundPercentForCancellationPolicy("flexible", 25)).toBe(100);
    expect(refundPercentForCancellationPolicy("flexible", 10)).toBe(0);

    expect(refundPercentForCancellationPolicy("moderate", 49)).toBe(100);
    expect(refundPercentForCancellationPolicy("moderate", 30)).toBe(50);
    expect(refundPercentForCancellationPolicy("moderate", 10)).toBe(0);

    expect(refundPercentForCancellationPolicy("strict", 73)).toBe(100);
    expect(refundPercentForCancellationPolicy("strict", 71)).toBe(0);
  });

  it("returns 0 for invalid hours or unknown policy", () => {
    expect(refundPercentForCancellationPolicy("flexible", Number.NaN)).toBe(0);
    expect(refundPercentForCancellationPolicy("unknown", 100)).toBe(0);
  });
});

describe("computeCancellationRefundPercent", () => {
  it("returns both hours and percent for an ISO start", () => {
    const now = new Date("2026-09-20T10:00:00.000Z");
    const result = computeCancellationRefundPercent(
      "2026-09-29",
      "2026-09-29T10:00:00.000Z",
      "flexible",
      now
    );
    expect(result.hoursUntil).toBe(9 * 24);
    expect(result.refundPercent).toBe(100);
  });
});
