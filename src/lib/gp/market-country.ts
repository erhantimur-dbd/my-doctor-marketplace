/**
 * Resolve the patient's market country for GP video shortcuts.
 * Inventory is always country-wide (UK-wide for GB) — never city-radius.
 */

import { findNearestLocation } from "@/lib/utils/geo";

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
