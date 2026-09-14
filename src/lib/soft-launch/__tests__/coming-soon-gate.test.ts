import { describe, expect, it } from "vitest";
import {
  comingSoonGateApplies,
  isAllowedOnComingSoon,
  isPatientMarketplacePath,
} from "@/lib/soft-launch/coming-soon-gate";
import { SOFT_LAUNCH_HIDE_PATIENT_MARKETPLACE_CHROME } from "@/lib/constants/company";

describe("comingSoonGateApplies", () => {
  it("does not apply on any host while Soft Launch chrome is off", () => {
    expect(SOFT_LAUNCH_HIDE_PATIENT_MARKETPLACE_CHROME).toBe(false);
    expect(
      comingSoonGateApplies(
        "mydoctors360-git-cursor-soft-launc.vercel.app",
        "preview"
      )
    ).toBe(false);
    expect(comingSoonGateApplies("localhost", undefined)).toBe(false);
    expect(comingSoonGateApplies("www.mydoctors360.com", "production")).toBe(
      false
    );
    expect(
      comingSoonGateApplies("mydoctors360.vercel.app", "production")
    ).toBe(false);
  });
});

describe("isAllowedOnComingSoon", () => {
  it("allows founding doctor routes", () => {
    expect(isAllowedOnComingSoon("/en/pricing")).toBe(true);
    expect(isAllowedOnComingSoon("/en/how-it-works")).toBe(true);
    expect(isAllowedOnComingSoon("/en/register-doctor")).toBe(true);
    expect(isAllowedOnComingSoon("/en/login")).toBe(true);
  });

  it("does not treat patient marketplace as an allowlisted exception", () => {
    expect(isAllowedOnComingSoon("/en/doctors")).toBe(false);
    expect(isAllowedOnComingSoon("/en/specialties")).toBe(false);
  });
});

describe("isPatientMarketplacePath", () => {
  it("flags Find-a-Doctor and related patient surfaces", () => {
    expect(isPatientMarketplacePath("/en/doctors")).toBe(true);
    expect(isPatientMarketplacePath("/en/doctors/map")).toBe(true);
    expect(isPatientMarketplacePath("/en/specialties/cardiology")).toBe(true);
    expect(isPatientMarketplacePath("/en/conditions")).toBe(true);
    expect(isPatientMarketplacePath("/en/pricing")).toBe(false);
  });
});
