import type { License, LicenseStatus } from "@/types";

/**
 * Effective access level derived from a license's status.
 * Used throughout the app for consistent enforcement.
 */
export type EffectiveLicenseAccess =
  | "full" // active / trialing — all features available
  | "warning" // past_due — full access + warning banner
  | "restricted" // grace_period — hidden from search, no new bookings
  | "locked" // suspended — only billing accessible
  | "none"; // cancelled or no license

/**
 * Maps a license (or null) to the effective access level.
 */
export function getEffectiveAccess(
  license: Pick<License, "status"> | null
): EffectiveLicenseAccess {
  if (!license) return "none";
  switch (license.status) {
    case "active":
    case "trialing":
      return "full";
    case "past_due":
      return "warning";
    case "grace_period":
      return "restricted";
    case "suspended":
      return "locked";
    case "cancelled":
      return "none";
    default:
      return "none";
  }
}

/** Can the doctor accept new bookings? */
export function canAcceptBookings(
  license: Pick<License, "status"> | null
): boolean {
  const access = getEffectiveAccess(license);
  return access === "full" || access === "warning";
}

/** Should the doctor appear in patient-facing search results? */
export function isVisibleInSearch(
  license: Pick<License, "status"> | null
): boolean {
  const access = getEffectiveAccess(license);
  return access === "full" || access === "warning";
}

/** Can the user access the billing / license management page? */
export function canAccessBilling(
  license: Pick<License, "status"> | null
): boolean {
  // Always accessible unless there's literally no license at all
  return license !== null;
}

/** Is the license in a state that requires showing a warning banner? */
export function getLicenseWarningLevel(
  license: Pick<License, "status"> | null
): "none" | "warning" | "danger" | "critical" {
  if (!license) return "none";
  switch (license.status) {
    case "active":
    case "trialing":
      return "none";
    case "past_due":
      return "warning";
    case "grace_period":
      return "danger";
    case "suspended":
      return "critical";
    case "cancelled":
      return "none";
    default:
      return "none";
  }
}

/** Check if a specific feature is available for the given tier */
export function isTierFeatureAvailable(
  tier: string | null,
  feature: string
): boolean {
  if (!tier) return false;

  const tierFeatures: Record<string, string[]> = {
    starter: [
      "profile",
      "bookings",
      "basic_analytics",
      "email_notifications",
      "crm",
    ],
    professional: [
      "profile",
      "bookings",
      "basic_analytics",
      "email_notifications",
      "crm",
      "video",
      "treatment_plans",
      "advanced_analytics",
      "priority_support",
      "calendar_sync",
    ],
    clinic: [
      "profile",
      "bookings",
      "basic_analytics",
      "email_notifications",
      "crm",
      "video",
      "treatment_plans",
      "advanced_analytics",
      "priority_support",
      "calendar_sync",
      "team_dashboard",
      "shared_calendar",
      "invoicing",
      "bulk_import",
      "staff_accounts",
    ],
    enterprise: ["all"],
  };

  const features = tierFeatures[tier];
  if (!features) return false;
  if (features.includes("all")) return true;
  return features.includes(feature);
}

/** Active statuses that count as "has a valid license" */
export const ACTIVE_LICENSE_STATUSES: LicenseStatus[] = [
  "active",
  "trialing",
  "past_due",
];

/** Statuses that allow the doctor to remain visible in search */
export const VISIBLE_LICENSE_STATUSES: LicenseStatus[] = [
  "active",
  "trialing",
  "past_due",
];

/** Statuses that allow new bookings */
export const BOOKABLE_LICENSE_STATUSES: LicenseStatus[] = [
  "active",
  "trialing",
  "past_due",
];
