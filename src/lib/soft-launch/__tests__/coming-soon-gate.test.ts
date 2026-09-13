import { describe, expect, it } from "vitest";
import {
  comingSoonGateApplies,
  isAllowedOnComingSoon,
  isPatientMarketplacePath,
} from "@/lib/soft-launch/coming-soon-gate";

describe("comingSoonGateApplies", () => {
  it("applies on every host while Soft Launch chrome is on (Preview FAIL)", () => {
    expect(
      comingSoonGateApplies(
        "mydoctors360-git-cursor-soft-launc.vercel.app",
        "preview"
      )
    ).toBe(true);
    expect(comingSoonGateApplies("localhost", undefined)).toBe(true);
    expect(comingSoonGateApplies("www.mydoctors360.com", "production")).toBe(
      true
    );
    // Flag is compile-time true — do not leave Preview live if VERCEL_ENV inlines
    expect(
      comingSoonGateApplies("mydoctors360.vercel.app", "production")
    ).toBe(true);
  });
});

describe("isAllowedOnComingSoon", () => {
  it("allows founding doctor routes", () => {
    expect(isAllowedOnComingSoon("/en/pricing")).toBe(true);
    expect(isAllowedOnComingSoon("/en/how-it-works")).toBe(true);
    expect(isAllowedOnComingSoon("/en/register-doctor")).toBe(true);
    expect(isAllowedOnComingSoon("/en/login")).toBe(true);
    expect(isAllowedOnComingSoon("/en/invite")).toBe(true);
    expect(isAllowedOnComingSoon("/en/invite/dentistry")).toBe(true);
    expect(isAllowedOnComingSoon("/en/invite/" + "a".repeat(64))).toBe(true);
    expect(isAllowedOnComingSoon("/en/invite/accept/" + "b".repeat(64))).toBe(
      true
    );
  });

  it("does not allow patient marketplace / search", () => {
    expect(isAllowedOnComingSoon("/en/doctors")).toBe(false);
    expect(isAllowedOnComingSoon("/en/doctors/dr-jane")).toBe(false);
    expect(isAllowedOnComingSoon("/en/specialties")).toBe(false);
    expect(isAllowedOnComingSoon("/en/conditions")).toBe(false);
    expect(isAllowedOnComingSoon("/en/blog")).toBe(false);
    expect(isAllowedOnComingSoon("/en")).toBe(false);
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

describe("Preview marketplace must rewrite to coming-soon", () => {
  it("gates /en/doctors on Preview (live directory FAIL)", () => {
    const previewHost = "preview.vercel.app";
    expect(comingSoonGateApplies(previewHost, "preview")).toBe(true);
    expect(isAllowedOnComingSoon("/en/doctors")).toBe(false);
    expect(isPatientMarketplacePath("/en/doctors")).toBe(true);
  });
});
