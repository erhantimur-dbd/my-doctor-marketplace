import { Search } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import {
  buildEmptyStateSuggestions,
  type EmptyStateSuggestion,
} from "@/lib/search/empty-state-suggestions";
import type { DoctorsSearchFilters } from "@/lib/voice/search-url";
import { specialtySlugToLabel } from "@/lib/constants/related-specialties";
import { SpecialtyWaitlistCta } from "@/components/search/specialty-waitlist-cta";

interface SmartEmptyStateProps {
  suggestions: EmptyStateSuggestion[];
  title?: string;
  description?: string;
  specialtySlug?: string | null;
  countryCode?: string | null;
}

/**
 * Zero-results panel with one-tap filter relaxations + specialty waitlist.
 * Never a naked dead-end for specialty searches.
 * Server-component safe (no client hooks except nested waitlist CTA).
 */
export function SmartEmptyState({
  suggestions,
  title = "No matching appointments right now",
  description = "Try a wider time window, video consultation, or join the waitlist — we’ll notify you when slots open.",
  specialtySlug,
  countryCode,
}: SmartEmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-muted-foreground/20 py-16 text-center px-4">
      <div className="mb-3 rounded-full bg-muted p-4">
        <Search className="h-6 w-6 text-muted-foreground" />
      </div>
      <p className="text-lg font-medium">{title}</p>
      <p className="mt-1 max-w-md text-sm text-muted-foreground">{description}</p>
      {specialtySlug && (
        <div className="mt-6 w-full max-w-lg text-left">
          <SpecialtyWaitlistCta
            specialtySlug={specialtySlug}
            countryCode={countryCode}
          />
        </div>
      )}
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
  countryCode,
}: {
  searchParams: Record<string, string | undefined>;
  countryCode?: string | null;
}) {
  const specialty = searchParams.specialty ?? null;
  const filters: DoctorsSearchFilters = {
    query: searchParams.query ?? null,
    specialty,
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

  const title = specialty
    ? `No bookable ${specialtySlugToLabel(specialty)} appointments match these filters`
    : "No matching appointments right now";
  const description = specialty
    ? "We keep the same specialty — try next week, video, a wider area, or join the waitlist below."
    : "Try adjusting filters, switching to video, or removing location to see more options.";

  return (
    <SmartEmptyState
      suggestions={suggestions}
      title={title}
      description={description}
      specialtySlug={specialty}
      countryCode={countryCode}
    />
  );
}
