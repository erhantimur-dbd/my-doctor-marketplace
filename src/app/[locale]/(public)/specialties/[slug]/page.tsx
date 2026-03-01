import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { DoctorCard } from "@/components/doctors/doctor-card";
import { getSpecialtyBySlug, getMultiDayAvailabilityBatch } from "@/actions/search";
import { getSpecialtyMeta, SPECIALTIES } from "@/lib/constants/specialties";
import { getSpecialtyColor } from "@/lib/constants/specialty-colors";
import {
  ArrowRight,
  Users,
  Star,
  Stethoscope,
  Heart,
  Brain,
  Eye,
  Smile,
  Baby,
  Activity,
  Wind,
  Shield,
  Apple,
  Droplets,
  Ear,
  Flower,
  Scan,
  CheckCircle2,
  Search,
} from "lucide-react";
import type { Metadata } from "next";

/* ── Icon map ───────────────────────────────────────────── */
const iconMap: Record<string, React.ElementType> = {
  Stethoscope,
  Heart,
  Sparkles: Flower, // Flower as fallback for Sparkles
  Brain,
  Eye,
  Smile,
  Baby,
  Activity,
  Wind,
  Shield,
  Apple,
  Droplets,
  Ear,
  Flower,
  Scan,
  Bone: Activity,
  HeartHandshake: Heart,
};

/* ── Dynamic Metadata for SEO ───────────────────────────── */
interface PageParams {
  params: Promise<{ locale: string; slug: string }>;
}

export async function generateMetadata({
  params,
}: PageParams): Promise<Metadata> {
  const { slug } = await params;
  const meta = getSpecialtyMeta(slug);
  if (!meta) return { title: "Specialty Not Found" };

  const name = meta.nameKey
    .replace("specialty.", "")
    .replace(/_/g, " ")
    .replace(/\b\w/g, (l) => l.toUpperCase());

  return {
    title: `${name} Doctors — Find & Book Online`,
    description: meta.description,
  };
}

/* ── Page Component ─────────────────────────────────────── */
export default async function SpecialtyDetailPage({ params }: PageParams) {
  const { slug, locale } = await params;
  const meta = getSpecialtyMeta(slug);
  if (!meta) notFound();

  const t = await getTranslations("specialty");
  const data = await getSpecialtyBySlug(slug);
  const color = getSpecialtyColor(slug);
  const Icon = iconMap[meta.icon] || Stethoscope;

  const specialtyName = t(
    meta.nameKey.replace("specialty.", "") as Parameters<typeof t>[0]
  );

  // Cast doctors for DoctorCard compatibility
  const typedDoctors = (data?.doctors || []) as unknown as Parameters<
    typeof DoctorCard
  >[0]["doctor"][];

  // Fetch next availability for featured doctors
  const doctorIds = typedDoctors.map((d) => d.id);
  const availability =
    doctorIds.length > 0 ? await getMultiDayAvailabilityBatch(doctorIds) : {};

  // Format price from cents
  const formatPrice = (cents: number) =>
    new Intl.NumberFormat(locale, {
      style: "currency",
      currency: "EUR",
      minimumFractionDigits: 0,
    }).format(cents / 100);

  // Related specialties
  const relatedMetas = meta.relatedSlugs
    .map((s) => getSpecialtyMeta(s))
    .filter(Boolean);

  return (
    <>
      {/* Hero */}
      <section className="bg-gradient-to-br from-primary/5 via-background to-primary/5 px-4 py-16 md:py-24">
        <div className="container mx-auto text-center">
          <div
            className={`mx-auto mb-5 flex h-20 w-20 items-center justify-center rounded-2xl ${color.bg}`}
          >
            <Icon className={`h-10 w-10 ${color.text}`} />
          </div>

          <Badge variant="secondary" className="mb-4">
            Medical Specialty
          </Badge>

          <h1 className="text-3xl font-bold tracking-tight md:text-5xl">
            {specialtyName}
          </h1>

          <p className="mx-auto mt-4 max-w-2xl text-lg text-muted-foreground">
            {meta.description}
          </p>

          {/* Stats row */}
          {data && (
            <div className="mt-8 flex flex-wrap items-center justify-center gap-6 text-sm">
              <div className="flex items-center gap-1.5 text-muted-foreground">
                <Users className="h-4 w-4 text-primary" />
                <span>
                  <strong className="text-foreground">
                    {data.doctorCount}
                  </strong>{" "}
                  {data.doctorCount === 1 ? "Doctor" : "Doctors"}
                </span>
              </div>

              {data.priceRange && (
                <div className="flex items-center gap-1.5 text-muted-foreground">
                  <span>
                    From{" "}
                    <strong className="text-foreground">
                      {formatPrice(data.priceRange.min)}
                    </strong>
                  </span>
                </div>
              )}

              {data.avgRating != null && data.avgRating > 0 && (
                <div className="flex items-center gap-1.5 text-muted-foreground">
                  <Star className="h-4 w-4 text-yellow-500" />
                  <span>
                    <strong className="text-foreground">
                      {data.avgRating.toFixed(1)}
                    </strong>{" "}
                    avg. rating
                  </span>
                </div>
              )}
            </div>
          )}

          <div className="mt-8">
            <Button size="lg" className="rounded-full" asChild>
              <Link href={`/doctors?specialty=${slug}`}>
                <Search className="mr-2 h-4 w-4" />
                Find a {specialtyName} Doctor
              </Link>
            </Button>
          </div>
        </div>
      </section>

      {/* Featured Doctors */}
      <section className="px-4 py-12 md:py-20">
        <div className="container mx-auto">
          <div className="mb-8 flex items-center justify-between">
            <h2 className="text-2xl font-bold md:text-3xl">
              Top {specialtyName} Doctors
            </h2>
            {data && data.doctorCount > 0 && (
              <Button variant="ghost" asChild>
                <Link
                  href={`/doctors?specialty=${slug}`}
                  className="gap-1"
                >
                  See All <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
            )}
          </div>

          {typedDoctors.length > 0 ? (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {typedDoctors.map((doctor) => (
                <DoctorCard
                  key={doctor.id}
                  doctor={doctor}
                  locale={locale}
                  availability={availability[doctor.id] || null}
                />
              ))}
            </div>
          ) : (
            <Card>
              <CardContent className="flex flex-col items-center gap-4 py-12 text-center">
                <div
                  className={`flex h-16 w-16 items-center justify-center rounded-2xl ${color.bg}`}
                >
                  <Icon className={`h-8 w-8 ${color.text}`} />
                </div>
                <h3 className="text-lg font-semibold">
                  No {specialtyName} Doctors Yet
                </h3>
                <p className="max-w-md text-sm text-muted-foreground">
                  We&apos;re actively onboarding {specialtyName.toLowerCase()}{" "}
                  specialists. If you&apos;re a doctor in this field, join our
                  platform today.
                </p>
                <Button className="rounded-full" asChild>
                  <Link href="/register-doctor">
                    Join as Doctor <ArrowRight className="ml-2 h-4 w-4" />
                  </Link>
                </Button>
              </CardContent>
            </Card>
          )}
        </div>
      </section>

      {/* About This Specialty */}
      <section className="bg-muted/30 px-4 py-12 md:py-20">
        <div className="container mx-auto max-w-4xl">
          <h2 className="mb-8 text-center text-2xl font-bold md:text-3xl">
            When to See a {specialtyName}
          </h2>
          <p className="mx-auto mb-8 max-w-2xl text-center text-muted-foreground">
            A {specialtyName.toLowerCase()} specialist can help if you&apos;re
            experiencing any of the following conditions:
          </p>

          <div className="grid gap-3 sm:grid-cols-2">
            {meta.commonConditions.map((condition) => (
              <div
                key={condition}
                className="flex items-start gap-3 rounded-lg border bg-background p-4"
              >
                <CheckCircle2 className={`mt-0.5 h-5 w-5 shrink-0 ${color.text}`} />
                <span className="text-sm">{condition}</span>
              </div>
            ))}
          </div>

          <div className="mt-8 text-center">
            <Button variant="outline" className="rounded-full" asChild>
              <Link href={`/doctors?specialty=${slug}`}>
                Browse {specialtyName} Doctors
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
          </div>
        </div>
      </section>

      {/* Related Specialties */}
      {relatedMetas.length > 0 && (
        <section className="px-4 py-12 md:py-20">
          <div className="container mx-auto">
            <h2 className="mb-8 text-center text-2xl font-bold md:text-3xl">
              Related Specialties
            </h2>
            <div className="mx-auto grid max-w-3xl gap-4 sm:grid-cols-3">
              {relatedMetas.map((related) => {
                if (!related) return null;
                const RelIcon = iconMap[related.icon] || Stethoscope;
                const rc = getSpecialtyColor(related.slug);
                const relName = related.nameKey
                  .replace("specialty.", "")
                  .replace(/_/g, " ")
                  .replace(/\b\w/g, (l) => l.toUpperCase());

                return (
                  <Link
                    key={related.slug}
                    href={`/specialties/${related.slug}`}
                  >
                    <Card
                      className={`group h-full cursor-pointer transition-all ${rc.border} hover:shadow-md`}
                    >
                      <CardContent className="flex flex-col items-center gap-3 p-5 text-center">
                        <div
                          className={`rounded-xl ${rc.bg} p-3 transition-colors ${rc.hoverBg}`}
                        >
                          <RelIcon className={`h-6 w-6 ${rc.text}`} />
                        </div>
                        <span className="text-sm font-medium">{relName}</span>
                      </CardContent>
                    </Card>
                  </Link>
                );
              })}
            </div>
          </div>
        </section>
      )}

      {/* CTA */}
      <section className="bg-gradient-to-br from-primary to-primary/80 px-4 py-16 md:py-24">
        <div className="container mx-auto text-center">
          <h2 className="text-2xl font-bold text-primary-foreground md:text-3xl">
            Ready to Book?
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-primary-foreground/80">
            Find a verified {specialtyName.toLowerCase()} near you and book your
            appointment online in minutes.
          </p>
          <div className="mt-8 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
            <Button
              size="lg"
              variant="secondary"
              className="rounded-full"
              asChild
            >
              <Link href={`/doctors?specialty=${slug}`}>
                Find a Doctor <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
            <Button
              size="lg"
              variant="ghost"
              className="rounded-full text-primary-foreground hover:bg-primary-foreground/10 hover:text-primary-foreground"
              asChild
            >
              <Link href="/specialties">All Specialties</Link>
            </Button>
          </div>
        </div>
      </section>
    </>
  );
}
