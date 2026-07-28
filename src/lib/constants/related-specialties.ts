import { SPECIALTIES } from "@/lib/constants/specialties";

/**
 * Specialty adjacency for intelligent search fallbacks.
 * Uses taxonomy relatedSlugs only — do not force-add unrelated fields
 * (e.g. dentistry) into a dermatology empty-state.
 *
 * General Practice is included as a soft alternative for specialist
 * searches so expansion chips can offer it, but the search fallback
 * ladder filters GP out when filling primary results (so acne ≠ GP dump).
 */
const ADJACENCY: Record<string, string[]> = Object.fromEntries(
  SPECIALTIES.map((s) => [s.slug, [...s.relatedSlugs]])
);

/** Return related specialty slugs for a primary specialty (excluding itself). */
export function getRelatedSpecialtySlugs(specialtySlug: string): string[] {
  const related = new Set<string>(ADJACENCY[specialtySlug] || []);

  // Primary care is a sensible soft alternative for specialists (chips only)
  if (specialtySlug !== "general-practice") {
    related.add("general-practice");
  }

  related.delete(specialtySlug);
  return [...related];
}

/** Human-readable label from a specialty slug. */
export function specialtySlugToLabel(slug: string): string {
  return slug
    .replace(/-/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}
