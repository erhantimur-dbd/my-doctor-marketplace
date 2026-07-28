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
  placeName?: string | null;
  placeLat?: number | null;
  placeLng?: number | null;
}

/**
 * Zero-results panel: one clear message + one intent form + filter chips.
 * Never stack multiple waitlist banners.
 */
export function SmartEmptyState({
  suggestions,
  title = "No matching appointments right now",
  description = "Try a wider area or different filters — or leave your email and we’ll notify you when slots open.",
  specialtySlug,
  countryCode,
  placeName,
  placeLat,
  placeLng,
}: SmartEmptyStateProps) {
  return (
    <div className="mx-auto flex max-w-xl flex-col items-center rounded-2xl border border-dashed border-muted-foreground/20 bg-card px-5 py-12 text-center sm:px-8">
      <div className="mb-3 rounded-full bg-muted p-4">
        <Search className="h-6 w-6 text-muted-foreground" />
      </div>
      <p className="text-lg font-semibold tracking-tight">{title}</p>
      <p className="mt-1.5 max-w-md text-sm text-muted-foreground">{description}</p>

      {specialtySlug && (
        <div className="mt-6 w-full max-w-md text-left">
          <SpecialtyWaitlistCta
            specialtySlug={specialtySlug}
            countryCode={countryCode}
            placeName={placeName}
            placeLat={placeLat}
            placeLng={placeLng}
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
  const placeName = searchParams.placeName ?? null;
  const placeLat = searchParams.placeLat
    ? Number(searchParams.placeLat)
    : null;
  const placeLng = searchParams.placeLng
    ? Number(searchParams.placeLng)
    : null;

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
    availableToday: searchParams.availableToday === "true" ? true : null,
    sort: searchParams.sort ?? null,
    placeLat,
    placeLng,
    placeName,
    radius: searchParams.radius ? Number(searchParams.radius) : null,
  };
  const suggestions = buildEmptyStateSuggestions(filters);

  const label = specialty ? specialtySlugToLabel(specialty) : null;
  const title = label
    ? `No ${label} specialists available right now`
    : "No matching appointments right now";
  const description = label
    ? placeName
      ? `We couldn't find bookable ${label} appointments near ${placeName}. Leave your email below — or try a wider area.`
      : `We couldn't find bookable ${label} appointments with these filters. Leave your email below — or try adjusting search.`
    : "Try adjusting filters, switching to video, or removing location to see more options.";

  return (
    <SmartEmptyState
      suggestions={suggestions}
      title={title}
      description={description}
      specialtySlug={specialty}
      countryCode={countryCode}
      placeName={placeName}
      placeLat={placeLat}
      placeLng={placeLng}
    />
  );
}
