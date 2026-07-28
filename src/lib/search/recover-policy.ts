import { getRelatedSpecialtySlugs } from "@/lib/constants/related-specialties";
import { specialtySlugToLabel } from "@/lib/constants/related-specialties";
import type { SearchMatchMode, SoftFailureReason } from "@/lib/search/types";

/**
 * Recovery policy for marketplace search.
 * Specialty intent is never replaced by unrelated nearby doctors.
 */

export type RecoveryStep =
  | "widen_radius"
  | "country_soonest"
  | "video_launch"
  | "related_specialties"
  | "platform_empty"
  | "nearby_any"; // only when NO specialty intent

export function recoveryStepsFor(primarySpecialty: string | null): RecoveryStep[] {
  if (primarySpecialty) {
    return [
      "widen_radius",
      "country_soonest",
      "video_launch",
      "related_specialties",
      "platform_empty",
    ];
  }
  return ["nearby_any", "platform_empty"];
}

/** Related specialties for recovery (exclude GP for specialist intent). */
export function relatedSpecialtiesForRecovery(primarySpecialty: string): string[] {
  return getRelatedSpecialtySlugs(primarySpecialty).filter(
    (s) => s !== "general-practice"
  );
}

/** Radius expansion ladder (km) from a base radius. */
export function widenRadiusSteps(baseRadius: number): number[] {
  return [Math.max(baseRadius * 2, 50), Math.max(baseRadius * 4, 100)];
}

export function shouldRunRecovery(opts: {
  dataEmpty: boolean;
  specialty?: string | null;
  query?: string | null;
  skill?: string | null;
  availableToday?: boolean;
  liveNow?: boolean;
  liveInPersonNearby?: boolean;
  placeLat?: number | null;
  location?: string | null;
  textFilterApplied?: boolean;
  matchedSpecialtySlug?: string | null;
  softFailures?: SoftFailureReason[];
  sort?: string | null;
}): boolean {
  if (!opts.dataEmpty) return false;
  return !!(
    opts.query ||
    opts.specialty ||
    opts.skill ||
    opts.availableToday ||
    opts.liveNow ||
    opts.liveInPersonNearby ||
    opts.placeLat ||
    opts.location ||
    opts.textFilterApplied ||
    opts.matchedSpecialtySlug ||
    (opts.softFailures && opts.softFailures.length > 0) ||
    opts.sort === "soonest"
  );
}

/**
 * Hard empty returns that MUST go through recovery instead (regression guard list).
 * Used by tests — if someone re-introduces early empty for these, tests fail.
 */
export const SOFT_FAIL_REASONS_MUST_RECOVER: SoftFailureReason[] = [
  "available_today",
  "live_now",
  "live_in_person",
  "proximity",
  "skill",
  "soonest_empty_candidates",
  "soonest_no_slots",
  "available_within_days",
];

/** Banner when every doctor on the page has no slots. */
export function fullyBookedBanner(
  specialtyLabel: string | null,
  withinDays: number
): string {
  const label = specialtyLabel || "these";
  return `No open slots for ${label} specialists in the next ${withinDays} days. Join a waitlist below — we'll notify you when appointments open.`;
}

/** Platform-empty specialty banner. */
export function platformEmptyBanner(
  specialtySlug: string,
  timeExpandedBanner?: string | null
): string {
  if (timeExpandedBanner) return timeExpandedBanner;
  const label = specialtySlugToLabel(specialtySlug);
  return `No bookable ${label} specialists match right now. Join the waitlist and we'll notify you when openings appear.`;
}

/** Whether matchMode indicates a non-exact recovered result. */
export function isRecoveredMatchMode(mode: SearchMatchMode | undefined): boolean {
  return !!mode && mode !== "exact";
}

/**
 * Specialties that must never appear as unlabeled primary fills for a
 * dermatology/acne search (golden rule).
 */
export function forbiddenPrimaryForDermatology(): string[] {
  return ["dentistry", "orthopedics", "urology"];
}

export function isSpecialtyPreservingRecovery(
  primarySpecialty: string | null,
  resultSpecialtySlugs: string[]
): boolean {
  if (!primarySpecialty) return true;
  if (resultSpecialtySlugs.length === 0) return true; // empty → waitlist OK
  const related = new Set([
    primarySpecialty,
    ...relatedSpecialtiesForRecovery(primarySpecialty),
  ]);
  // At least one result must be primary or related
  return resultSpecialtySlugs.some((s) => related.has(s));
}
