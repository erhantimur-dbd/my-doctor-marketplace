"use client";

import { useRouter, usePathname } from "@/i18n/navigation";
import { useTranslations } from "next-intl";
import { useCallback, useEffect, useRef } from "react";
import { useGeolocation } from "@/hooks/use-geolocation";
import { findNearestLocation } from "@/lib/utils/geo";
import { MobileFilterBar } from "./mobile-filter-bar";
import { DesktopFilterBar } from "./desktop-filter-bar";
import { NLSearchIndicator } from "@/components/search/nl-search-indicator";
import type { NLSearchFilters } from "@/lib/ai/schemas";

interface FilterProps {
  specialties: { id: string; name_key: string; slug: string }[];
  locations: {
    id: string;
    city: string;
    country_code: string;
    slug: string;
    latitude: number | null;
    longitude: number | null;
  }[];
  currentFilters: Record<string, string | undefined>;
}

export function DoctorSearchFilters({
  specialties,
  locations,
  currentFilters,
}: FilterProps) {
  const t = useTranslations("search");
  const router = useRouter();
  const pathname = usePathname();
  const geo = useGeolocation("manual");

  const updateFilter = useCallback(
    (key: string, value: string | undefined) => {
      const params = new URLSearchParams();
      Object.entries(currentFilters).forEach(([k, v]) => {
        if (v && k !== "page") params.set(k, v);
      });

      if (value && value !== "all") {
        params.set(key, value);
      } else {
        params.delete(key);
      }

      params.delete("page"); // Reset to page 1
      router.push(`${pathname}?${params.toString()}`);
    },
    [currentFilters, pathname, router]
  );

  // Handle sort change — when "nearest" is selected, attach lat/lng
  const handleSortChange = useCallback(
    (value: string) => {
      const params = new URLSearchParams();
      Object.entries(currentFilters).forEach(([k, v]) => {
        if (v && k !== "page") params.set(k, v);
      });

      if (value && value !== "all") {
        params.set("sort", value);
      } else {
        params.delete("sort");
      }

      // If switching to "nearest", attach geo coords if available
      if (value === "nearest") {
        if (geo.latitude != null && geo.longitude != null) {
          params.set("lat", geo.latitude.toFixed(6));
          params.set("lng", geo.longitude.toFixed(6));
        } else {
          // Request geolocation — coords will be applied via the effect below
          pendingNearestRef.current = true;
          geo.requestPosition();
        }
      } else {
        // Remove lat/lng when switching away from nearest
        params.delete("lat");
        params.delete("lng");
      }

      params.delete("page");
      router.push(`${pathname}?${params.toString()}`);
    },
    [currentFilters, pathname, router, geo]
  );

  const clearAll = () => {
    router.push(pathname);
  };

  const hasFilters = Object.entries(currentFilters).some(
    ([k, v]) => v && k !== "sort" && k !== "page" && k !== "lat" && k !== "lng" && k !== "aiParsed"
  );

  // Count active filters (excluding sort, page, lat, lng, availableToday — since that has its own chip)
  const activeFilterCount = Object.entries(currentFilters).filter(
    ([k, v]) =>
      v &&
      k !== "sort" &&
      k !== "page" &&
      k !== "lat" &&
      k !== "lng" &&
      k !== "availableToday" &&
      k !== "wheelchairAccessible" &&
      k !== "query" &&
      k !== "aiParsed"
  ).length;

  // Keys managed by the "More Filters" dialog
  const MORE_FILTER_KEYS = ["providerType", "acceptedPayment", "minRating", "language", "minPrice", "maxPrice"] as const;

  const moreFilterCount = MORE_FILTER_KEYS.filter(
    (k) => currentFilters[k] && currentFilters[k] !== "all"
  ).length;

  const clearMoreFilters = useCallback(() => {
    const params = new URLSearchParams();
    Object.entries(currentFilters).forEach(([k, v]) => {
      if (v && k !== "page" && !(MORE_FILTER_KEYS as readonly string[]).includes(k)) {
        params.set(k, v);
      }
    });
    params.delete("page");
    router.push(`${pathname}?${params.toString()}`);
  }, [currentFilters, pathname, router]);

  // Track whether the user clicked "Use my location" to apply coords when they arrive
  const pendingGeoRef = useRef(false);
  // Track whether the user selected "nearest" sort and we're waiting for coords
  const pendingNearestRef = useRef(false);

  const handleUseMyLocation = () => {
    if (geo.latitude !== null && geo.longitude !== null) {
      const nearest = findNearestLocation(
        { latitude: geo.latitude, longitude: geo.longitude },
        locations
      );
      if (nearest) {
        updateFilter("location", nearest);
      }
      return;
    }

    pendingGeoRef.current = true;
    geo.requestPosition();
  };

  // When coords arrive after clicking "Use my location" OR selecting "nearest" sort
  useEffect(() => {
    if (geo.latitude === null || geo.longitude === null || geo.loading) return;

    // Handle pending "Use my location"
    if (pendingGeoRef.current) {
      pendingGeoRef.current = false;
      const nearest = findNearestLocation(
        { latitude: geo.latitude, longitude: geo.longitude },
        locations
      );
      if (nearest) {
        updateFilter("location", nearest);
      }
    }

    // Handle pending "nearest" sort
    if (pendingNearestRef.current) {
      pendingNearestRef.current = false;
      const params = new URLSearchParams();
      Object.entries(currentFilters).forEach(([k, v]) => {
        if (v && k !== "page") params.set(k, v);
      });
      params.set("sort", "nearest");
      params.set("lat", geo.latitude.toFixed(6));
      params.set("lng", geo.longitude.toFixed(6));
      params.delete("page");
      router.push(`${pathname}?${params.toString()}`);
    }
  }, [
    geo.latitude,
    geo.longitude,
    geo.loading,
    locations,
    updateFilter,
    currentFilters,
    pathname,
    router,
  ]);

  // Shared update handler that routes sort changes through handleSortChange
  const handleFilterUpdate = useCallback(
    (key: string, value: string | undefined) => {
      if (key === "sort") {
        handleSortChange(value || "featured");
      } else {
        updateFilter(key, value);
      }
    },
    [handleSortChange, updateFilter]
  );

  // Build NL search indicator data when AI parsed the search
  const isAIParsed = currentFilters.aiParsed === "true";
  const nlFilters: NLSearchFilters | null = isAIParsed
    ? {
        specialty: currentFilters.specialty ?? null,
        location: currentFilters.location ?? null,
        language: currentFilters.language ?? null,
        maxPrice: currentFilters.maxPrice
          ? Number(currentFilters.maxPrice) * 100
          : null,
        minRating: currentFilters.minRating
          ? Number(currentFilters.minRating)
          : null,
        consultationType: (currentFilters.consultationType as
          | "in_person"
          | "video"
          | undefined) ?? null,
        query: currentFilters.query ?? null,
      }
    : null;

  const clearAIFilters = () => {
    router.push(pathname);
  };

  return (
    <>
      {/* NL Search Indicator */}
      {nlFilters && (
        <NLSearchIndicator filters={nlFilters} onClear={clearAIFilters} />
      )}

      {/* Mobile: compact horizontal bar */}
      <div className="lg:hidden">
        <MobileFilterBar
          specialties={specialties}
          locations={locations}
          currentFilters={currentFilters}
          updateFilter={handleFilterUpdate}
          clearAll={clearAll}
          hasFilters={hasFilters}
          activeFilterCount={activeFilterCount}
          geoSupported={geo.supported}
          geoLoading={geo.loading}
          onUseMyLocation={handleUseMyLocation}
          detectingLocation={t("detecting_location")}
          useMyLocationLabel={t("use_my_location")}
        />
      </div>

      {/* Desktop: horizontal filter bar */}
      <div className="hidden lg:block">
        <DesktopFilterBar
          specialties={specialties}
          locations={locations}
          currentFilters={currentFilters}
          updateFilter={updateFilter}
          clearAll={clearAll}
          hasFilters={hasFilters}
          handleSortChange={handleSortChange}
          geoSupported={geo.supported}
          geoLoading={geo.loading}
          onUseMyLocation={handleUseMyLocation}
          detectingLocation={t("detecting_location")}
          useMyLocationLabel={t("use_my_location")}
          moreFilterCount={moreFilterCount}
          clearMoreFilters={clearMoreFilters}
        />
      </div>
    </>
  );
}
