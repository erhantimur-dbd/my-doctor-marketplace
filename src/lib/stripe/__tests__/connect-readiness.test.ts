import { describe, expect, it } from "vitest";
import { connectAccountIsReady } from "@/lib/stripe/connect-readiness";

describe("connectAccountIsReady", () => {
  it("is false when only details are submitted", () => {
    expect(
      connectAccountIsReady({
        details_submitted: true,
        charges_enabled: false,
        payouts_enabled: false,
      })
    ).toBe(false);
  });

  it("is false when charges are on but payouts are not", () => {
    expect(
      connectAccountIsReady({
        details_submitted: true,
        charges_enabled: true,
        payouts_enabled: false,
      })
    ).toBe(false);
  });

  it("is true only when charges and payouts are both enabled", () => {
    expect(
      connectAccountIsReady({
        details_submitted: true,
        charges_enabled: true,
        payouts_enabled: true,
      })
    ).toBe(true);
  });
});
