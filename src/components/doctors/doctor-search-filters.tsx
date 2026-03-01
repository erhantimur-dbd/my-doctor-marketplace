"use client";

import { useRouter, usePathname } from "@/i18n/navigation";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { X, Clock, Accessibility } from "lucide-react";
import { useCallback, useEffect, useRef } from "react";
import { useGeolocation } from "@/hooks/use-geolocation";
import { findNearestLocation } from "@/lib/utils/geo";
import { MobileFilterBar } from "./mobile-filter-bar";
import { LocationCombobox } from "@/components/search/location-combobox";

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
    ([k, v]) => v && k !== "sort" && k !== "page" && k !== "lat" && k !== "lng"
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
      k !== "query"
  ).length;

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

  return (
    <>
      {/* Mobile: compact horizontal bar */}
      <div className="lg:hidden">
        <MobileFilterBar
          specialties={specialties}
          locations={locations}
          currentFilters={currentFilters}
          updateFilter={(key, value) => {
            if (key === "sort") {
              handleSortChange(value || "featured");
            } else {
              updateFilter(key, value);
            }
          }}
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

      {/* Desktop: existing sidebar card */}
      <div className="hidden lg:block">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-3">
            <CardTitle className="text-base">{t("filters")}</CardTitle>
            {hasFilters && (
              <Button
                variant="ghost"
                size="sm"
                onClick={clearAll}
                className="h-8"
              >
                <X className="mr-1 h-3 w-3" />
                {t("clear_filters")}
              </Button>
            )}
          </CardHeader>
          <CardContent className="space-y-5">
            {/* Available Today */}
            <div className="flex items-center justify-between rounded-lg border border-green-200 bg-green-50 p-3 dark:border-green-900 dark:bg-green-950/30">
              <Label className="flex items-center gap-2 text-sm font-medium cursor-pointer">
                <Clock className="h-4 w-4 text-green-600" />
                {t("available_today")}
              </Label>
              <Switch
                checked={currentFilters.availableToday === "true"}
                onCheckedChange={(checked) =>
                  updateFilter("availableToday", checked ? "true" : undefined)
                }
              />
            </div>

            {/* Wheelchair Accessible */}
            <div className="flex items-center justify-between rounded-lg border border-blue-200 bg-blue-50 p-3 dark:border-blue-900 dark:bg-blue-950/30">
              <Label className="flex items-center gap-2 text-sm font-medium cursor-pointer">
                <Accessibility className="h-4 w-4 text-blue-600" />
                {t("wheelchair_accessible")}
              </Label>
              <Switch
                checked={currentFilters.wheelchairAccessible === "true"}
                onCheckedChange={(checked) =>
                  updateFilter("wheelchairAccessible", checked ? "true" : undefined)
                }
              />
            </div>

            {/* Specialty */}
            <div className="space-y-2">
              <Label className="text-sm">{t("specialty")}</Label>
              <Select
                value={currentFilters.specialty || "all"}
                onValueChange={(v) => updateFilter("specialty", v)}
              >
                <SelectTrigger>
                  <SelectValue placeholder={t("any_specialty")} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t("any_specialty")}</SelectItem>
                  {specialties.map((s) => (
                    <SelectItem key={s.id} value={s.slug}>
                      {s.name_key
                        .replace("specialty.", "")
                        .replace(/_/g, " ")
                        .replace(/\b\w/g, (l: string) => l.toUpperCase())}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Location — searchable combobox */}
            <div className="space-y-2">
              <Label className="text-sm">{t("location")}</Label>
              <LocationCombobox
                locations={locations}
                value={currentFilters.location || ""}
                onValueChange={(v) => updateFilter("location", v || undefined)}
                placeholder={t("any_location")}
                variant="bordered"
                geoSupported={geo.supported}
                geoLoading={geo.loading}
                onUseMyLocation={handleUseMyLocation}
                useMyLocationLabel={t("use_my_location")}
                detectingLabel={t("detecting_location")}
              />
            </div>

            {/* Consultation Type */}
            <div className="space-y-2">
              <Label className="text-sm">{t("consultation_type")}</Label>
              <Select
                value={currentFilters.consultationType || "all"}
                onValueChange={(v) => updateFilter("consultationType", v)}
              >
                <SelectTrigger>
                  <SelectValue placeholder={t("all_types")} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t("all_types")}</SelectItem>
                  <SelectItem value="in_person">{t("in_person")}</SelectItem>
                  <SelectItem value="video">{t("video_call")}</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Minimum Rating */}
            <div className="space-y-2">
              <Label className="text-sm">{t("min_rating")}</Label>
              <Select
                value={currentFilters.minRating || "all"}
                onValueChange={(v) => updateFilter("minRating", v)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Any" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Any</SelectItem>
                  <SelectItem value="4.5">4.5+</SelectItem>
                  <SelectItem value="4">4.0+</SelectItem>
                  <SelectItem value="3.5">3.5+</SelectItem>
                  <SelectItem value="3">3.0+</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Sort */}
            <div className="space-y-2">
              <Label className="text-sm">{t("sort_by")}</Label>
              <Select
                value={currentFilters.sort || "featured"}
                onValueChange={handleSortChange}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="featured">
                    {t("sort_featured")}
                  </SelectItem>
                  <SelectItem value="nearest">
                    {t("sort_nearest")}
                  </SelectItem>
                  <SelectItem value="rating">{t("sort_rating")}</SelectItem>
                  <SelectItem value="price_asc">
                    {t("sort_price_asc")}
                  </SelectItem>
                  <SelectItem value="price_desc">
                    {t("sort_price_desc")}
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
