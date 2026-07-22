/**
 * Pure helper: one-line "why this doctor fits your search" for profiles.
 */

import type { DoctorsSearchFilters } from "@/lib/voice/search-url";

export type ProfileFitDoctor = {
  specialtySlugs?: string[];
  specialtyLabels?: string[];
  city?: string | null;
  countryCode?: string | null;
  languages?: string[];
  consultationTypes?: string[];
  consultationFeeCents?: number | null;
  avgRating?: number | null;
};

export type ProfileFitResult = {
  /** True if at least one active search filter matched */
  hasIntent: boolean;
  /** Short sentence for UI */
  blurb: string;
  /** Matched reason chips for optional UI */
  reasons: string[];
};

function hasAnyFilter(f: DoctorsSearchFilters): boolean {
  return Object.entries(f).some(([k, v]) => {
    if (k === "page" || k === "sort") return false;
    return v != null && v !== "" && v !== false;
  });
}

/**
 * Build a fit blurb from current search intent + doctor attributes.
 */
export function buildProfileFitBlurb(
  filters: DoctorsSearchFilters,
  doctor: ProfileFitDoctor,
  options?: { specialtyDisplay?: string | null }
): ProfileFitResult {
  if (!hasAnyFilter(filters)) {
    return {
      hasIntent: false,
      blurb: "",
      reasons: [],
    };
  }

  const reasons: string[] = [];
  const specialty =
    filters.specialty ||
    (filters.query ? null : null);

  if (filters.specialty) {
    const slugs = doctor.specialtySlugs || [];
    const labels = (doctor.specialtyLabels || []).map((l) => l.toLowerCase());
    const slugMatch = slugs.some(
      (s) => s === filters.specialty || s.includes(filters.specialty!)
    );
    const labelHint = options?.specialtyDisplay?.toLowerCase();
    if (
      slugMatch ||
      (labelHint && labels.some((l) => l.includes(labelHint)))
    ) {
      reasons.push(
        options?.specialtyDisplay ||
          filters.specialty.replace(/-/g, " ")
      );
    }
  }

  if (filters.location || filters.locationSlug || filters.placeName) {
    const city = (doctor.city || "").toLowerCase();
    const place = (filters.placeName || "").toLowerCase();
    const locSlug = (filters.location || filters.locationSlug || "").toLowerCase();
    if (
      (city && locSlug.includes(city.replace(/\s+/g, "-"))) ||
      (city && place.includes(city)) ||
      (city && locSlug.includes(city))
    ) {
      reasons.push(doctor.city || "your area");
    } else if (filters.placeName) {
      // Intent has place; doctor city may still be relevant if set
      if (doctor.city) reasons.push(`based in ${doctor.city}`);
    } else if (doctor.city) {
      reasons.push(doctor.city);
    }
  }

  if (filters.consultationType === "video") {
    if ((doctor.consultationTypes || []).includes("video")) {
      reasons.push("offers video consultations");
    }
  }
  if (filters.consultationType === "in_person") {
    if ((doctor.consultationTypes || []).includes("in_person")) {
      reasons.push("offers in-person visits");
    }
  }

  if (filters.language) {
    const langs = (doctor.languages || []).map((l) => l.toLowerCase());
    const want = filters.language.toLowerCase();
    if (langs.some((l) => l.includes(want) || want.includes(l))) {
      reasons.push(`speaks ${filters.language}`);
    }
  }

  if (
    filters.maxPrice != null &&
    doctor.consultationFeeCents != null &&
    doctor.consultationFeeCents <= filters.maxPrice * 100
  ) {
    reasons.push("within your budget");
  }

  if (
    filters.minRating != null &&
    doctor.avgRating != null &&
    doctor.avgRating >= filters.minRating
  ) {
    reasons.push(`rated ${doctor.avgRating.toFixed(1)}+`);
  }

  if (reasons.length === 0) {
    return {
      hasIntent: true,
      blurb:
        "This profile may still match parts of your search — check availability and fees below.",
      reasons: [],
    };
  }

  const head = reasons.slice(0, 3);
  let blurb: string;
  if (head.length === 1) {
    blurb = `Fits your search: ${head[0]}.`;
  } else if (head.length === 2) {
    blurb = `Fits your search: ${head[0]} and ${head[1]}.`;
  } else {
    blurb = `Fits your search: ${head[0]}, ${head[1]}, and ${head[2]}.`;
  }

  return { hasIntent: true, blurb, reasons: head };
}
