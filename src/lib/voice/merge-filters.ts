/**
 * Merge and summarize search filters for voice refine + spoken brief.
 */

import type { DoctorsSearchFilters } from "@/lib/voice/search-url";

/**
 * Merge a partial refine into current listing filters.
 * Explicit `null` clears a field; `undefined` leaves it unchanged.
 */
export function mergeSearchFilters(
  current: DoctorsSearchFilters,
  patch: DoctorsSearchFilters
): DoctorsSearchFilters {
  const next: DoctorsSearchFilters = { ...current };
  for (const [key, value] of Object.entries(patch) as [
    keyof DoctorsSearchFilters,
    DoctorsSearchFilters[keyof DoctorsSearchFilters],
  ][]) {
    if (value === undefined) continue;
    if (value === null || value === "") {
      delete next[key];
      continue;
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (next as any)[key] = value;
  }
  // Always reset page on refine
  delete next.page;
  return next;
}

export type SpokenSearchSummaryInput = {
  total: number;
  specialtyLabel?: string | null;
  locationLabel?: string | null;
  consultationType?: string | null;
  availableToday?: boolean | null;
  sort?: string | null;
  language?: string | null;
  /** Optional first names for spoken colour — keep short */
  sampleNames?: string[];
  soonestNote?: string | null;
};

/**
 * One short spoken sentence explaining why these doctors matched.
 * Safe for TTS; does not invent availability beyond provided notes.
 */
export function buildSearchResultsSpokenSummary(
  input: SpokenSearchSummaryInput
): string {
  const n = Math.max(0, Math.floor(input.total));
  if (n === 0) {
    return "I could not find matching doctors with those filters. Try a wider area, video visits, or a related specialty.";
  }

  const bits: string[] = [];
  if (input.specialtyLabel) bits.push(input.specialtyLabel);
  if (input.locationLabel) bits.push(`in ${input.locationLabel}`);
  if (input.consultationType === "video") bits.push("for video");
  if (input.consultationType === "in_person") bits.push("for in-person visits");
  if (input.language) bits.push(`speaking ${input.language}`);
  if (input.availableToday) bits.push("available today");
  if (input.sort === "soonest") bits.push("sorted by soonest availability");

  const where =
    bits.length > 0
      ? ` matching ${bits.join(", ")}`
      : " matching your search";

  let sentence = `I found ${n} doctor${n === 1 ? "" : "s"}${where}.`;
  if (input.soonestNote) {
    sentence += ` ${input.soonestNote}`;
  } else if (input.sampleNames && input.sampleNames.length > 0) {
    const names = input.sampleNames.slice(0, 2).join(" and ");
    sentence += ` Top matches include ${names}.`;
  }
  sentence += " You can refine by video, price, language, or soonest availability.";
  return sentence.replace(/\s+/g, " ").trim();
}
