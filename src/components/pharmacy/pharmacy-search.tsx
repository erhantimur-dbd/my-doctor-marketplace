"use client";

import { useState, useCallback } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Search,
  MapPin,
  List,
  Map as MapIcon,
  Loader2,
  Pill,
} from "lucide-react";
import { PharmacyCard } from "./pharmacy-card";
import { PharmacyMapWrapper } from "./pharmacy-map-wrapper";
import type { Pharmacy } from "@/types/pharmacy";

export function PharmacySearch() {
  const [postcode, setPostcode] = useState("");
  const [pharmacies, setPharmacies] = useState<Pharmacy[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searched, setSearched] = useState(false);
  const [viewMode, setViewMode] = useState<"list" | "map">("list");
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  const handleSearch = useCallback(async () => {
    const trimmed = postcode.trim();
    if (!trimmed) return;

    setLoading(true);
    setError(null);
    setSearched(true);

    try {
      const res = await fetch("/api/pharmacy-search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ postcode: trimmed }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Something went wrong");
        setPharmacies([]);
        setTotal(0);
        return;
      }

      setPharmacies(data.pharmacies);
      setTotal(data.total);
    } catch {
      setError("Failed to search. Please check your connection and try again.");
      setPharmacies([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, [postcode]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") handleSearch();
  };

  return (
    <div className="mx-auto max-w-5xl">
      {/* Search bar */}
      <div className="mx-auto max-w-xl">
        <div className="flex gap-2">
          <div className="relative flex-1">
            <MapPin className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Enter UK postcode (e.g. SW1A 1AA)"
              value={postcode}
              onChange={(e) => setPostcode(e.target.value.toUpperCase())}
              onKeyDown={handleKeyDown}
              className="pl-10"
              disabled={loading}
            />
          </div>
          <Button onClick={handleSearch} disabled={loading || !postcode.trim()}>
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Search className="h-4 w-4" />
            )}
            <span className="ml-2 hidden sm:inline">Search</span>
          </Button>
        </div>
      </div>

      {/* Results header with view toggle */}
      {searched && !loading && pharmacies.length > 0 && (
        <div className="mt-8 flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            {total} {total === 1 ? "pharmacy" : "pharmacies"} found
          </p>
          <div className="flex gap-1 rounded-lg border p-1">
            <Button
              size="sm"
              variant={viewMode === "list" ? "default" : "ghost"}
              className="h-8 px-2.5"
              onClick={() => setViewMode("list")}
            >
              <List className="mr-1.5 h-3.5 w-3.5" />
              List
            </Button>
            <Button
              size="sm"
              variant={viewMode === "map" ? "default" : "ghost"}
              className="h-8 px-2.5"
              onClick={() => setViewMode("map")}
            >
              <MapIcon className="mr-1.5 h-3.5 w-3.5" />
              Map
            </Button>
          </div>
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className="mt-12 flex flex-col items-center gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">
            Searching pharmacies...
          </p>
        </div>
      )}

      {/* Error */}
      {error && !loading && (
        <Card className="mt-8">
          <CardContent className="py-8 text-center">
            <p className="text-sm text-destructive">{error}</p>
          </CardContent>
        </Card>
      )}

      {/* Empty */}
      {searched && !loading && !error && pharmacies.length === 0 && (
        <Card className="mt-8">
          <CardContent className="py-12 text-center">
            <Pill className="mx-auto h-10 w-10 text-muted-foreground/50" />
            <p className="mt-4 font-medium">No pharmacies found</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Try a different postcode or check the postcode is correct.
            </p>
          </CardContent>
        </Card>
      )}

      {/* List view */}
      {!loading && pharmacies.length > 0 && viewMode === "list" && (
        <div className="mt-6 grid gap-4 md:grid-cols-2">
          {pharmacies.map((pharmacy) => (
            <PharmacyCard
              key={pharmacy.id}
              pharmacy={pharmacy}
              isHovered={hoveredId === pharmacy.id}
              onHover={setHoveredId}
            />
          ))}
        </div>
      )}

      {/* Map view */}
      {!loading && pharmacies.length > 0 && viewMode === "map" && (
        <div className="mt-6 grid gap-4 lg:grid-cols-5">
          {/* Sidebar list */}
          <div className="order-2 lg:order-1 lg:col-span-2">
            <div className="max-h-[600px] space-y-3 overflow-y-auto pr-2">
              {pharmacies.map((pharmacy) => (
                <PharmacyCard
                  key={pharmacy.id}
                  pharmacy={pharmacy}
                  compact
                  isHovered={hoveredId === pharmacy.id}
                  onHover={setHoveredId}
                />
              ))}
            </div>
          </div>
          {/* Map */}
          <div className="order-1 lg:order-2 lg:col-span-3">
            <div className="h-[400px] overflow-hidden rounded-xl border lg:h-[600px]">
              <PharmacyMapWrapper
                pharmacies={pharmacies}
                hoveredPharmacyId={hoveredId}
                onHoverPharmacy={setHoveredId}
              />
            </div>
          </div>
        </div>
      )}

      {/* NHS attribution */}
      {searched && !loading && pharmacies.length > 0 && (
        <p className="mt-8 text-center text-xs text-muted-foreground">
          Pharmacy data provided by NHS England
        </p>
      )}
    </div>
  );
}
