import { describe, expect, it } from "vitest";
import { stripeDisputeClosedAt } from "../connect-event-handlers";

describe("stripeDisputeClosedAt", () => {
  const now = "2026-10-02T12:00:00.000Z";

  it("leaves the clock unset while the dispute is open", () => {
    expect(stripeDisputeClosedAt("needs_response", null, now)).toBeUndefined();
    expect(stripeDisputeClosedAt("under_review", null, now)).toBeUndefined();
    expect(stripeDisputeClosedAt("warning_needs_response", null, now)).toBeUndefined();
    expect(stripeDisputeClosedAt("warning_under_review", null, now)).toBeUndefined();
  });

  it("sets closed_at once and does not move it", () => {
    expect(stripeDisputeClosedAt("lost", null, now)).toBe(now);
    expect(stripeDisputeClosedAt("won", "2020-01-01T00:00:00.000Z", now)).toBe(
      "2020-01-01T00:00:00.000Z"
    );
  });
});
