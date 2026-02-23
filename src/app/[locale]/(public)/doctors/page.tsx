import { searchDoctors, getSpecialties, getLocations } from "@/actions/search";
import { DoctorCard } from "@/components/doctors/doctor-card";
import { DoctorSearchFilters } from "@/components/doctors/doctor-search-filters";
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
    }),
    getSpecialties(),
    getLocations(),
  ]);

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="mb-6 text-3xl font-bold">{t("title")}</h1>

      <div className="flex flex-col gap-8 lg:flex-row">
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
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {result.doctors.map((doctor: Record<string, unknown>) => (
                <DoctorCard
                  key={doctor.id as string}
                  doctor={doctor as unknown as Parameters<typeof DoctorCard>[0]["doctor"]}
                  locale={locale}
                />
              ))}
            </div>
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
