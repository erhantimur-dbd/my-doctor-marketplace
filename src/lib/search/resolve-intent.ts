import { matchKeywordSpecialty } from "@/lib/search/keyword-specialty-map";
import type { ResolvedSearchIntent } from "@/lib/search/types";

/**
 * Resolve search intent from filters + free-text without DB access.
 * Specialty name matching against the specialties table is applied later in
 * searchDoctors; this pure step handles keyword → specialty (e.g. acne → derm).
 */
export function resolveSearchIntent(filters: {
  specialty?: string;
  query?: string;
}): Omit<ResolvedSearchIntent, "textFilterApplied"> & {
  /** Specialty slugs to OR when applying keyword text filter */
  keywordSpecialtySlugs: string[];
  /** Whether free-text should try bio search (short non-symptom phrases) */
  allowBioSearch: boolean;
} {
  const specialtyFilter = filters.specialty?.trim() || null;
  let matchedSpecialtySlug: string | null = null;
  let specialistSuggestion: string | null = null;
  const keywordSpecialtySlugs: string[] = [];
  let allowBioSearch = false;

  if (filters.query && !specialtyFilter) {
    const term = filters.query.trim().toLowerCase();
    const keywordMatch = matchKeywordSpecialty(term);
    if (keywordMatch) {
      matchedSpecialtySlug = keywordMatch.primary;
      keywordSpecialtySlugs.push(
        keywordMatch.primary,
        keywordMatch.specialist
      );
      if (keywordMatch.specialist !== keywordMatch.primary) {
        specialistSuggestion = keywordMatch.specialist;
      }
    } else if (term.split(/\s+/).length <= 3) {
      // Short phrases may match doctor bio / name later
      allowBioSearch = true;
    }
  }

  const primarySpecialty = specialtyFilter || matchedSpecialtySlug || null;

  return {
    specialtyFilter,
    matchedSpecialtySlug,
    specialistSuggestion,
    primarySpecialty,
    keywordSpecialtySlugs: [...new Set(keywordSpecialtySlugs)],
    allowBioSearch,
  };
}

/**
 * Default sort for marketplace: inventory-first when user has intent.
 */
export function defaultMarketplaceSort(filters: {
  sort?: string;
  specialty?: string;
  skill?: string;
  query?: string;
  condition?: string;
  availableToday?: boolean;
  liveNow?: boolean;
  liveInPersonNearby?: boolean;
  availableWithinDays?: number;
}): string {
  if (filters.sort) return filters.sort;
  if (
    filters.availableToday ||
    filters.liveNow ||
    filters.liveInPersonNearby ||
    filters.availableWithinDays ||
    filters.specialty ||
    filters.skill ||
    filters.query ||
    filters.condition
  ) {
    return "soonest";
  }
  return "featured";
}

/** User-chosen sorts that skip inventory re-ranking. */
export function isUserExplicitSort(sort?: string): boolean {
  return ["price_asc", "price_desc", "rating", "nearest", "best_match"].includes(
    sort || ""
  );
}
