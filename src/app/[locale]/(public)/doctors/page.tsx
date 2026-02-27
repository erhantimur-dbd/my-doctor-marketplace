import {
  searchDoctors,
  getSpecialties,
  getLocations,
  getNextAvailabilityBatch,
} from "@/actions/search";
import { DoctorCard } from "@/components/doctors/doctor-card";
import { DoctorSearchFilters } from "@/components/doctors/doctor-search-filters";
import { DoctorResultsWithMap } from "@/components/doctors/doctor-results-with-map";
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
      userLat: sp.lat ? Number(sp.lat) : undefined,
      userLng: sp.lng ? Number(sp.lng) : undefined,
    }),
    getSpecialties(),
    getLocations(),
  ]);

  const typedDoctors = result.doctors as unknown as Parameters<
    typeof DoctorCard
  >[0]["doctor"][];

  // Fetch next availability for all returned doctors (single batch RPC)
  const doctorIds = typedDoctors.map((d) => d.id);
  const availability = await getNextAvailabilityBatch(
    doctorIds,
    sp.consultationType
  );

  // Resolve center location for the map when a location filter is active
  let centerLocation:
    | { lat: number; lng: number; city: string; countryCode?: string }
    | undefined;
  if (sp.location) {
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

  return (
    <div className="container mx-auto px-4 py-4 lg:py-8">
      <h1 className="mb-3 text-2xl font-bold lg:mb-6 lg:text-3xl">
        {t("title")}
      </h1>

      <div className="flex flex-col gap-4 lg:flex-row lg:gap-8">
        {/* Filters sidebar */}
        <aside className="w-full shrink-0 lg:w-72">
          <DoctorSearchFilters
            specialties={specialties}
            locations={locations}
            currentFilters={sp}
          />
        </aside>

        {/* Results */}
        <div className="flex-1">
          <div className="mb-4 text-sm text-muted-foreground">
            {t("results_count", { count: result.total })}
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
                />
              </div>

              {/* Mobile: regular grid (no map) */}
              <div className="grid gap-4 sm:grid-cols-2 lg:hidden">
                {typedDoctors.map((doctor) => (
                  <DoctorCard
                    key={doctor.id}
                    doctor={doctor}
                    locale={locale}
                    availability={availability[doctor.id] || null}
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
