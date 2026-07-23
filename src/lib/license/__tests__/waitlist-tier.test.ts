import { describe, expect, it } from "vitest";
import { doctorTierHasWaitlistAutoNotify } from "@/lib/license/check";

describe("doctorTierHasWaitlistAutoNotify", () => {
  it("allows Pro, clinic, enterprise", () => {
    expect(doctorTierHasWaitlistAutoNotify("professional")).toBe(true);
    expect(doctorTierHasWaitlistAutoNotify("clinic")).toBe(true);
    expect(doctorTierHasWaitlistAutoNotify("enterprise")).toBe(true);
  });

  it("blocks free and starter", () => {
    expect(doctorTierHasWaitlistAutoNotify("free")).toBe(false);
    expect(doctorTierHasWaitlistAutoNotify("starter")).toBe(false);
    expect(doctorTierHasWaitlistAutoNotify(null)).toBe(false);
  });
});
