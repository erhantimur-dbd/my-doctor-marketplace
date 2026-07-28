/**
 * Launch UK cities for programmatic city × specialty SEO pages (Wave B2).
 * Slugs should match (or loosely match) locations.slug in the database.
 */
export interface CitySeoMeta {
  slug: string;
  name: string;
  countryCode: "GB" | "IE";
  /** Alternate location slugs that should resolve here */
  aliases?: readonly string[];
}

export const UK_SEO_CITIES: readonly CitySeoMeta[] = [
  { slug: "london", name: "London", countryCode: "GB" },
  { slug: "birmingham", name: "Birmingham", countryCode: "GB" },
  { slug: "manchester", name: "Manchester", countryCode: "GB" },
  { slug: "liverpool", name: "Liverpool", countryCode: "GB" },
  { slug: "leeds", name: "Leeds", countryCode: "GB" },
  { slug: "sheffield", name: "Sheffield", countryCode: "GB" },
  { slug: "bristol", name: "Bristol", countryCode: "GB" },
  { slug: "edinburgh", name: "Edinburgh", countryCode: "GB" },
  { slug: "glasgow", name: "Glasgow", countryCode: "GB" },
  { slug: "bournemouth", name: "Bournemouth", countryCode: "GB" },
  { slug: "belfast", name: "Belfast", countryCode: "GB" },
  { slug: "cardiff", name: "Cardiff", countryCode: "GB" },
  { slug: "newcastle", name: "Newcastle", countryCode: "GB", aliases: ["newcastle-upon-tyne"] },
  { slug: "nottingham", name: "Nottingham", countryCode: "GB" },
  { slug: "dublin", name: "Dublin", countryCode: "IE" },
  { slug: "harley-street", name: "Harley Street", countryCode: "GB", aliases: ["london"] },
  { slug: "marylebone", name: "Marylebone", countryCode: "GB", aliases: ["london"] },
  { slug: "chelsea", name: "Chelsea", countryCode: "GB", aliases: ["london"] },
] as const;

export function getCityBySlug(slug: string): CitySeoMeta | undefined {
  return UK_SEO_CITIES.find(
    (c) => c.slug === slug || c.aliases?.includes(slug)
  );
}
