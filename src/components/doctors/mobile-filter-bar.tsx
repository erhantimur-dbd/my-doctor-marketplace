"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Clock, SlidersHorizontal, X, MapPin, Loader2, Accessibility } from "lucide-react";
import { cn } from "@/lib/utils";

interface MobileFilterBarProps {
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
  activeFilterCount: number;
  geoSupported: boolean;
  geoLoading: boolean;
  onUseMyLocation: () => void;
  detectingLocation: string;
  useMyLocationLabel: string;
}

export function MobileFilterBar({
  specialties,
  locations,
  currentFilters,
  updateFilter,
  clearAll,
  hasFilters,
  activeFilterCount,
  geoSupported,
  geoLoading,
  onUseMyLocation,
  detectingLocation,
  useMyLocationLabel,
}: MobileFilterBarProps) {
  const t = useTranslations("search");
  const [sheetOpen, setSheetOpen] = useState(false);

  return (
    <div className="flex items-center gap-2 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      {/* Available Today chip */}
      <button
        type="button"
        onClick={() =>
          updateFilter(
            "availableToday",
            currentFilters.availableToday === "true" ? undefined : "true"
          )
        }
        className={cn(
          "inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border px-3 py-1.5 text-sm font-medium transition-colors",
          currentFilters.availableToday === "true"
            ? "border-green-300 bg-green-50 text-green-700 dark:border-green-800 dark:bg-green-950/30 dark:text-green-400"
            : "border-border bg-background hover:bg-accent"
        )}
      >
        <Clock className="h-3.5 w-3.5" />
        {t("available_today")}
      </button>

      {/* Wheelchair Accessible chip */}
      <button
        type="button"
        onClick={() =>
          updateFilter(
            "wheelchairAccessible",
            currentFilters.wheelchairAccessible === "true" ? undefined : "true"
          )
        }
        className={cn(
          "inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border px-3 py-1.5 text-sm font-medium transition-colors",
          currentFilters.wheelchairAccessible === "true"
            ? "border-blue-300 bg-blue-50 text-blue-700 dark:border-blue-800 dark:bg-blue-950/30 dark:text-blue-400"
            : "border-border bg-background hover:bg-accent"
        )}
      >
        <Accessibility className="h-3.5 w-3.5" />
        {t("wheelchair_accessible")}
      </button>

      {/* Sort dropdown */}
      <Select
        value={currentFilters.sort || "featured"}
        onValueChange={(v) => updateFilter("sort", v)}
      >
        <SelectTrigger className="h-8 w-auto shrink-0 gap-1 rounded-full border px-3 text-sm font-medium [&>svg]:h-3.5 [&>svg]:w-3.5">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="featured">{t("sort_featured")}</SelectItem>
          <SelectItem value="nearest">{t("sort_nearest")}</SelectItem>
          <SelectItem value="rating">{t("sort_rating")}</SelectItem>
          <SelectItem value="price_asc">{t("sort_price_asc")}</SelectItem>
          <SelectItem value="price_desc">{t("sort_price_desc")}</SelectItem>
        </SelectContent>
      </Select>

      {/* Filters button → opens bottom sheet */}
      <button
        type="button"
        onClick={() => setSheetOpen(true)}
        className="inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border px-3 py-1.5 text-sm font-medium transition-colors hover:bg-accent"
      >
        <SlidersHorizontal className="h-3.5 w-3.5" />
        {t("filters")}
        {activeFilterCount > 0 && (
          <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-bold text-primary-foreground">
            {activeFilterCount}
          </span>
        )}
      </button>

      {/* Clear chip (only when filters active) */}
      {hasFilters && (
        <button
          type="button"
          onClick={clearAll}
          className="inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded-full border border-destructive/30 px-3 py-1.5 text-sm font-medium text-destructive transition-colors hover:bg-destructive/10"
        >
          <X className="h-3 w-3" />
          {t("clear_filters")}
        </button>
      )}

      {/* Bottom Sheet with full filters */}
      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent
          side="bottom"
          className="max-h-[80vh] rounded-t-2xl"
          showCloseButton={false}
        >
          <SheetHeader className="pb-2">
            <div className="mx-auto mb-2 h-1 w-10 rounded-full bg-muted-foreground/20" />
            <SheetTitle>{t("filters")}</SheetTitle>
          </SheetHeader>

          <div className="space-y-5 overflow-y-auto px-4 pb-4">
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
                {geoSupported && (
                  <button
                    type="button"
                    onClick={onUseMyLocation}
                    disabled={geoLoading}
                    className="flex items-center gap-1 text-xs font-medium text-primary transition-colors hover:text-primary/80 disabled:opacity-50"
                  >
                    {geoLoading ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : (
                      <MapPin className="h-3 w-3" />
                    )}
                    {geoLoading ? detectingLocation : useMyLocationLabel}
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
                  <SelectItem value="in_person">{t("in_person")}</SelectItem>
                  <SelectItem value="video">{t("video_call")}</SelectItem>
                </SelectContent>
              </Select>
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
          </div>

          <SheetFooter className="flex-row gap-2 border-t pt-4">
            <Button variant="outline" className="flex-1" onClick={clearAll}>
              {t("clear_filters")}
            </Button>
            <SheetClose asChild>
              <Button className="flex-1">{t("show_results")}</Button>
            </SheetClose>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </div>
  );
}
