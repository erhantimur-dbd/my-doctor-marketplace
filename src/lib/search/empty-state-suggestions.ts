/**
 * Pure helpers for smart empty states on Find a Doctor.
 * Suggest one-tap filter relaxations when zero (or few) results.
 */

import {
  buildDoctorsSearchPath,
  type DoctorsSearchFilters,
  parseDoctorsSearchPath,
} from "@/lib/voice/search-url";

export type EmptyStateSuggestion = {
  id: string;
  /** Short label for the button */
  label: string;
  /** Locale-less path to apply */
  href: string;
};

/**
 * Build actionable suggestions from current listing filters.
 * Order: most likely to unlock results first.
 */
export function buildEmptyStateSuggestions(
  filters: DoctorsSearchFilters,
  options?: { max?: number }
): EmptyStateSuggestion[] {
  const max = options?.max ?? 4;
  const out: EmptyStateSuggestion[] = [];
  const base = { ...filters, page: null };

  const push = (id: string, label: string, patch: DoctorsSearchFilters) => {
    const next: DoctorsSearchFilters = { ...base, ...patch, page: null };
    const href = buildDoctorsSearchPath(next);
    if (href === buildDoctorsSearchPath(base)) return;
    out.push({ id, label, href });
  };

  if (base.availableToday) {
    push("drop-today", "Show all availability (not only today)", {
      availableToday: null,
      sort: base.sort === "soonest" ? "soonest" : base.sort,
    });
  }

  if (base.consultationType === "video" || base.consultationType === "in_person") {
    push("any-type", "Include video and in-person", {
      consultationType: null,
    });
  }

  if (base.minRating != null && base.minRating > 0) {
    push("drop-rating", "Remove minimum rating filter", {
      minRating: null,
    });
  }

  if (base.maxPrice != null) {
    push("raise-budget", "Remove maximum price filter", {
      maxPrice: null,
    });
  }

  if (base.language) {
    push("any-language", "Any language", { language: null });
  }

  if (base.skill) {
    push("drop-skill", "Search specialty only (drop procedure filter)", {
      skill: null,
    });
  }

  if (base.location || base.locationSlug || base.placeLat) {
    push("wider-area", "Search all locations", {
      location: null,
      locationSlug: null,
      placeLat: null,
      placeLng: null,
      placeName: null,
      radius: null,
    });
  }

  if (base.specialty && base.query) {
    push("specialty-only", "Search by specialty only", { query: null });
  }

  if (base.specialty || base.query) {
    push("browse-all", "Browse all doctors", {
      specialty: null,
      query: null,
      skill: null,
      sort: "featured",
    });
  }

  // Always offer a clean slate if we have any filters
  if (out.length === 0 && Object.values(base).some((v) => v != null && v !== "")) {
    push("clear-all", "Clear all filters", {
      specialty: null,
      query: null,
      location: null,
      locationSlug: null,
      language: null,
      consultationType: null,
      skill: null,
      minPrice: null,
      maxPrice: null,
      minRating: null,
      availableToday: null,
      sort: null,
      placeLat: null,
      placeLng: null,
      placeName: null,
      radius: null,
      providerType: null,
    });
  }

  // Dedupe by href
  const seen = new Set<string>();
  const unique: EmptyStateSuggestion[] = [];
  for (const s of out) {
    if (seen.has(s.href)) continue;
    seen.add(s.href);
    unique.push(s);
    if (unique.length >= max) break;
  }
  return unique;
}

export function emptyStateSuggestionsFromSearchParams(
  search: string
): EmptyStateSuggestion[] {
  return buildEmptyStateSuggestions(parseDoctorsSearchPath(search));
}
