/**
 * Pure helpers: map Find a Doctor filters → path used by doctors/page.tsx.
 */

export type DoctorsSearchFilters = {
  query?: string | null;
  specialty?: string | null;
  location?: string | null;
  locationSlug?: string | null;
  language?: string | null;
  consultationType?: string | null;
  skill?: string | null;
  minPrice?: number | null;
  maxPrice?: number | null;
  minRating?: number | null;
  availableToday?: boolean | null;
  sort?: string | null;
  providerType?: string | null;
  placeLat?: number | null;
  placeLng?: number | null;
  placeName?: string | null;
  radius?: number | null;
  acceptedPayment?: string | null;
  wheelchairAccessible?: boolean | null;
  page?: number | null;
};

function setIf(
  params: URLSearchParams,
  key: string,
  value: string | number | boolean | null | undefined
) {
  if (value === null || value === undefined || value === "") return;
  if (typeof value === "boolean") {
    if (value) params.set(key, "true");
    return;
  }
  params.set(key, String(value));
}

/**
 * Build a locale-less path `/doctors?...` for next-intl Link/router.
 */
export function buildDoctorsSearchPath(
  filters: DoctorsSearchFilters
): string {
  const params = new URLSearchParams();
  const location = filters.location ?? filters.locationSlug;

  setIf(params, "query", filters.query);
  setIf(params, "specialty", filters.specialty);
  setIf(params, "location", location);
  setIf(params, "language", filters.language);
  setIf(params, "consultationType", filters.consultationType);
  setIf(params, "skill", filters.skill);
  setIf(params, "minPrice", filters.minPrice);
  setIf(params, "maxPrice", filters.maxPrice);
  setIf(params, "minRating", filters.minRating);
  setIf(params, "availableToday", filters.availableToday);
  setIf(params, "sort", filters.sort);
  setIf(params, "providerType", filters.providerType);
  setIf(params, "placeLat", filters.placeLat);
  setIf(params, "placeLng", filters.placeLng);
  setIf(params, "placeName", filters.placeName);
  setIf(params, "radius", filters.radius);
  setIf(params, "acceptedPayment", filters.acceptedPayment);
  setIf(params, "wheelchairAccessible", filters.wheelchairAccessible);
  if (filters.page && filters.page > 1) {
    params.set("page", String(filters.page));
  }

  const qs = params.toString();
  return qs ? `/doctors?${qs}` : "/doctors";
}

/** Extract plain assistant text from AI SDK UIMessage-like parts. */
export function extractAssistantText(
  parts: Array<{ type: string; text?: string }> | undefined
): string {
  if (!parts?.length) return "";
  return parts
    .filter((p) => p.type === "text" && typeof p.text === "string")
    .map((p) => p.text!.trim())
    .filter(Boolean)
    .join(" ")
    .trim();
}

/** Parse `/doctors?...` or query string into filter object. */
export function parseDoctorsSearchPath(
  pathOrSearch: string
): DoctorsSearchFilters {
  let search = pathOrSearch;
  try {
    if (pathOrSearch.includes("?")) {
      search = pathOrSearch.slice(pathOrSearch.indexOf("?"));
    } else if (!pathOrSearch.startsWith("?")) {
      search = pathOrSearch.startsWith("/") ? "" : `?${pathOrSearch}`;
    }
    const url = new URL(search || "?", "http://local.invalid");
    const g = (k: string) => url.searchParams.get(k);
    const num = (k: string) => {
      const v = g(k);
      if (v == null || v === "") return null;
      const n = Number(v);
      return Number.isFinite(n) ? n : null;
    };
    return {
      query: g("query"),
      specialty: g("specialty"),
      location: g("location"),
      language: g("language"),
      consultationType: g("consultationType"),
      skill: g("skill"),
      minPrice: num("minPrice"),
      maxPrice: num("maxPrice"),
      minRating: num("minRating"),
      availableToday: g("availableToday") === "true" ? true : null,
      sort: g("sort"),
      providerType: g("providerType"),
      placeLat: num("placeLat"),
      placeLng: num("placeLng"),
      placeName: g("placeName"),
      radius: num("radius"),
      acceptedPayment: g("acceptedPayment"),
      wheelchairAccessible:
        g("wheelchairAccessible") === "true" ? true : null,
      page: num("page"),
    };
  } catch {
    return {};
  }
}

/** Compare two doctors paths ignoring param order. */
export function doctorsSearchPathsEqual(a: string, b: string): boolean {
  const fa = parseDoctorsSearchPath(a);
  const fb = parseDoctorsSearchPath(b);
  const pathA = buildDoctorsSearchPath(fa);
  const pathB = buildDoctorsSearchPath(fb);
  return pathA === pathB;
}
