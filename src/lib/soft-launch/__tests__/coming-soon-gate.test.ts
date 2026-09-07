import { describe, expect, it } from "vitest";
import {
  comingSoonGateApplies,
  isAllowedOnComingSoon,
  isPatientMarketplacePath,
} from "@/lib/soft-launch/coming-soon-gate";

describe("comingSoonGateApplies", () => {
  it("applies on Preview even when host is not a prod Soft Launch domain", () => {
    expect(
      comingSoonGateApplies(
        "mydoctors360-git-cursor-soft-launc.vercel.app",
        "preview"
      )
    ).toBe(true);
  });

  it("applies locally when VERCEL_ENV is unset", () => {
    expect(comingSoonGateApplies("localhost", undefined)).toBe(true);
  });

  it("applies on production Soft Launch hosts", () => {
    expect(comingSoonGateApplies("www.mydoctors360.com", "production")).toBe(
      true
    );
    expect(comingSoonGateApplies("mydoctors360.co.uk", "production")).toBe(
      true
    );
  });

  it("does not apply on production non-Soft-Launch hosts", () => {
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
