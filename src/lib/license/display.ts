/**
 * Doctor-facing licence labels. Founding Free is a lifetime perk stored with
 * a far-future current_period_end sentinel — never show that date as expiry.
 */

import {
  FOUNDING_FREE_LICENSE_TITLE,
  FOUNDING_FREE_LICENSE_VALUE_LINE,
} from "@/lib/constants/company";
import { getLicenseTier } from "@/lib/constants/license-tiers";

export type LicenseDisplayLike = {
  tier?: string | null;
  current_period_end?: string | null;
  metadata?: Record<string, unknown> | null;
};

/** Stored billing identity for Founding Free (not unknown / missing licences). */
export function isFoundingFreeLicense(
  license: LicenseDisplayLike | null | undefined
): boolean {
  return license?.tier === "free";
}

/** Gateway rows use 2099-12-31 as a lifetime sentinel, not a real expiry. */
export function isFoundingFreeSentinelPeriodEnd(
  iso: string | null | undefined
): boolean {
  if (!iso) return false;
  const year = new Date(iso).getUTCFullYear();
  return Number.isFinite(year) && year >= 2099;
}

/** Current-plan title on doctor billing. Paid tiers keep “{Name} License”. */
export function formatDoctorLicenseTitle(
  license: LicenseDisplayLike | null | undefined
): string {
  if (isFoundingFreeLicense(license)) {
    return FOUNDING_FREE_LICENSE_TITLE;
  }
  const name = license?.tier ? getLicenseTier(license.tier)?.name : undefined;
  if (name) return `${name} License`;
  if (license?.tier) return `${license.tier} License`;
  return "No Active License";
}

/**
 * Period / value line under the current licence.
 * Founding Free: lifetime perk + £299/mo claim value (no 2099 date).
 * Paid / other: existing “Period ends: …” date format.
 */
export function formatDoctorLicensePeriodLine(
  license: LicenseDisplayLike | null | undefined,
  locale = "en-GB"
): string {
  if (isFoundingFreeLicense(license)) {
    return FOUNDING_FREE_LICENSE_VALUE_LINE;
  }
  if (!license?.current_period_end) return "";
  const formatted = new Date(license.current_period_end).toLocaleDateString(
    locale,
    { day: "numeric", month: "short", year: "numeric" }
  );
  return `Period ends: ${formatted}`;
}

/** Org dashboard “Current Plan” label. */
export function formatDoctorLicensePlanName(
  license: LicenseDisplayLike | null | undefined
): string {
  if (!license?.tier) return "No License";
  if (isFoundingFreeLicense(license)) return "Founding Free";
  return getLicenseTier(license.tier)?.name ?? license.tier;
}
