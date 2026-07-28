/**
 * Shared search contract for marketplace Find-a-Doctor + chat tools.
 */

export type SearchMatchMode =
  | "exact"
  | "widened"
  | "country"
  | "related"
  | "empty"
  | "time_expanded"
  | "platform_empty";

export type SoftFailureReason =
  | "live_now"
  | "live_now_error"
  | "live_in_person"
  | "live_in_person_error"
  | "available_today"
  | "available_today_error"
  | "available_within_days"
  | "skill"
  | "specialty_empty"
  | "proximity"
  | "location_country"
  | "location_video_country"
  | "location_missing"
  | "location_country_fallback"
  | "launch_regions"
  | "soonest_error"
  | "soonest_page_error"
  | "soonest_no_slots"
  | "soonest_empty_candidates"
  | string;

export interface SearchWaitlistPrompt {
  specialtySlug: string;
  doctorIdsFullyBooked?: string[];
}

/** UUID that never matches a real doctor — forces zero exact hits into recovery. */
export const NO_MATCH_ID = "00000000-0000-0000-0000-000000000000";

export interface ResolvedSearchIntent {
  /** Specialty from explicit filter */
  specialtyFilter: string | null;
  /** Specialty inferred from free-text (exact name or keyword) */
  matchedSpecialtySlug: string | null;
  /** Secondary specialist suggestion for GP-first keyword matches */
  specialistSuggestion: string | null;
  /** Effective specialty for recovery + waitlist (filter wins over match) */
  primarySpecialty: string | null;
  /** True when free-text constrained candidate IDs */
  textFilterApplied: boolean;
}

export type InventoryRankDoctor = {
  id: string;
  avg_rating?: number | null;
  is_featured?: boolean | null;
  [key: string]: unknown;
};
