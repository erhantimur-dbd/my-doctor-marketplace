import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { DoctorCard } from "@/components/doctors/doctor-card";
import { DoctorGridLive } from "@/components/doctors/doctor-grid-live";
import { searchDoctors, getMultiDayAvailabilityBatch } from "@/actions/search";
import { getLiveDoctorAvailability } from "@/actions/live-availability";
import { getSkill, SKILLS } from "@/lib/constants/skills";
import { ArrowRight, Award, Search, Users } from "lucide-react";
import type { Metadata } from "next";

/* ── Dynamic Metadata for SEO ───────────────────────────── */
interface PageParams {
  params: Promise<{ locale: string; slug: string }>;
}

export async function generateMetadata({
  params,
}: PageParams): Promise<Metadata> {
  const { locale, slug } = await params;
  const skill = getSkill(slug);
  // reject here so the response carries a real 404 status, not a streamed one
  if (!skill) notFound();

  const seoMeta = (await import("@/lib/seo/metadata")).generateMetadata;

  return seoMeta({
    title: `${skill.label} — Find & Book Doctors`,
    description: `Browse verified doctors offering ${skill.label} and book appointments online at MyDoctors360.`,
    path: `/${locale}/skills/${slug}`,
  });
}

/* ── Page Component ─────────────────────────────────────── */
export default async function SkillDetailPage({ params }: PageParams) {
  const { slug, locale } = await params;
  const skill = getSkill(slug);
  if (!skill) notFound();

  const tCommon = await getTranslations("common");
  const tSearch = await getTranslations("search");
  const tFilters = await getTranslations("chat.filters");

  const result = await searchDoctors({ skill: slug });

  // Cast doctors for DoctorCard compatibility
  const typedDoctors = result.doctors as unknown as Parameters<
    typeof DoctorCard
  >[0]["doctor"][];

  // Fetch next availability + live status for listed doctors
  const doctorIds = typedDoctors.map((d) => d.id);
  const [availability, liveStatus] = await Promise.all([
    doctorIds.length > 0 ? getMultiDayAvailabilityBatch(doctorIds) : {},
    doctorIds.length > 0 ? getLiveDoctorAvailability(doctorIds) : {},
  ]);

  // Related skills: share at least one specialty with this skill
  const skillSpecialties = skill.specialties;
  const relatedSkills = SKILLS.filter((s) => {
    if (s.slug === skill.slug) return false;
    if (skillSpecialties === "all") return s.specialties === "all";
    return (
      s.specialties !== "all" &&
      s.specialties.some((spec) => skillSpecialties.includes(spec))
    );
  }).slice(0, 6);

  return (
    <>
      {/* Hero */}
      <section className="bg-gradient-to-br from-primary/5 via-background to-primary/5 px-4 py-16 md:py-24">
        <div className="container mx-auto text-center">
          <div className="mx-auto mb-5 flex h-20 w-20 items-center justify-center rounded-2xl bg-primary/10">
            <Award className="h-10 w-10 text-primary" />
          </div>

          <Badge className="mb-4 bg-primary/10 text-primary hover:bg-primary/15 border-primary/20">
            {tFilters("skill")}
          </Badge>

          <h1 className="text-3xl font-bold tracking-tight md:text-5xl">
            {skill.label}
          </h1>

          {result.total > 0 && (
            <div className="mt-8 flex flex-wrap items-center justify-center gap-6 text-sm">
              <div className="flex items-center gap-1.5 text-muted-foreground">
                <Users className="h-4 w-4 text-primary" />
                <span>{tSearch("results_count", { count: result.total })}</span>
              </div>
            </div>
          )}

          <div className="mt-8">
            <Button size="lg" className="rounded-full" asChild>
              <Link href={`/doctors?skill=${slug}`}>
                <Search className="mr-2 h-4 w-4" />
                {tCommon("view_all")}
              </Link>
            </Button>
          </div>
        </div>
      </section>

      {/* Doctors with this skill */}
      <section className="overflow-hidden px-4 py-12 md:py-20">
        <div className="container mx-auto">
          <div className="mb-8 flex items-center justify-between">
            <h2 className="text-2xl font-bold md:text-3xl">
              Doctors with this skill
            </h2>
            {result.total > 0 && (
              <Button variant="ghost" asChild>
                <Link href={`/doctors?skill=${slug}`} className="gap-1">
                  {tCommon("view_all")} <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
            )}
          </div>

          {typedDoctors.length > 0 ? (
            <DoctorGridLive
              doctors={typedDoctors}
              locale={locale}
              availability={availability}
              initialLive={liveStatus}
            />
          ) : (
            <Card>
              <CardContent className="flex flex-col items-center gap-4 py-12 text-center">
                <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10">
                  <Award className="h-8 w-8 text-primary" />
                </div>
                <h3 className="text-lg font-semibold">
                  No Doctors with This Skill Yet
                </h3>
                <p className="max-w-md text-sm text-muted-foreground">
                  We&apos;re actively onboarding doctors offering {skill.label}.
                  If you&apos;re a doctor in this field, join our platform
                  today.
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

      {/* Related Skills */}
      {relatedSkills.length > 0 && (
        <section className="bg-muted/30 px-4 py-12 md:py-20">
          <div className="container mx-auto">
            <h2 className="mb-8 text-center text-2xl font-bold md:text-3xl">
              Related Skills
            </h2>
            <div className="mx-auto flex max-w-3xl flex-wrap items-center justify-center gap-3">
              {relatedSkills.map((related) => (
                <Link key={related.slug} href={`/skills/${related.slug}`}>
                  <Badge
                    variant="secondary"
                    className="cursor-pointer px-4 py-2 text-sm font-medium transition-colors hover:bg-primary/10 hover:text-primary"
                  >
                    {related.label}
                  </Badge>
                </Link>
              ))}
            </div>
          </div>
        </section>
      )}
    </>
  );
}
