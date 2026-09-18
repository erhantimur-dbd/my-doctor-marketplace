import { describe, expect, it } from "vitest";
import {
  FOUNDING_FREE_LICENSE_TITLE,
  FOUNDING_FREE_LICENSE_VALUE_LINE,
} from "@/lib/constants/company";
import {
  formatDoctorLicensePeriodLine,
  formatDoctorLicensePlanName,
  formatDoctorLicenseTitle,
  isFoundingFreeLicense,
  isFoundingFreeSentinelPeriodEnd,
} from "@/lib/license/display";

describe("Founding Free doctor licence display", () => {
  const founding = {
    tier: "free",
    current_period_end: "2099-12-31T23:59:59.000Z",
    metadata: { founding_free: true, perk: "lifetime" },
  };

  it("treats stored free billing identity as Founding Free", () => {
    expect(isFoundingFreeLicense(founding)).toBe(true);
    expect(isFoundingFreeLicense({ tier: "starter" })).toBe(false);
    expect(isFoundingFreeLicense({ tier: "professional" })).toBe(false);
    expect(isFoundingFreeLicense(null)).toBe(false);
    expect(isFoundingFreeLicense({ tier: null })).toBe(false);
  });

  it("detects the 2099 lifetime sentinel without treating real period ends as lifetime", () => {
    expect(isFoundingFreeSentinelPeriodEnd(founding.current_period_end)).toBe(
      true
    );
    expect(isFoundingFreeSentinelPeriodEnd("2027-03-01T00:00:00.000Z")).toBe(
      false
    );
    expect(isFoundingFreeSentinelPeriodEnd(null)).toBe(false);
  });

  it("shows lifetime Founding Free + value £299/mo, not Free License through 2099", () => {
    expect(formatDoctorLicenseTitle(founding)).toBe(FOUNDING_FREE_LICENSE_TITLE);
    expect(formatDoctorLicenseTitle(founding)).toBe("lifetime Founding Free");
    expect(formatDoctorLicensePeriodLine(founding)).toBe(
      FOUNDING_FREE_LICENSE_VALUE_LINE
    );
    expect(formatDoctorLicensePeriodLine(founding)).toMatch(/value £299\/mo/);
    expect(formatDoctorLicensePeriodLine(founding)).toMatch(
      /Founding Free £0, no card/
    );
    expect(formatDoctorLicensePeriodLine(founding)).not.toMatch(/2099/);
    expect(formatDoctorLicensePeriodLine(founding)).not.toMatch(/Period ends/);
    expect(formatDoctorLicensePeriodLine(founding)).not.toMatch(/free forever/i);
    expect(formatDoctorLicenseTitle(founding)).not.toMatch(/Free License/i);
    expect(formatDoctorLicensePlanName(founding)).toBe("Founding Free");
  });

  it("leaves paid licence titles and period-end dates unchanged", () => {
    const starter = {
      tier: "starter",
      current_period_end: "2027-03-15T12:00:00.000Z",
    };
    expect(formatDoctorLicenseTitle(starter)).toBe("Starter License");
    expect(formatDoctorLicensePeriodLine(starter)).toMatch(
      /^Period ends: 15 Mar 2027$/
    );
    expect(formatDoctorLicensePlanName(starter)).toBe("Starter");

    const professional = {
      tier: "professional",
      current_period_end: "2026-12-01T12:00:00.000Z",
    };
    expect(formatDoctorLicenseTitle(professional)).toBe("Professional License");
    expect(formatDoctorLicensePeriodLine(professional)).toMatch(
      /Period ends: .*2026/
    );
    expect(formatDoctorLicensePeriodLine(professional)).not.toMatch(/£299/);
    expect(formatDoctorLicensePlanName(professional)).toBe("Professional");
  });
});
