import {
  searchDoctors,
  getSpecialties,
  getLocations,
  getMultiDayAvailabilityBatch,
  getSearchExpansionSuggestions,
  getFeaturedDoctors,
} from "@/actions/search";
import { getLiveDoctorAvailability } from "@/actions/live-availability";
import { DoctorCard } from "@/components/doctors/doctor-card";
import { DoctorSearchFilters } from "@/components/doctors/doctor-search-filters";
import { DoctorResultsWithMap } from "@/components/doctors/doctor-results-with-map";
import { HomeSearchBar } from "@/components/search/home-search-bar";
import { SearchExpansionBanner } from "@/components/search/search-expansion-banner";
import { RecentlyViewedCarousel } from "@/components/doctors/recently-viewed-carousel";
import { CompareProviderWrapper } from "@/components/doctors/compare-provider-wrapper";
import { RegionNotAvailableBanner } from "@/components/search/region-not-available-banner";
import { COUNTRIES } from "@/lib/constants/countries";
import {
  Search,
  Stethoscope,
  Heart,
  Brain,
  Eye,
  Baby,
  Activity,
  Flower,
  Ear,
  Smile,
  Apple,
  Droplets,
  Wind,
  Shield,
  Scan,
} from "lucide-react";
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

  const [result, specialties, locations, featuredDoctors] = await Promise.all([
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
      skill: sp.skill,
    }),
    getSpecialties(),
    getLocations(),
    getFeaturedDoctors(5),
  ]);

  const typedDoctors = result.doctors as unknown as Parameters<
    typeof DoctorCard
  >[0]["doctor"][];
  const matchScores = result.matchScores;

  // Fetch multi-day availability + live status for all returned doctors
  const doctorIds = typedDoctors.map((d) => d.id);
  const [availability, liveStatus] = await Promise.all([
    getMultiDayAvailabilityBatch(doctorIds, sp.consultationType),
    getLiveDoctorAvailability(doctorIds),
  ]);

  const distances = result.distances;

  // When AI-parsed search returns few results, suggest ways to broaden
  const expansionSuggestions =
    result.total <= 2 && sp.aiParsed === "true"
      ? await getSearchExpansionSuggestions(sp)
      : [];

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
    <CompareProviderWrapper>
    <div>
      {/* ── Search hero area with brand gradient ── */}
      <div className="relative bg-gradient-to-br from-primary via-primary/90 to-teal-600 dark:from-primary/80 dark:via-primary/70 dark:to-teal-800">
        {/* Subtle pattern overlay */}
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_-20%,rgba(255,255,255,0.12),transparent_60%)]" />

        {/* Decorative specialty icons — all 24 specialties scattered across hero */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none" aria-hidden="true">
          {/* Row 1 — top edge */}
          <Stethoscope className="absolute top-2 left-[3%] h-7 w-7 text-white/20 rotate-12" />          {/* General Practice */}
          <Heart className="absolute top-3 left-[12%] h-5 w-5 text-white/[0.17] -rotate-6" />              {/* Cardiology */}
          <Flower className="absolute top-1 left-[22%] h-5 w-5 text-white/20 rotate-[18deg]" />        {/* Dermatology */}
          <Activity className="absolute top-4 left-[31%] h-6 w-6 text-white/15 -rotate-12" />          {/* Orthopedics */}
          <Brain className="absolute top-2 left-[41%] h-7 w-7 text-white/[0.17] rotate-6" />               {/* Neurology */}
          <Brain className="absolute top-3 left-[52%] h-5 w-5 text-white/15 -rotate-[15deg]" />        {/* Psychiatry */}
          <Heart className="absolute top-1 left-[61%] h-4 w-4 text-white/[0.17] rotate-[22deg]" />         {/* Psychology */}
          <Eye className="absolute top-4 left-[71%] h-6 w-6 text-white/20 -rotate-6" />                {/* Ophthalmology */}
          <Ear className="absolute top-2 left-[80%] h-5 w-5 text-white/[0.17] rotate-[10deg]" />           {/* ENT */}
          <Baby className="absolute top-3 left-[89%] h-6 w-6 text-white/15 -rotate-12" />              {/* Gynecology */}
          <Scan className="absolute top-1 left-[96%] h-5 w-5 text-white/[0.17] rotate-6" />                {/* Radiology */}

          {/* Row 2 — bottom edge */}
          <Activity className="absolute bottom-2 left-[1%] h-5 w-5 text-white/[0.17] -rotate-[20deg]" />   {/* Urology */}
          <Apple className="absolute bottom-4 left-[10%] h-6 w-6 text-white/15 rotate-12" />           {/* Gastroenterology */}
          <Droplets className="absolute bottom-2 left-[19%] h-5 w-5 text-white/20 -rotate-6" />        {/* Endocrinology */}
          <Wind className="absolute bottom-3 left-[28%] h-6 w-6 text-white/[0.17] rotate-[15deg]" />       {/* Pulmonology */}
          <Shield className="absolute bottom-1 left-[37%] h-5 w-5 text-white/15 -rotate-12" />         {/* Oncology */}
          <Baby className="absolute bottom-4 left-[46%] h-5 w-5 text-white/20 rotate-6" />             {/* Pediatrics */}
          <Smile className="absolute bottom-2 left-[55%] h-6 w-6 text-white/[0.17] -rotate-[8deg]" />      {/* Dentistry */}
          <Flower className="absolute bottom-3 left-[64%] h-5 w-5 text-white/15 rotate-[20deg]" />     {/* Aesthetic Medicine */}
          <Activity className="absolute bottom-1 left-[73%] h-6 w-6 text-white/[0.17] -rotate-12" />       {/* Physiotherapy */}
          <Apple className="absolute bottom-4 left-[82%] h-5 w-5 text-white/20 rotate-[10deg]" />      {/* Nutrition */}
          <Flower className="absolute bottom-2 left-[88%] h-4 w-4 text-white/[0.17] -rotate-6" />          {/* Allergy */}
          <Activity className="absolute bottom-3 left-[93%] h-5 w-5 text-white/15 rotate-[25deg]" />   {/* Rheumatology */}
          <Droplets className="absolute bottom-1 left-[98%] h-5 w-5 text-white/[0.17] -rotate-[15deg]" />  {/* Nephrology */}
        </div>
        <div className="relative container mx-auto px-4 pb-5 pt-6 lg:pb-7 lg:pt-8">
          <h1 className="mb-0.5 text-2xl font-bold tracking-tight text-white lg:text-3xl">
            {t("title")}
          </h1>
          <p className="mb-4 text-sm text-white/70 lg:text-base">
            {t("results_count", { count: result.total })}
            {sp.placeName && (
              <span className="ml-2 inline-flex items-center gap-1 rounded-full bg-white/15 px-2.5 py-0.5 text-xs font-medium text-white/90 backdrop-blur-sm">
                Near {sp.placeName}
                {sp.radius && ` (${sp.radius} km)`}
              </span>
            )}
          </p>

          {/* Recently viewed doctors carousel */}
          <RecentlyViewedCarousel />

          {/* AI-powered search bar – desktop only */}
          <div className="hidden lg:block">
            <HomeSearchBar
              specialties={specialties}
              locations={locations}
              featuredDoctors={featuredDoctors}
              initialQuery={sp.query || ""}
              initialLocation={sp.location || ""}
              initialConsultationType={
                (sp.consultationType as "all" | "in_person" | "video") || "all"
              }
              compact
            />
          </div>
        </div>
      </div>

      {/* ── Results area ── */}
      <div className="container mx-auto px-4 py-4 lg:py-6">
        <div className="flex flex-col gap-4">
          {/* Filters — full-width horizontal bar */}
          <DoctorSearchFilters
            specialties={specialties}
            locations={locations}
            currentFilters={sp}
          />

          {/* Results */}
          <div>

          {/* Region not available banner */}
          {result.outsideLaunchRegion && result.searchCountryCode && (
            <RegionNotAvailableBanner
              regionName={
                COUNTRIES.find(
                  (c) => c.code === result.searchCountryCode
                )?.name || result.searchCountryCode
              }
              regionCode={result.searchCountryCode}
            />
          )}

          {/* Fallback applied banner */}
          {result.fallbackApplied && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
              {result.fallbackApplied}
            </div>
          )}

          {/* Specialist suggestion banner */}
          {result.specialistSuggestion && result.specialistSuggestion !== "general-practice" && (
            <div className="flex items-center justify-between rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm">
              <span className="text-blue-800">
                Looking for a specialist? Try searching for a{" "}
                <a
                  href={`/en/doctors?specialty=${result.specialistSuggestion}${sp.placeLat ? `&placeLat=${sp.placeLat}&placeLng=${sp.placeLng}&placeName=${sp.placeName || ""}&radius=100` : ""}`}
                  className="font-semibold underline hover:text-blue-900"
                >
                  {result.specialistSuggestion.replace(/-/g, " ").replace(/\b\w/g, (c: string) => c.toUpperCase())}
                </a>
                {" "}instead.
              </span>
            </div>
          )}

          {/* Smart expansion suggestions for AI searches with few results */}
          <SearchExpansionBanner
            suggestions={expansionSuggestions}
            resultCount={result.total}
          />

          {/* Live availability legend */}
          {result.doctors.length > 0 && Object.values(liveStatus).some(Boolean) && (
            <div className="mb-1 flex items-center gap-2 text-xs text-muted-foreground">
              <span className="relative flex h-2.5 w-2.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-400 opacity-75" />
                <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-red-500" />
              </span>
              Appointment available within the next hour
            </div>
          )}

          {result.doctors.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-muted-foreground/20 py-20 text-center">
              <div className="mb-3 rounded-full bg-muted p-4">
                <Search className="h-6 w-6 text-muted-foreground" />
              </div>
              <p className="text-lg font-medium">
                No doctors found
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                Try adjusting your filters or broadening your search
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
                  liveAvailability={liveStatus}
                />
              </div>

              {/* Mobile / tablet: stacked cards (no map) */}
              <div className="space-y-5 lg:hidden">
                {typedDoctors.map((doctor) => (
                  <div key={doctor.id}>
                    <DoctorCard
                      doctor={doctor}
                      locale={locale}
                      availability={availability[doctor.id] || null}
                      matchScore={matchScores?.[doctor.id]?.score}
                      matchReasons={matchScores?.[doctor.id]?.reasons}
                      distanceKm={distances?.[doctor.id]}
                      liveAvailable={!!liveStatus[doctor.id]}
                    />
                  </div>
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
                  className={`inline-flex h-9 w-9 items-center justify-center rounded-full text-sm font-medium transition-colors ${
                    page === result.page
                      ? "bg-primary text-primary-foreground shadow-sm"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground"
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
    </div>
    </CompareProviderWrapper>
  );
}
