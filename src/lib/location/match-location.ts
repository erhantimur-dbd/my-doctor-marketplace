/**
 * Resolve a free-text place (e.g. "Birmingham") or slug to a known location slug.
 * Pure — unit-tested; used by NL search and the search bar "Where" field.
 */

export type LocationMatchInput = {
  slug: string;
  city: string;
  country_code?: string;
};

/**
 * Match an AI/user location string against active locations.
 * Prefers exact city, then slug, then substring (longest city first).
 */
export function resolveLocationSlug(
  raw: string | null | undefined,
  locations: LocationMatchInput[]
): string | null {
  if (!raw?.trim() || !locations.length) return null;
  const lower = raw.trim().toLowerCase();
  const normalized = lower.replace(/\s+/g, "-");

  const bySlug = locations.find((l) => l.slug.toLowerCase() === lower || l.slug.toLowerCase() === normalized);
  if (bySlug) return bySlug.slug;

  const byExactCity = locations.find((l) => l.city.toLowerCase() === lower);
  if (byExactCity) return byExactCity.slug;

  // "birmingham" matches slug "birmingham-uk"
  const bySlugPrefix = locations.find(
    (l) =>
      l.slug.toLowerCase().startsWith(normalized) ||
      l.slug.toLowerCase().includes(normalized)
  );
  if (bySlugPrefix) return bySlugPrefix.slug;

  // Longest city name first so "Newcastle upon Tyne" wins over "Newcastle"
  const sorted = [...locations].sort(
    (a, b) => b.city.length - a.city.length
  );
  for (const l of sorted) {
    const city = l.city.toLowerCase();
    if (city.length < 3) continue;
    if (lower.includes(city) || city.includes(lower)) {
      return l.slug;
    }
  }
  return null;
}

/**
 * Scan full search text for a city name (e.g. "GP in Birmingham").
 */
export function matchLocationFromSearchText(
  text: string,
  locations: LocationMatchInput[]
): string | null {
  if (!text.trim() || !locations.length) return null;
  const lower = text.toLowerCase();
  const sorted = [...locations].sort(
    (a, b) => b.city.length - a.city.length
  );
  for (const l of sorted) {
    const city = l.city.toLowerCase();
    if (city.length < 3) continue;
    // Word-boundary-ish: city appears as a token in the phrase
    const re = new RegExp(
      `(?:^|[^a-z])${city.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?:[^a-z]|$)`,
      "i"
    );
    if (re.test(lower)) return l.slug;
  }
  return null;
}
