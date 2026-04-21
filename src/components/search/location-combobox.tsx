"use client";

import { useState, useRef, useEffect, useCallback, useMemo, useTransition } from "react";
import { MapPin, Loader2, Check, Navigation, Search } from "lucide-react";
import { cn } from "@/lib/utils";
import { geocodeAddress, findNearestLocation } from "@/lib/utils/geo";
import { searchPlaces, getPlaceCoordinates } from "@/actions/places";
import type { PlacePrediction } from "@/actions/places";

export interface LocationItem {
  slug: string;
  city: string;
  country_code: string;
  latitude: number | null;
  longitude: number | null;
}

// Map of country codes to display names — limited to launch regions.
// Add new countries here as we expand to new markets.
const COUNTRY_NAMES: Record<string, string> = {
  GB: "United Kingdom",
  IE: "Ireland",
  IT: "Italy",
  TR: "Turkey",
  ES: "Spain",
};

/** Build a country slug like "country-gb" from a country code */
export function countrySlug(code: string): string {
  return `country-${code.toLowerCase()}`;
}

/** Check if a slug is a country-level slug */
export function isCountrySlug(slug: string): boolean {
  return slug.startsWith("country-");
}

/** Extract country code from a country slug */
export function countryCodeFromSlug(slug: string): string {
  return slug.replace("country-", "").toUpperCase();
}

export interface LocationComboboxProps {
  locations: LocationItem[];
  value: string; // location slug or ""
  onValueChange: (slug: string) => void;
  placeholder?: string;
  /** Render as a compact inline input (for home search bar), a full-width bordered input (for filters), a pill chip (for horizontal filter bar), or a seamless input with no chrome (for labeled containers) */
  variant?: "inline" | "bordered" | "pill" | "seamless";
  /** Show "Use my location" button */
  geoSupported?: boolean;
  geoLoading?: boolean;
  onUseMyLocation?: () => void;
  useMyLocationLabel?: string;
  detectingLabel?: string;
  className?: string;
  /** Called when Enter is pressed while the dropdown is closed or no item is highlighted */
  onEnterKey?: () => void;
  /** Called when a Google Place is selected (borough, street, etc.) */
  onPlaceSelect?: (place: { lat: number; lng: number; name: string }) => void;
  /** Display name of a selected Place (shown when value is empty but a Place was chosen) */
  placeName?: string;
  /**
   * Injected by PlacesLocationCombobox wrapper — the loaded google.maps.places
   * namespace for client-side autocomplete. When provided, uses the Maps JS API
   * instead of the server-side REST action (which fails with referrer-restricted keys).
   * @internal
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  _placesLib?: any;
}

// Country code → emoji flag
function countryFlag(code: string): string {
  const codePoints = code
    .toUpperCase()
    .split("")
    .map((c) => 0x1f1e6 + c.charCodeAt(0) - 65);
  return String.fromCodePoint(...codePoints);
}

// Detect if input looks like a postcode (starts with digits, or UK-style like "SW1" / "EC1A")
function looksLikePostcode(input: string): boolean {
  const trimmed = input.trim();
  return /^\d{2,}/.test(trimmed) || /^[A-Z]{1,2}\d/i.test(trimmed);
}

export function LocationCombobox({
  locations,
  value,
  onValueChange,
  placeholder = "City, borough, or postcode...",
  variant = "bordered",
  geoSupported,
  geoLoading,
  onUseMyLocation,
  useMyLocationLabel = "Use my location",
  detectingLabel = "Detecting...",
  className,
  onEnterKey,
  onPlaceSelect,
  placeName,
  _placesLib,
}: LocationComboboxProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [geocoding, setGeocoding] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const placesDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [geocodeResult, setGeocodeResult] = useState<string | null>(null);

  // Google Places Autocomplete state
  const [placePredictions, setPlacePredictions] = useState<PlacePrediction[]>([]);
  const [placesLoading, startPlacesTransition] = useTransition();
  const [placesDebouncing, setPlacesDebouncing] = useState(false);
  const [resolvingPlace, setResolvingPlace] = useState(false);

  // Client-side AutocompleteService (created once when _placesLib is ready)
  const autocompleteServiceRef = useRef<google.maps.places.AutocompleteService | null>(null);
  useEffect(() => {
    if (_placesLib && !autocompleteServiceRef.current) {
      autocompleteServiceRef.current = new _placesLib.AutocompleteService();
    }
  }, [_placesLib]);

  // Build unique countries from locations
  const countries = useMemo(() => {
    const seen = new Set<string>();
    const result: { code: string; name: string; slug: string }[] = [];
    for (const loc of locations) {
      if (!seen.has(loc.country_code)) {
        seen.add(loc.country_code);
        result.push({
          code: loc.country_code,
          name: COUNTRY_NAMES[loc.country_code] || loc.country_code,
          slug: countrySlug(loc.country_code),
        });
      }
    }
    // Pin priority market(s) to the top, then sort the rest alphabetically
    const PRIORITY_COUNTRIES = ["GB"];
    return result.sort((a, b) => {
      const aPriority = PRIORITY_COUNTRIES.indexOf(a.code);
      const bPriority = PRIORITY_COUNTRIES.indexOf(b.code);
      if (aPriority !== -1 && bPriority !== -1) return aPriority - bPriority;
      if (aPriority !== -1) return -1;
      if (bPriority !== -1) return 1;
      return a.name.localeCompare(b.name);
    });
  }, [locations]);

  // Selected location display text
  const isCountrySelected = isCountrySlug(value);
  const selectedCountry = isCountrySelected
    ? countries.find((c) => c.slug === value)
    : null;
  const selectedLocation = !isCountrySelected
    ? locations.find((l) => l.slug === value)
    : null;
  const displayText = selectedCountry
    ? `${countryFlag(selectedCountry.code)} ${selectedCountry.name}`
    : selectedLocation
      ? `${selectedLocation.city}, ${COUNTRY_NAMES[selectedLocation.country_code] || selectedLocation.country_code}`
      : placeName || "";

  // UK-only launch: hide non-UK cities and surface popular cities first.
  const UK_CITY_PRIORITY = ["london", "manchester", "liverpool", "leeds", "birmingham", "edinburgh"];
  const ukLocations = useMemo(() => {
    const uk = locations.filter((l) => l.country_code === "GB");
    return uk.sort((a, b) => {
      const aIdx = UK_CITY_PRIORITY.indexOf(a.city.toLowerCase());
      const bIdx = UK_CITY_PRIORITY.indexOf(b.city.toLowerCase());
      if (aIdx !== -1 && bIdx !== -1) return aIdx - bIdx;
      if (aIdx !== -1) return -1;
      if (bIdx !== -1) return 1;
      return a.city.localeCompare(b.city);
    });
  }, [locations]);

  const term = search.trim().toLowerCase();
  const filteredLocations = term
    ? ukLocations.filter((l) => {
        return (
          l.city.toLowerCase().includes(term) ||
          l.country_code.toLowerCase().includes(term) ||
          l.slug.toLowerCase().includes(term)
        );
      })
    : ukLocations;

  // Handle postcode geocoding with debounce
  useEffect(() => {
    if (!search.trim() || !looksLikePostcode(search)) {
      setGeocodeResult(null);
      return;
    }

    // If there are exact city matches, don't geocode
    if (filteredLocations.length > 0) {
      setGeocodeResult(null);
      return;
    }

    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      setGeocoding(true);
      const coords = await geocodeAddress(search.trim());
      if (coords) {
        const nearest = findNearestLocation(
          { latitude: coords.lat, longitude: coords.lng },
          locations
        );
        setGeocodeResult(nearest);
      } else {
        setGeocodeResult(null);
      }
      setGeocoding(false);
    }, 500);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [search, filteredLocations.length, locations]);

  // Google Places Autocomplete with debounce
  useEffect(() => {
    if (!onPlaceSelect) {
      setPlacePredictions([]);
      setPlacesDebouncing(false);
      return;
    }

    const trimmed = search.trim();
    if (trimmed.length < 2) {
      setPlacePredictions([]);
      setPlacesDebouncing(false);
      return;
    }

    // Only search places when there are few or no predefined matches
    // (more than 3 predefined matches means the user is probably finding what they need)
    if (filteredLocations.length > 3) {
      setPlacePredictions([]);
      setPlacesDebouncing(false);
      return;
    }

    // Mark that we're waiting for the debounce to fire
    setPlacesDebouncing(true);

    if (placesDebounceRef.current) clearTimeout(placesDebounceRef.current);
    placesDebounceRef.current = setTimeout(() => {
      setPlacesDebouncing(false);

      // Prefer client-side Places library (works with referrer-restricted keys)
      if (autocompleteServiceRef.current) {
        startPlacesTransition(() => {
          autocompleteServiceRef.current!.getPlacePredictions(
            {
              input: trimmed,
              types: ["geocode"],
              componentRestrictions: { country: ["gb", "ie", "it", "tr", "es"] },
            },
            (predictions, status) => {
              if (
                status === google.maps.places.PlacesServiceStatus.OK &&
                predictions
              ) {
                setPlacePredictions(
                  predictions.slice(0, 5).map((p) => ({
                    placeId: p.place_id,
                    description: p.description,
                    mainText:
                      p.structured_formatting?.main_text || p.description,
                    secondaryText:
                      p.structured_formatting?.secondary_text || "",
                  }))
                );
              } else {
                setPlacePredictions([]);
              }
            }
          );
        });
      } else {
        // Fallback: server-side REST action (may fail with referrer-restricted keys)
        startPlacesTransition(async () => {
          const predictions = await searchPlaces(trimmed);
          setPlacePredictions(predictions);
        });
      }
    }, 400);

    return () => {
      if (placesDebounceRef.current) clearTimeout(placesDebounceRef.current);
    };
  }, [search, filteredLocations.length, onPlaceSelect, _placesLib]);

  // Close on click outside
  useEffect(() => {
    const handle = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handle);
    return () => document.removeEventListener("mousedown", handle);
  }, []);

  const handleSelect = useCallback(
    (slug: string) => {
      onValueChange(slug);
      setSearch("");
      setOpen(false);
      setGeocodeResult(null);
      setPlacePredictions([]);
    },
    [onValueChange]
  );

  const handlePlaceClick = useCallback(
    async (prediction: PlacePrediction) => {
      if (!onPlaceSelect) return;

      setResolvingPlace(true);
      try {
        // Prefer client-side Geocoder (same API key, works with referrer restriction)
        if (typeof google !== "undefined" && google.maps) {
          const geocoder = new google.maps.Geocoder();
          const result = await geocoder.geocode({ placeId: prediction.placeId });
          const loc = result.results[0]?.geometry?.location;
          if (loc) {
            onPlaceSelect({
              lat: loc.lat(),
              lng: loc.lng(),
              name: prediction.mainText,
            });
            // Don't call onValueChange("") here — onPlaceSelect already
            // handles clearing the predefined location param via the URL.
            // Calling onValueChange("") would trigger a second router.push
            // that wipes the place params.
            return;
          }
        }

        // Fallback: server-side Place Details
        const coords = await getPlaceCoordinates(prediction.placeId);
        if (coords) {
          onPlaceSelect({
            lat: coords.lat,
            lng: coords.lng,
            name: prediction.mainText,
          });
        }
      } catch {
        // Last resort: geocode the description text
        const coords = await geocodeAddress(prediction.description);
        if (coords) {
          onPlaceSelect({
            lat: coords.lat,
            lng: coords.lng,
            name: prediction.mainText,
          });
        }
      } finally {
        setResolvingPlace(false);
        setSearch("");
        setOpen(false);
        setPlacePredictions([]);
      }
    },
    [onPlaceSelect, onValueChange]
  );

  const handleClear = useCallback(() => {
    onValueChange("");
    setSearch("");
    setGeocodeResult(null);
    setPlacePredictions([]);
    // Also clear place selection if callback exists
    if (onPlaceSelect) {
      onPlaceSelect({ lat: 0, lng: 0, name: "" });
    }
  }, [onValueChange, onPlaceSelect]);

  const isInline = variant === "inline";
  const isPill = variant === "pill";
  const isSeamless = variant === "seamless";

  // Show clear button when either a predefined location or a Place is selected
  const hasSelection = !!value || !!placeName;

  return (
    <div ref={wrapperRef} className={cn("relative", className)}>
      {/* Input trigger */}
      <div
        className={cn(
          "flex items-center gap-2",
          isInline
            ? "h-14 px-3"
            : isSeamless
              ? "h-6 px-0"
              : isPill
                ? "h-8 rounded-full border border-input bg-background px-3 text-sm font-medium"
                : "h-10 rounded-md border border-input bg-background px-3 ring-offset-background focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2"
        )}
      >
        {!isSeamless && <MapPin className="h-4 w-4 shrink-0 text-muted-foreground" />}
        <input
          ref={inputRef}
          type="text"
          value={open ? search : displayText}
          onChange={(e) => {
            setSearch(e.target.value);
            if (!open) setOpen(true);
          }}
          onFocus={() => {
            setOpen(true);
            setSearch("");
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              // If geocode result is available, select it
              if (geocodeResult) {
                e.preventDefault();
                handleSelect(geocodeResult);
              } else if (filteredLocations.length === 1 && search.trim()) {
                // Auto-select if exactly one match
                e.preventDefault();
                handleSelect(filteredLocations[0].slug);
              } else if (placePredictions.length === 1 && search.trim()) {
                // Auto-select if exactly one Google Place result
                e.preventDefault();
                handlePlaceClick(placePredictions[0]);
              } else if (!open || filteredLocations.length === 0) {
                // Bubble up to parent search handler
                if (onEnterKey) {
                  e.preventDefault();
                  setOpen(false);
                  onEnterKey();
                }
              }
            } else if (e.key === "Escape") {
              setOpen(false);
              inputRef.current?.blur();
            }
          }}
          placeholder={placeholder}
          className={cn(
            "flex-1 bg-transparent outline-none placeholder:text-muted-foreground min-w-0",
            isInline ? "text-sm" : "text-sm"
          )}
          autoComplete="off"
        />
        {hasSelection && !open && (
          <button
            type="button"
            onClick={handleClear}
            className={cn(
              "shrink-0 text-muted-foreground hover:text-foreground",
              isInline && "mr-1"
            )}
          >
            ×
          </button>
        )}
        {(geocoding || resolvingPlace) && <Loader2 className="h-4 w-4 shrink-0 animate-spin text-muted-foreground" />}
      </div>

      {/* Dropdown */}
      {open && (
        <div className="absolute left-0 right-0 top-full z-50 mt-1 max-h-80 overflow-y-auto rounded-lg border bg-background shadow-lg">
          {/* Use my location button */}
          {geoSupported && onUseMyLocation && (
            <button
              type="button"
              onClick={() => {
                onUseMyLocation();
                setOpen(false);
              }}
              disabled={geoLoading}
              className="flex w-full items-center gap-2 border-b px-3 py-2.5 text-sm font-medium text-primary transition-colors hover:bg-accent disabled:opacity-50"
            >
              {geoLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Navigation className="h-4 w-4" />
              )}
              {geoLoading ? detectingLabel : useMyLocationLabel}
            </button>
          )}

          {/* "All locations" option */}
          <button
            type="button"
            onClick={() => handleSelect("")}
            className={cn(
              "flex w-full items-center gap-2 px-3 py-2 text-sm transition-colors hover:bg-accent",
              !value && !placeName && "font-medium"
            )}
          >
            <MapPin className="h-4 w-4 text-muted-foreground" />
            <span>All Locations</span>
            {!value && !placeName && <Check className="ml-auto h-4 w-4 text-primary" />}
          </button>

          {/* Geocode result (when postcode matched a location) */}
          {geocodeResult && (
            <div className="border-t px-3 py-1.5">
              <p className="text-xs text-muted-foreground">Nearest city for &ldquo;{search.trim()}&rdquo;</p>
              {(() => {
                const loc = locations.find((l) => l.slug === geocodeResult);
                if (!loc) return null;
                return (
                  <button
                    type="button"
                    onClick={() => handleSelect(loc.slug)}
                    className="flex w-full items-center gap-2 rounded-md px-0 py-2 text-sm font-medium text-primary transition-colors hover:bg-accent"
                  >
                    <span>{countryFlag(loc.country_code)}</span>
                    <span>{loc.city}, {loc.country_code}</span>
                    {value === loc.slug && (
                      <Check className="ml-auto h-4 w-4" />
                    )}
                  </button>
                );
              })()}
            </div>
          )}

          {/* Google Places suggestions */}
          {onPlaceSelect && placePredictions.length > 0 && (
            <div className="border-t">
              <div className="px-3 pt-2 pb-1">
                <span className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground/70">
                  Nearby Places
                </span>
              </div>
              {placePredictions.map((p) => (
                <button
                  key={p.placeId}
                  type="button"
                  onClick={() => handlePlaceClick(p)}
                  disabled={resolvingPlace}
                  className="flex w-full items-center gap-2 px-3 py-2 text-sm transition-colors hover:bg-accent disabled:opacity-50"
                >
                  <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
                  <div className="min-w-0 text-left">
                    <span className="font-medium">{p.mainText}</span>
                    {p.secondaryText && (
                      <span className="ml-1 text-muted-foreground">{p.secondaryText}</span>
                    )}
                  </div>
                </button>
              ))}
            </div>
          )}

          {/* Cities group */}
          {filteredLocations.length > 0 && (
            <div>
              <div className="px-3 pt-2 pb-1">
                <span className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground/70">
                  Cities
                </span>
              </div>
              {filteredLocations.map((loc) => (
                <button
                  key={loc.slug}
                  type="button"
                  onClick={() => handleSelect(loc.slug)}
                  className={cn(
                    "flex w-full items-center gap-2 px-3 py-2 text-sm transition-colors hover:bg-accent",
                    value === loc.slug && "font-medium"
                  )}
                >
                  <span className="text-base">{countryFlag(loc.country_code)}</span>
                  <span>{loc.city}, {loc.country_code}</span>
                  {value === loc.slug && (
                    <Check className="ml-auto h-4 w-4 text-primary" />
                  )}
                </button>
              ))}
            </div>
          )}

          {/* No results */}
          {filteredLocations.length === 0 && placePredictions.length === 0 && !geocodeResult && !geocoding && !placesLoading && !placesDebouncing && search.trim() && (
            <div className="px-3 py-4 text-center text-sm text-muted-foreground">
              No locations found for &ldquo;{search.trim()}&rdquo;
            </div>
          )}

          {/* Loading states */}
          {(geocoding || placesLoading || placesDebouncing) && filteredLocations.length === 0 && placePredictions.length === 0 && (
            <div className="flex items-center gap-2 px-3 py-4 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Searching places...
            </div>
          )}
        </div>
      )}
    </div>
  );
}
