"use client";

import { useTranslations } from "next-intl";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import {
  Clock,
  Accessibility,
  X,
} from "lucide-react";
import { cn, formatSpecialtyName } from "@/lib/utils";
import { PlacesLocationCombobox as LocationCombobox } from "@/components/search/places-location-combobox";
import { MoreFiltersDialog } from "./more-filters-dialog";

interface DesktopFilterBarProps {
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
  updateFilter: (key: string, value: string | undefined) => void;
  clearAll: () => void;
  hasFilters: boolean;
  handleSortChange: (value: string) => void;
  geoSupported: boolean;
  geoLoading: boolean;
  onUseMyLocation: () => void;
  detectingLocation: string;
  useMyLocationLabel: string;
  moreFilterCount: number;
  clearMoreFilters: () => void;
  /** Location-specific handler that clears place params when a predefined location is selected */
  onLocationChange?: (slug: string | undefined) => void;
  /** Google Place selection handler */
  onPlaceSelect?: (place: { lat: number; lng: number; name: string }) => void;
}

export function DesktopFilterBar({
  specialties,
  locations,
  currentFilters,
  updateFilter,
  clearAll,
  hasFilters,
  handleSortChange,
  geoSupported,
  geoLoading,
  onUseMyLocation,
  detectingLocation,
  useMyLocationLabel,
  moreFilterCount,
  clearMoreFilters,
  onLocationChange,
  onPlaceSelect,
}: DesktopFilterBarProps) {
  const t = useTranslations("search");

  const chipBase =
    "inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border px-3 py-1.5 text-sm font-medium transition-colors cursor-pointer";

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-lg border bg-card p-3">
      {/* Available Today toggle chip */}
      <button
        type="button"
        onClick={() =>
          updateFilter(
            "availableToday",
            currentFilters.availableToday === "true" ? undefined : "true"
          )
        }
        className={cn(
          chipBase,
          currentFilters.availableToday === "true"
            ? "border-green-300 bg-green-50 text-green-700 dark:border-green-800 dark:bg-green-950/30 dark:text-green-400"
            : "border-border bg-background hover:bg-accent"
        )}
      >
        <Clock className="h-3.5 w-3.5" />
        {t("available_today")}
      </button>

      {/* Wheelchair Accessible toggle chip */}
      <button
        type="button"
        onClick={() =>
          updateFilter(
            "wheelchairAccessible",
            currentFilters.wheelchairAccessible === "true" ? undefined : "true"
          )
        }
        className={cn(
          chipBase,
          currentFilters.wheelchairAccessible === "true"
            ? "border-blue-300 bg-blue-50 text-blue-700 dark:border-blue-800 dark:bg-blue-950/30 dark:text-blue-400"
            : "border-border bg-background hover:bg-accent"
        )}
      >
        <Accessibility className="h-3.5 w-3.5" />
        {t("wheelchair_accessible")}
      </button>

      {/* Divider */}
      <div className="mx-1 h-6 w-px bg-border" />

      {/* Specialty */}
      <Select
        value={currentFilters.specialty || "all"}
        onValueChange={(v) => updateFilter("specialty", v)}
      >
        <SelectTrigger className="h-8 w-auto shrink-0 gap-1 rounded-full border px-3 text-sm font-medium [&>svg]:h-3.5 [&>svg]:w-3.5">
          <SelectValue placeholder={t("any_specialty")} />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">{t("any_specialty")}</SelectItem>
          {specialties.map((s) => (
            <SelectItem key={s.id} value={s.slug}>
              {formatSpecialtyName(s.name_key)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* Location */}
      <div className="shrink-0">
        <LocationCombobox
          locations={locations}
          value={currentFilters.location || ""}
          onValueChange={(v) =>
            onLocationChange
              ? onLocationChange(v || undefined)
              : updateFilter("location", v || undefined)
          }
          placeholder={t("any_location")}
          variant="pill"
          geoSupported={geoSupported}
          geoLoading={geoLoading}
          onUseMyLocation={onUseMyLocation}
          useMyLocationLabel={useMyLocationLabel}
          detectingLabel={detectingLocation}
          onPlaceSelect={onPlaceSelect}
          placeName={currentFilters.placeName}
        />
      </div>

      {/* Consultation Type */}
      <Select
        value={currentFilters.consultationType || "all"}
        onValueChange={(v) => updateFilter("consultationType", v)}
      >
        <SelectTrigger className="h-8 w-auto shrink-0 gap-1 rounded-full border px-3 text-sm font-medium [&>svg]:h-3.5 [&>svg]:w-3.5">
          <SelectValue placeholder={t("all_types")} />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">{t("all_types")}</SelectItem>
          <SelectItem value="in_person">{t("in_person")}</SelectItem>
          <SelectItem value="video">{t("video_call")}</SelectItem>
        </SelectContent>
      </Select>

      {/* More Filters dialog */}
      <MoreFiltersDialog
        currentFilters={currentFilters}
        updateFilter={updateFilter}
        moreFilterCount={moreFilterCount}
        clearMoreFilters={clearMoreFilters}
      />

      {/* Sort */}
      <Select
        value={currentFilters.sort || "featured"}
        onValueChange={handleSortChange}
      >
        <SelectTrigger className="h-8 w-auto shrink-0 gap-1 rounded-full border px-3 text-sm font-medium [&>svg]:h-3.5 [&>svg]:w-3.5">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="best_match">Best Match</SelectItem>
          <SelectItem value="featured">{t("sort_featured")}</SelectItem>
          <SelectItem value="nearest">{t("sort_nearest")}</SelectItem>
          <SelectItem value="rating">{t("sort_rating")}</SelectItem>
          <SelectItem value="price_asc">{t("sort_price_asc")}</SelectItem>
          <SelectItem value="price_desc">{t("sort_price_desc")}</SelectItem>
        </SelectContent>
      </Select>

      {/* Clear all */}
      {hasFilters && (
        <>
          <div className="mx-1 h-6 w-px bg-border" />
          <Button
            variant="ghost"
            size="sm"
            onClick={clearAll}
            className="h-8 shrink-0 rounded-full px-3 text-sm font-medium text-destructive hover:text-destructive"
          >
            <X className="mr-1 h-3 w-3" />
            {t("clear_filters")}
          </Button>
        </>
      )}
    </div>
  );
}
