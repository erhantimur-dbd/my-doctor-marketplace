import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowRight } from "lucide-react";
import { HeroSpecialtyIcons } from "@/components/shared/hero-specialty-icons";
import { getLiveAvailabilityCounts } from "@/actions/live-availability";
import { SpecialtiesGridLive } from "@/components/shared/specialties-grid-live";

const allSpecialties = [
  { slug: "general-practice", icon: "Stethoscope", key: "general_practice" },
  { slug: "cardiology", icon: "Heart", key: "cardiology" },
  { slug: "dermatology", icon: "Sparkles", key: "dermatology" },
  { slug: "orthopedics", icon: "Bone", key: "orthopedics" },
  { slug: "neurology", icon: "Brain", key: "neurology" },
  { slug: "psychiatry", icon: "Brain", key: "psychiatry" },
  { slug: "psychology", icon: "HeartHandshake", key: "psychology" },
  { slug: "ophthalmology", icon: "Eye", key: "ophthalmology" },
  { slug: "ent", icon: "Ear", key: "ent" },
  { slug: "gynecology", icon: "Baby", key: "gynecology" },
  { slug: "urology", icon: "Activity", key: "urology" },
  { slug: "gastroenterology", icon: "Apple", key: "gastroenterology" },
  { slug: "endocrinology", icon: "Droplets", key: "endocrinology" },
  { slug: "pulmonology", icon: "Wind", key: "pulmonology" },
  { slug: "oncology", icon: "Shield", key: "oncology" },
  { slug: "pediatrics", icon: "Baby", key: "pediatrics" },
  { slug: "dentistry", icon: "Smile", key: "dentistry" },
  { slug: "aesthetic-medicine", icon: "Sparkles", key: "aesthetic_medicine" },
  { slug: "physiotherapy", icon: "Activity", key: "physiotherapy" },
  { slug: "radiology", icon: "Scan", key: "radiology" },
  { slug: "nutrition", icon: "Apple", key: "nutrition" },
  { slug: "allergy", icon: "Flower", key: "allergy" },
  { slug: "rheumatology", icon: "Bone", key: "rheumatology" },
  { slug: "nephrology", icon: "Droplets", key: "nephrology" },
];

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "meta" });
  const seoMeta = (await import("@/lib/seo/metadata")).generateMetadata;
  return seoMeta({
    title: t("specialties.title"),
    description: t("specialties.description"),
    path: `/${locale}/specialties`,
  });
}

export default async function SpecialtiesPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const [t, liveCounts] = await Promise.all([
    getTranslations({ locale, namespace: "specialty" }),
    getLiveAvailabilityCounts(),
  ]);

  return (
    <>
      {/* Hero */}
      <section className="relative bg-gradient-to-br from-primary/5 via-background to-primary/5 px-4 py-16 md:py-24">
        <HeroSpecialtyIcons />
        <div className="relative container mx-auto text-center">
          <Badge className="mb-4 bg-primary/10 text-primary hover:bg-primary/15 border-primary/20">
            {t("browse_badge", { count: allSpecialties.length })}
          </Badge>
          <h1 className="text-3xl font-bold tracking-tight md:text-5xl">
            {t("browse_title")}
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-lg text-muted-foreground">
            {t("browse_subtitle")}
          </p>
        </div>
      </section>

      {/* Specialties Grid */}
      <section className="px-4 py-12 md:py-20">
        <div className="container mx-auto">
          <SpecialtiesGridLive
            specialties={allSpecialties.map((s) => ({
              slug: s.slug,
              icon: s.icon,
              label: t(s.key),
              desc: t(`desc_${s.key}`),
            }))}
            initialCounts={liveCounts}
          />
        </div>
      </section>

      {/* CTA */}
      <section className="bg-muted/30 px-4 py-12 md:py-20">
        <div className="container mx-auto text-center">
          <h2 className="text-2xl font-bold md:text-3xl">
            {t("browse_cta_title")}
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-muted-foreground">
            {t("browse_cta_desc")}
          </p>
          <Button size="lg" className="mt-8 rounded-full" asChild>
            <Link href="/specialties/general-practice">
              {t("browse_cta_button")} <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          </Button>
        </div>
      </section>
    </>
  );
}
