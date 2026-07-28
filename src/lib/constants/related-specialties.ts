import { SPECIALTIES } from "@/lib/constants/specialties";

/**
 * Specialty adjacency for intelligent search fallbacks.
 * Does NOT auto-add GP for all specialists — that dilutes relevance
 * (e.g. acne should not become "any nearby doctor").
 */
const ADJACENCY: Record<string, string[]> = Object.fromEntries(
  SPECIALTIES.map((s) => [s.slug, [...s.relatedSlugs]])
);

/** Related specialty slugs for a primary specialty (excluding itself). */
export function getRelatedSpecialtySlugs(specialtySlug: string): string[] {
  const related = new Set<string>(ADJACENCY[specialtySlug] || []);
  related.delete(specialtySlug);
  return [...related];
}

/** Human-readable label from a specialty slug. */
export function specialtySlugToLabel(slug: string): string {
  return slug
    .replace(/-/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}
