"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { MapPin, Loader2, Check, Navigation } from "lucide-react";
import { cn } from "@/lib/utils";
import { geocodeAddress, findNearestLocation } from "@/lib/utils/geo";

export interface LocationItem {
  slug: string;
  city: string;
  country_code: string;
  latitude: number | null;
  longitude: number | null;
}

interface LocationComboboxProps {
  locations: LocationItem[];
  value: string; // location slug or ""
  onValueChange: (slug: string) => void;
  placeholder?: string;
  /** Render as a compact inline input (for home search bar) vs a full-width bordered input (for filters) */
  variant?: "inline" | "bordered";
  /** Show "Use my location" button */
  geoSupported?: boolean;
  geoLoading?: boolean;
  onUseMyLocation?: () => void;
  useMyLocationLabel?: string;
  detectingLabel?: string;
  className?: string;
  /** Called when Enter is pressed while the dropdown is closed or no item is highlighted */
  onEnterKey?: () => void;
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
  placeholder = "City or postcode...",
  variant = "bordered",
  geoSupported,
  geoLoading,
  onUseMyLocation,
  useMyLocationLabel = "Use my location",
  detectingLabel = "Detecting...",
  className,
  onEnterKey,
}: LocationComboboxProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [geocoding, setGeocoding] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [geocodeResult, setGeocodeResult] = useState<string | null>(null);

  // Selected location display text
  const selectedLocation = locations.find((l) => l.slug === value);
  const displayText = selectedLocation
    ? `${selectedLocation.city}, ${selectedLocation.country_code}`
    : "";

  // Filter locations client-side
  const filteredLocations = search.trim()
    ? locations.filter((l) => {
        const term = search.trim().toLowerCase();
        return (
          l.city.toLowerCase().includes(term) ||
          l.country_code.toLowerCase().includes(term) ||
          l.slug.toLowerCase().includes(term)
        );
      })
    : locations;

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
    },
    [onValueChange]
  );

  const handleClear = useCallback(() => {
    onValueChange("");
    setSearch("");
    setGeocodeResult(null);
  }, [onValueChange]);

  const isInline = variant === "inline";

  return (
    <div ref={wrapperRef} className={cn("relative", className)}>
      {/* Input trigger */}
      <div
        className={cn(
          "flex items-center gap-2",
          isInline
            ? "h-14 px-3"
            : "h-10 rounded-md border border-input bg-background px-3 ring-offset-background focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2"
        )}
      >
        <MapPin className="h-4 w-4 shrink-0 text-muted-foreground" />
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
        {value && !open && (
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
        {geocoding && <Loader2 className="h-4 w-4 shrink-0 animate-spin text-muted-foreground" />}
      </div>

      {/* Dropdown */}
      {open && (
        <div className="absolute left-0 right-0 top-full z-50 mt-1 max-h-64 overflow-y-auto rounded-lg border bg-background shadow-lg">
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
              !value && "font-medium"
            )}
          >
            <MapPin className="h-4 w-4 text-muted-foreground" />
            <span>All Locations</span>
            {!value && <Check className="ml-auto h-4 w-4 text-primary" />}
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

          {/* Filtered location list */}
          {filteredLocations.length > 0 && (
            <div className={geocodeResult ? "border-t" : ""}>
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
          {filteredLocations.length === 0 && !geocodeResult && !geocoding && search.trim() && (
            <div className="px-3 py-4 text-center text-sm text-muted-foreground">
              No locations found for &ldquo;{search.trim()}&rdquo;
            </div>
          )}

          {/* Geocoding in progress */}
          {geocoding && filteredLocations.length === 0 && (
            <div className="flex items-center gap-2 px-3 py-4 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Looking up postcode...
            </div>
          )}
        </div>
      )}
    </div>
  );
}
