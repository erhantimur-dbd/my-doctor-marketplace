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
import { X, Clock, MapPin, Loader2 } from "lucide-react";
import { useCallback, useEffect, useRef } from "react";
import { useGeolocation } from "@/hooks/use-geolocation";
import { findNearestLocation } from "@/lib/utils/geo";

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

  const clearAll = () => {
    router.push(pathname);
  };

  const hasFilters = Object.entries(currentFilters).some(
    ([k, v]) => v && k !== "sort" && k !== "page"
  );

  // Track whether the user clicked "Use my location" to apply coords when they arrive
  const pendingGeoRef = useRef(false);

  const handleUseMyLocation = () => {
    // If we already have cached coords, use them immediately
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

    // Otherwise, flag that we're waiting and request position
    pendingGeoRef.current = true;
    geo.requestPosition();
  };

  // When coords arrive after clicking "Use my location", apply the filter
  useEffect(() => {
    if (
      pendingGeoRef.current &&
      geo.latitude !== null &&
      geo.longitude !== null &&
      !geo.loading
    ) {
      pendingGeoRef.current = false;
      const nearest = findNearestLocation(
        { latitude: geo.latitude, longitude: geo.longitude },
        locations
      );
      if (nearest) {
        updateFilter("location", nearest);
      }
    }
  }, [geo.latitude, geo.longitude, geo.loading, locations, updateFilter]);

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-3">
        <CardTitle className="text-base">{t("filters")}</CardTitle>
        {hasFilters && (
          <Button variant="ghost" size="sm" onClick={clearAll} className="h-8">
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

        {/* Location */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label className="text-sm">{t("location")}</Label>
            {geo.supported && (
              <button
                type="button"
                onClick={handleUseMyLocation}
                disabled={geo.loading}
                className="flex items-center gap-1 text-xs font-medium text-primary transition-colors hover:text-primary/80 disabled:opacity-50"
              >
                {geo.loading ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  <MapPin className="h-3 w-3" />
                )}
                {geo.loading ? t("detecting_location") : t("use_my_location")}
              </button>
            )}
          </div>
          <Select
            value={currentFilters.location || "all"}
            onValueChange={(v) => updateFilter("location", v)}
          >
            <SelectTrigger>
              <SelectValue placeholder={t("any_location")} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t("any_location")}</SelectItem>
              {locations.map((l) => (
                <SelectItem key={l.id} value={l.slug}>
                  {l.city}, {l.country_code}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
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
              <SelectItem value="in_person">In Person</SelectItem>
              <SelectItem value="video">Video Call</SelectItem>
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
            onValueChange={(v) => updateFilter("sort", v)}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="featured">{t("sort_featured")}</SelectItem>
              <SelectItem value="rating">{t("sort_rating")}</SelectItem>
              <SelectItem value="price_asc">{t("sort_price_asc")}</SelectItem>
              <SelectItem value="price_desc">{t("sort_price_desc")}</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </CardContent>
    </Card>
  );
}
