import { Search } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import {
  buildEmptyStateSuggestions,
  type EmptyStateSuggestion,
} from "@/lib/search/empty-state-suggestions";
import type { DoctorsSearchFilters } from "@/lib/voice/search-url";

interface SmartEmptyStateProps {
  suggestions: EmptyStateSuggestion[];
  title?: string;
  description?: string;
}

/**
 * Zero-results panel with one-tap filter relaxations.
 * Server-component safe (no client hooks).
 */
export function SmartEmptyState({
  suggestions,
  title = "No doctors found",
  description = "Try adjusting your filters or use a suggestion below.",
}: SmartEmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-muted-foreground/20 py-16 text-center px-4">
      <div className="mb-3 rounded-full bg-muted p-4">
        <Search className="h-6 w-6 text-muted-foreground" />
      </div>
      <p className="text-lg font-medium">{title}</p>
      <p className="mt-1 max-w-md text-sm text-muted-foreground">{description}</p>
      {suggestions.length > 0 && (
        <div className="mt-6 flex flex-wrap items-center justify-center gap-2">
          {suggestions.map((s) => (
            <Button
              key={s.id}
              variant="outline"
              size="sm"
              className="rounded-full"
              asChild
            >
              <Link href={s.href}>{s.label}</Link>
            </Button>
          ))}
        </div>
      )}
    </div>
  );
}

/** Build empty state from doctors page searchParams record. */
export function SmartEmptyStateFromParams({
  searchParams,
}: {
  searchParams: Record<string, string | undefined>;
}) {
  const filters: DoctorsSearchFilters = {
    query: searchParams.query ?? null,
    specialty: searchParams.specialty ?? null,
    location: searchParams.location ?? null,
    language: searchParams.language ?? null,
    consultationType: searchParams.consultationType ?? null,
    skill: searchParams.skill ?? null,
    minPrice: searchParams.minPrice ? Number(searchParams.minPrice) : null,
    maxPrice: searchParams.maxPrice ? Number(searchParams.maxPrice) : null,
    minRating: searchParams.minRating ? Number(searchParams.minRating) : null,
    availableToday:
      searchParams.availableToday === "true" ? true : null,
    sort: searchParams.sort ?? null,
    placeLat: searchParams.placeLat ? Number(searchParams.placeLat) : null,
    placeLng: searchParams.placeLng ? Number(searchParams.placeLng) : null,
    placeName: searchParams.placeName ?? null,
    radius: searchParams.radius ? Number(searchParams.radius) : null,
  };
  const suggestions = buildEmptyStateSuggestions(filters);
  return <SmartEmptyState suggestions={suggestions} />;
}
