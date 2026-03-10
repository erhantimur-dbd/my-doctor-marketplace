import {
  searchDoctors,
  getSpecialties,
  getLocations,
  getMultiDayAvailabilityBatch,
} from "@/actions/search";
import { DoctorCard } from "@/components/doctors/doctor-card";
import { DoctorSearchFilters } from "@/components/doctors/doctor-search-filters";
import { DoctorResultsWithMap } from "@/components/doctors/doctor-results-with-map";
import { HomeSearchBar } from "@/components/search/home-search-bar";
import { getTranslations } from "next-intl/server";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Find a Doctor",
};

interface DoctorsPageProps {
  params: Promise<{ locale: string }>;
  searchParams: Promise<Record<string, string | undefined>>;
}

export default async function DoctorsPage({
  params,
  searchParams,
}: DoctorsPageProps) {
  const { locale } = await params;
  const sp = await searchParams;
  const t = await getTranslations("search");

  const [result, specialties, locations] = await Promise.all([
    searchDoctors({
      specialty: sp.specialty,
      location: sp.location,
      minPrice: sp.minPrice ? Number(sp.minPrice) : undefined,
      maxPrice: sp.maxPrice ? Number(sp.maxPrice) : undefined,
      minRating: sp.minRating ? Number(sp.minRating) : undefined,
      language: sp.language,
      consultationType: sp.consultationType,
      query: sp.query,
      sort: sp.sort || "featured",
      page: sp.page ? Number(sp.page) : 1,
      availableToday: sp.availableToday === "true",
      wheelchairAccessible: sp.wheelchairAccessible === "true",
      userLat: sp.lat ? Number(sp.lat) : undefined,
      userLng: sp.lng ? Number(sp.lng) : undefined,
      providerType: sp.providerType as "doctor" | "testing_service" | undefined,
      acceptedPayment: sp.acceptedPayment,
      placeLat: sp.placeLat ? Number(sp.placeLat) : undefined,
      placeLng: sp.placeLng ? Number(sp.placeLng) : undefined,
      radius: sp.radius ? Number(sp.radius) : undefined,
    }),
    getSpecialties(),
    getLocations(),
  ]);

  const typedDoctors = result.doctors as unknown as Parameters<
    typeof DoctorCard
  >[0]["doctor"][];
  const matchScores = result.matchScores;

  // Fetch multi-day availability for all returned doctors (single batch RPC)
  const doctorIds = typedDoctors.map((d) => d.id);
  const availability = await getMultiDayAvailabilityBatch(
    doctorIds,
    sp.consultationType
  );

  const distances = result.distances;

  // Resolve center location for the map when a location filter is active
  let centerLocation:
    | { lat: number; lng: number; city: string; countryCode?: string }
    | undefined;

  // Proximity search: center map on the selected Place
  if (sp.placeLat && sp.placeLng) {
    centerLocation = {
      lat: Number(sp.placeLat),
      lng: Number(sp.placeLng),
      city: sp.placeName || "Search area",
    };
  } else if (sp.location) {
    const isCountry = sp.location.startsWith("country-");
    if (isCountry) {
      // Country-level filter: compute centroid from all cities in that country
      const countryCode = sp.location.replace("country-", "").toUpperCase();
      const countryLocs = locations.filter(
        (l: Record<string, unknown>) =>
          l.country_code === countryCode && l.latitude != null && l.longitude != null
      );
      if (countryLocs.length > 0) {
        const avgLat =
          countryLocs.reduce((sum: number, l: any) => sum + Number(l.latitude), 0) /
          countryLocs.length;
        const avgLng =
          countryLocs.reduce((sum: number, l: any) => sum + Number(l.longitude), 0) /
          countryLocs.length;
        centerLocation = {
          lat: avgLat,
          lng: avgLng,
          city: countryCode,
          countryCode,
        };
      }
    } else {
      const loc = locations.find(
        (l: Record<string, unknown>) => l.slug === sp.location
      );
      if (loc && loc.latitude != null && loc.longitude != null) {
        centerLocation = {
          lat: Number(loc.latitude),
          lng: Number(loc.longitude),
          city: String(loc.city),
          countryCode: String(loc.country_code),
        };
      }
    }
  }

  return (
    <div className="container mx-auto px-4 py-4 lg:py-8">
      <h1 className="mb-3 text-2xl font-bold lg:mb-6 lg:text-3xl">
        {t("title")}
      </h1>

      {/* AI-powered search bar – desktop only */}
      <div className="mb-4 hidden lg:block">
        <HomeSearchBar
          specialties={specialties}
          locations={locations}
          initialQuery={sp.query || ""}
          initialLocation={sp.location || ""}
          initialConsultationType={
            (sp.consultationType as "all" | "in_person" | "video") || "all"
          }
          compact
        />
      </div>

      <div className="flex flex-col gap-4">
        {/* Filters — full-width horizontal bar */}
        <DoctorSearchFilters
          specialties={specialties}
          locations={locations}
          currentFilters={sp}
        />

        {/* Results */}
        <div>
          <div className="mb-4 flex items-center gap-2">
            <span className="text-sm text-muted-foreground">
              {t("results_count", { count: result.total })}
            </span>
            {sp.placeName && (
              <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2.5 py-0.5 text-xs font-medium text-blue-700 dark:bg-blue-950/30 dark:text-blue-400">
                Near {sp.placeName}
                {sp.radius && ` (${sp.radius} km)`}
              </span>
            )}
          </div>

          {result.doctors.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-lg border border-dashed py-16 text-center">
              <p className="text-lg font-medium text-muted-foreground">
                No doctors found
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                Try adjusting your filters
              </p>
            </div>
          ) : (
            <>
              {/* Desktop: list + map split view */}
              <div className="hidden lg:block">
                <DoctorResultsWithMap
                  doctors={typedDoctors}
                  locale={locale}
                  availability={availability}
                  centerLocation={centerLocation}
                  matchScores={matchScores}
                  distances={distances}
                />
              </div>

              {/* Mobile / tablet: stacked cards (no map) */}
              <div className="space-y-4 lg:hidden">
                {typedDoctors.map((doctor) => (
                  <DoctorCard
                    key={doctor.id}
                    doctor={doctor}
                    locale={locale}
                    availability={availability[doctor.id] || null}
                    matchScore={matchScores?.[doctor.id]?.score}
                    matchReasons={matchScores?.[doctor.id]?.reasons}
                    distanceKm={distances?.[doctor.id]}
                  />
                ))}
              </div>
            </>
          )}

          {/* Pagination */}
          {result.total > result.perPage && (
            <div className="mt-8 flex justify-center gap-2">
              {Array.from(
                { length: Math.ceil(result.total / result.perPage) },
                (_, i) => i + 1
              ).map((page) => (
                <a
                  key={page}
                  href={`?${new URLSearchParams({
                    ...sp,
                    page: String(page),
                  } as Record<string, string>).toString()}`}
                  className={`inline-flex h-9 w-9 items-center justify-center rounded-md text-sm ${
                    page === result.page
                      ? "bg-primary text-primary-foreground"
                      : "border hover:bg-accent"
                  }`}
                >
                  {page}
                </a>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
