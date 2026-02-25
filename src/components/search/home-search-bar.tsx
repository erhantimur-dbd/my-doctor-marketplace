"use client";

import { useState, useEffect, useRef, useCallback, useTransition } from "react";
import { useRouter } from "@/i18n/navigation";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Search, MapPin, Loader2, Stethoscope, User } from "lucide-react";
import { useGeolocation } from "@/hooks/use-geolocation";
import { findNearestLocation } from "@/lib/utils/geo";
import { searchSuggestions } from "@/actions/search";
import type { DoctorSuggestion } from "@/actions/search";

interface HomeSearchBarProps {
  specialties: { id: string; name_key: string; slug: string }[];
  locations: {
    id: string;
    city: string;
    country_code: string;
    slug: string;
    latitude: number | null;
    longitude: number | null;
  }[];
}

// Popular specialties shown on focus before typing
const POPULAR_SLUGS = [
  "general-practice",
  "dentistry",
  "gynecology",
  "orthopedics",
  "nutrition",
  "psychology",
  "ophthalmology",
];

export function HomeSearchBar({ specialties, locations }: HomeSearchBarProps) {
  const t = useTranslations("home");
  const router = useRouter();

  const [query, setQuery] = useState("");
  const [location, setLocation] = useState("");
  const [hasManuallySelected, setHasManuallySelected] = useState(false);

  // Autocomplete state
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [doctorResults, setDoctorResults] = useState<DoctorSuggestion[]>([]);
  const [isPending, startTransition] = useTransition();
  const [highlightIndex, setHighlightIndex] = useState(-1);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const mobileInputRef = useRef<HTMLInputElement>(null);

  // Popular specialties (resolved from the specialties prop)
  const popularSpecialties = POPULAR_SLUGS
    .map((slug) => specialties.find((s) => s.slug === slug))
    .filter(Boolean) as typeof specialties;

  const geo = useGeolocation("auto");

  // Auto-select nearest location when GPS coords arrive
  useEffect(() => {
    if (
      geo.latitude !== null &&
      geo.longitude !== null &&
      !hasManuallySelected &&
      !location
    ) {
      const nearest = findNearestLocation(
        { latitude: geo.latitude, longitude: geo.longitude },
        locations
      );
      if (nearest) {
        setLocation(nearest);
      }
    }
  }, [geo.latitude, geo.longitude, hasManuallySelected, location, locations]);

  // Filter specialties client-side
  const filteredSpecialties =
    query.trim().length >= 2
      ? specialties.filter((s) => {
          const label = s.name_key
            .replace("specialty.", "")
            .replace(/_/g, " ");
          return label.toLowerCase().includes(query.trim().toLowerCase());
        })
      : [];

  // Whether we're in "popular" mode (empty input, just focused) vs "search" mode (typing)
  const isSearchMode = query.trim().length >= 2;

  // Debounced doctor search
  useEffect(() => {
    if (!isSearchMode) {
      setDoctorResults([]);
      // Don't close suggestions here — popular list stays open on focus
      return;
    }

    setHighlightIndex(-1);

    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      startTransition(async () => {
        const results = await searchSuggestions(query.trim());
        setDoctorResults(results);
      });
    }, 300);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query, isSearchMode]);

  // Close on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        wrapperRef.current &&
        !wrapperRef.current.contains(e.target as Node)
      ) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Which specialties to show in the dropdown
  const displaySpecialties = isSearchMode
    ? filteredSpecialties.slice(0, 5)
    : popularSpecialties;

  // Build flat suggestion list for keyboard navigation
  const allSuggestions: { type: "specialty" | "doctor"; slug: string; label: string; sub?: string }[] = [
    ...displaySpecialties.map((s) => ({
      type: "specialty" as const,
      slug: s.slug,
      label: s.name_key
        .replace("specialty.", "")
        .replace(/_/g, " ")
        .replace(/\b\w/g, (l: string) => l.toUpperCase()),
    })),
    ...doctorResults.map((d) => ({
      type: "doctor" as const,
      slug: d.slug,
      label: d.name,
      sub: d.specialty,
    })),
  ];

  const handleLocationChange = (value: string) => {
    setHasManuallySelected(true);
    setLocation(value);
  };

  const handleLocateClick = () => {
    setHasManuallySelected(false);
    geo.requestPosition();
  };

  const handleSearch = useCallback(() => {
    setShowSuggestions(false);
    const params = new URLSearchParams();
    if (query.trim()) params.set("query", query.trim());
    if (location && location !== "all") params.set("location", location);
    const qs = params.toString();
    router.push(`/doctors${qs ? `?${qs}` : ""}`);
  }, [query, location, router]);

  const handleSelectSuggestion = (item: (typeof allSuggestions)[0]) => {
    setShowSuggestions(false);
    if (item.type === "specialty") {
      const params = new URLSearchParams();
      params.set("specialty", item.slug);
      if (location && location !== "all") params.set("location", location);
      router.push(`/doctors?${params.toString()}`);
    } else {
      router.push(`/doctors/${item.slug}`);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!showSuggestions || allSuggestions.length === 0) {
      if (e.key === "Enter") handleSearch();
      return;
    }

    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        setHighlightIndex((prev) =>
          prev < allSuggestions.length - 1 ? prev + 1 : 0
        );
        break;
      case "ArrowUp":
        e.preventDefault();
        setHighlightIndex((prev) =>
          prev > 0 ? prev - 1 : allSuggestions.length - 1
        );
        break;
      case "Enter":
        e.preventDefault();
        if (highlightIndex >= 0 && highlightIndex < allSuggestions.length) {
          handleSelectSuggestion(allSuggestions[highlightIndex]);
        } else {
          handleSearch();
        }
        break;
      case "Escape":
        setShowSuggestions(false);
        setHighlightIndex(-1);
        break;
    }
  };

  const hasSuggestions =
    showSuggestions &&
    (displaySpecialties.length > 0 || doctorResults.length > 0 || isPending);

  // Shared dropdown content
  const renderDropdown = () => {
    if (!hasSuggestions) return null;

    let itemIndex = -1;
    const specialtiesHeading = isSearchMode
      ? t("suggestions_specialties")
      : t("suggestions_popular");

    return (
      <div className="absolute left-0 right-0 top-full z-50 mt-1 overflow-hidden rounded-xl border bg-background shadow-lg">
        {/* Specialties group (popular or filtered) */}
        {displaySpecialties.length > 0 && (
          <div className="p-1">
            <div className="px-3 py-1.5 text-xs font-medium text-muted-foreground">
              {specialtiesHeading}
            </div>
            {displaySpecialties.map((s) => {
              itemIndex++;
              const idx = itemIndex;
              return (
                <button
                  key={s.id}
                  type="button"
                  className={`flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm transition-colors ${
                    highlightIndex === idx
                      ? "bg-accent text-accent-foreground"
                      : "hover:bg-accent/50"
                  }`}
                  onMouseEnter={() => setHighlightIndex(idx)}
                  onMouseDown={(e) => {
                    e.preventDefault(); // Prevent blur before click registers
                    handleSelectSuggestion({
                      type: "specialty",
                      slug: s.slug,
                      label: s.name_key,
                    });
                  }}
                >
                  <Stethoscope className="h-4 w-4 shrink-0 text-primary" />
                  <span>
                    {s.name_key
                      .replace("specialty.", "")
                      .replace(/_/g, " ")
                      .replace(/\b\w/g, (l: string) => l.toUpperCase())}
                  </span>
                </button>
              );
            })}
          </div>
        )}

        {/* Doctors group (only in search mode) */}
        {isSearchMode && (doctorResults.length > 0 || isPending) && (
          <div className="p-1">
            {displaySpecialties.length > 0 && (
              <div className="mx-2 border-t" />
            )}
            <div className="px-3 py-1.5 text-xs font-medium text-muted-foreground">
              {t("suggestions_doctors")}
            </div>
            {isPending && doctorResults.length === 0 && (
              <div className="flex items-center gap-2 px-3 py-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                {t("suggestions_searching")}
              </div>
            )}
            {doctorResults.map((d) => {
              itemIndex++;
              const idx = itemIndex;
              return (
                <button
                  key={d.slug}
                  type="button"
                  className={`flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm transition-colors ${
                    highlightIndex === idx
                      ? "bg-accent text-accent-foreground"
                      : "hover:bg-accent/50"
                  }`}
                  onMouseEnter={() => setHighlightIndex(idx)}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    handleSelectSuggestion({
                      type: "doctor",
                      slug: d.slug,
                      label: d.name,
                      sub: d.specialty,
                    });
                  }}
                >
                  <User className="h-4 w-4 shrink-0 text-muted-foreground" />
                  <span>{d.name}</span>
                  {d.specialty && (
                    <span className="ml-auto text-xs text-muted-foreground">
                      {d.specialty}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="mx-auto max-w-3xl" ref={wrapperRef}>
      {/* Desktop layout */}
      <div className="relative hidden md:block">
        <div className="flex items-center gap-0 rounded-full border bg-background shadow-lg transition-shadow hover:shadow-xl overflow-hidden">
          {/* Text input */}
          <div className="flex items-center gap-2 flex-1 pl-5 pr-2">
            <Search className="h-5 w-5 shrink-0 text-muted-foreground" />
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onFocus={() => setShowSuggestions(true)}
              onKeyDown={handleKeyDown}
              placeholder={t("search_name_placeholder")}
              className="h-14 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
              autoComplete="off"
            />
          </div>

          {/* Divider */}
          <div className="h-8 w-px bg-border" />

          {/* Location */}
          <div className="flex w-52 items-center">
            <div className="flex-1">
              <Select value={location} onValueChange={handleLocationChange}>
                <SelectTrigger className="h-14 border-0 shadow-none rounded-none focus:ring-0 text-sm">
                  <SelectValue placeholder={t("search_location_placeholder")} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t("search_location_placeholder")}</SelectItem>
                  {locations.map((l) => (
                    <SelectItem key={l.id} value={l.slug}>
                      {l.city}, {l.country_code}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {geo.supported && (
              <button
                type="button"
                onClick={handleLocateClick}
                disabled={geo.loading}
                className="mr-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-primary/10 hover:text-primary disabled:opacity-50"
                title={t("use_my_location")}
              >
                {geo.loading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <MapPin className="h-4 w-4" />
                )}
              </button>
            )}
          </div>

          {/* Search button */}
          <div className="pr-2">
            <Button
              size="lg"
              className="rounded-full px-6"
              onClick={handleSearch}
            >
              <Search className="mr-2 h-4 w-4" />
              {t("search_button")}
            </Button>
          </div>
        </div>

        {/* Autocomplete dropdown — desktop */}
        {renderDropdown()}
      </div>

      {/* Mobile layout */}
      <div className="relative flex md:hidden flex-col gap-3 rounded-2xl border bg-background p-4 shadow-lg">
        {/* Text input */}
        <div className="flex items-center gap-2 rounded-lg border px-3">
          <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
          <input
            ref={mobileInputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onFocus={() => setShowSuggestions(true)}
            onKeyDown={handleKeyDown}
            placeholder={t("search_name_placeholder")}
            className="h-11 flex-1 bg-transparent text-base outline-none placeholder:text-muted-foreground"
            autoComplete="off"
          />
        </div>

        {/* Autocomplete dropdown — mobile (positioned inside the card) */}
        {hasSuggestions && (
          <div className="overflow-hidden rounded-lg border bg-background shadow-sm">
            {/* Specialties group (popular or filtered) */}
            {displaySpecialties.length > 0 && (
              <div className="p-1">
                <div className="px-3 py-1.5 text-xs font-medium text-muted-foreground">
                  {isSearchMode ? t("suggestions_specialties") : t("suggestions_popular")}
                </div>
                {displaySpecialties.map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    className="flex w-full items-center gap-2 rounded-lg px-3 py-2.5 text-sm active:bg-accent/50"
                    onMouseDown={(e) => {
                      e.preventDefault();
                      handleSelectSuggestion({
                        type: "specialty",
                        slug: s.slug,
                        label: s.name_key,
                      });
                    }}
                  >
                    <Stethoscope className="h-4 w-4 shrink-0 text-primary" />
                    <span>
                      {s.name_key
                        .replace("specialty.", "")
                        .replace(/_/g, " ")
                        .replace(/\b\w/g, (l: string) => l.toUpperCase())}
                    </span>
                  </button>
                ))}
              </div>
            )}

            {/* Doctors group (only in search mode) */}
            {isSearchMode && (doctorResults.length > 0 || isPending) && (
              <div className="p-1">
                {displaySpecialties.length > 0 && (
                  <div className="mx-2 border-t" />
                )}
                <div className="px-3 py-1.5 text-xs font-medium text-muted-foreground">
                  {t("suggestions_doctors")}
                </div>
                {isPending && doctorResults.length === 0 && (
                  <div className="flex items-center gap-2 px-3 py-2 text-sm text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    {t("suggestions_searching")}
                  </div>
                )}
                {doctorResults.map((d) => (
                  <button
                    key={d.slug}
                    type="button"
                    className="flex w-full items-center gap-2 rounded-lg px-3 py-2.5 text-sm active:bg-accent/50"
                    onMouseDown={(e) => {
                      e.preventDefault();
                      handleSelectSuggestion({
                        type: "doctor",
                        slug: d.slug,
                        label: d.name,
                        sub: d.specialty,
                      });
                    }}
                  >
                    <User className="h-4 w-4 shrink-0 text-muted-foreground" />
                    <span>{d.name}</span>
                    {d.specialty && (
                      <span className="ml-auto text-xs text-muted-foreground">
                        {d.specialty}
                      </span>
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Location with locate button */}
        <div className="flex items-center gap-2">
          <div className="flex-1">
            <Select value={location} onValueChange={handleLocationChange}>
              <SelectTrigger className="h-11">
                <SelectValue placeholder={t("search_location_placeholder")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t("search_location_placeholder")}</SelectItem>
                {locations.map((l) => (
                  <SelectItem key={l.id} value={l.slug}>
                    {l.city}, {l.country_code}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {geo.supported && (
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="h-11 w-11 shrink-0"
              onClick={handleLocateClick}
              disabled={geo.loading}
              title={t("use_my_location")}
            >
              {geo.loading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <MapPin className="h-4 w-4" />
              )}
            </Button>
          )}
        </div>

        {/* Search button */}
        <Button className="h-11 w-full rounded-lg" onClick={handleSearch}>
          <Search className="mr-2 h-4 w-4" />
          {t("search_button")}
        </Button>
      </div>
    </div>
  );
}
