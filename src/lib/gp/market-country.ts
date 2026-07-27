/**
 * Resolve market / local area for GP shortcuts.
 *
 * - Video: country-wide (UK-wide for GB) — never city-radius
 * - In-person: city + nearby only (never country-wide)
 */

import { findNearestLocation } from "@/lib/utils/geo";

/** In-person GP search radius (km) — city + nearby only */
export const GP_IN_PERSON_RADIUS_KM = 30;

export interface GpMarketLocation {
  slug: string;
  city?: string;
  country_code: string;
  latitude: number | null;
  longitude: number | null;
}

export interface GpMarketPlace {
  lat: number;
  lng: number;
  name?: string;
}

/** Map app locale → default country market for GP video inventory */
export function localeToCountryCode(locale: string): string {
  const map: Record<string, string> = {
    "en-GB": "GB",
    "en-IE": "IE",
    en: "GB",
    it: "IT",
    tr: "TR",
    es: "ES",
    de: "DE",
    fr: "FR",
    pl: "PL",
    pt: "PT",
    ja: "GB",
    zh: "GB",
  };
  return map[locale] || "GB";
}

/**
 * Priority:
 * 1. Explicit search location (country-xx or city slug → country)
 * 2. Selected place / GPS → nearest catalog city → country
 * 3. Active UI locale (en-GB → GB, it → IT, …)
 */
export function resolveGpMarketCountry(opts: {
  locale: string;
  locations: GpMarketLocation[];
  locationSlug?: string;
  placeData?: GpMarketPlace | null;
  geo?: { latitude: number | null; longitude: number | null };
}): string {
  const { locale, locations, locationSlug, placeData, geo } = opts;

  if (locationSlug?.startsWith("country-")) {
    return locationSlug.replace("country-", "").toUpperCase();
  }

  if (locationSlug && locationSlug !== "all") {
    const city = locations.find((l) => l.slug === locationSlug);
    if (city?.country_code) return city.country_code.toUpperCase();
  }

  const lat = placeData?.lat ?? geo?.latitude ?? null;
  const lng = placeData?.lng ?? geo?.longitude ?? null;
  if (lat != null && lng != null && Number.isFinite(lat) && Number.isFinite(lng)) {
    const nearestSlug = findNearestLocation(
      { latitude: lat, longitude: lng },
      locations
    );
    if (nearestSlug) {
      const city = locations.find((l) => l.slug === nearestSlug);
      if (city?.country_code) return city.country_code.toUpperCase();
    }
  }

  return localeToCountryCode(locale);
}

export type GpLocalArea =
  | {
      kind: "place";
      placeLat: number;
      placeLng: number;
      placeName: string;
      radiusKm: number;
    }
  | {
      kind: "city";
      locationSlug: string;
    }
  | {
      kind: "missing";
    };

/**
 * Local area for in-person GP search — city / nearby only, never country-wide.
 *
 * Priority:
 * 1. Explicit Google Place (borough/street) → lat/lng + radius
 * 2. City slug from search (not country-xx)
 * 3. GPS / place coords → nearest catalog city slug
 * 4. missing — caller should prompt for location
 */
export function resolveGpLocalArea(opts: {
  locations: GpMarketLocation[];
  locationSlug?: string;
  placeData?: GpMarketPlace | null;
  geo?: { latitude: number | null; longitude: number | null };
}): GpLocalArea {
  const { locations, locationSlug, placeData, geo } = opts;

  // Precise place pin from search (borough, address, etc.)
  if (
    placeData &&
    Number.isFinite(placeData.lat) &&
    Number.isFinite(placeData.lng)
  ) {
    return {
      kind: "place",
      placeLat: placeData.lat,
      placeLng: placeData.lng,
      placeName: placeData.name || "Near me",
      radiusKm: GP_IN_PERSON_RADIUS_KM,
    };
  }

  // City selected in the where field (not country-wide)
  if (
    locationSlug &&
    locationSlug !== "all" &&
    !locationSlug.startsWith("country-")
  ) {
    return { kind: "city", locationSlug };
  }

  // GPS → nearest city in catalog
  const lat = geo?.latitude ?? null;
  const lng = geo?.longitude ?? null;
  if (lat != null && lng != null && Number.isFinite(lat) && Number.isFinite(lng)) {
    const nearestSlug = findNearestLocation(
      { latitude: lat, longitude: lng },
      locations
    );
    if (nearestSlug) {
      return { kind: "city", locationSlug: nearestSlug };
    }
    // Fallback: raw coords with radius if catalog empty
    return {
      kind: "place",
      placeLat: lat,
      placeLng: lng,
      placeName: "Near me",
      radiusKm: GP_IN_PERSON_RADIUS_KM,
    };
  }

  return { kind: "missing" };
}
