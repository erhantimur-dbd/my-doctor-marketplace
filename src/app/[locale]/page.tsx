import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Header } from "@/components/layout/header";
import { Footer } from "@/components/layout/footer";
import { HomeSearchBar } from "@/components/search/home-search-bar";
import {
  getSpecialties,
  getLocations,
  getSameDayAvailabilityCount,
} from "@/actions/search";
import {
  Calendar,
  Video,
  Shield,
  Star,
  ArrowRight,
  Stethoscope,
  Heart,
  Brain,
  Eye,
  Smile,
  Sparkles,
  Baby,
  Activity,
  Search,
  Clock,
} from "lucide-react";

const specialtyIcons: Record<string, React.ElementType> = {
  Stethoscope,
  Heart,
  Brain,
  Eye,
  Smile,
  Sparkles,
  Baby,
  Activity,
};

const popularSpecialties = [
  { slug: "general-practice", icon: "Stethoscope", key: "general_practice" },
  { slug: "cardiology", icon: "Heart", key: "cardiology" },
  { slug: "dermatology", icon: "Sparkles", key: "dermatology" },
  { slug: "neurology", icon: "Brain", key: "neurology" },
  { slug: "ophthalmology", icon: "Eye", key: "ophthalmology" },
  { slug: "dentistry", icon: "Smile", key: "dentistry" },
  { slug: "pediatrics", icon: "Baby", key: "pediatrics" },
  { slug: "physiotherapy", icon: "Activity", key: "physiotherapy" },
];

export default async function HomePage() {
  const t = await getTranslations("home");
  const ts = await getTranslations("specialty");

  const [specialties, locations, sameDayCount] = await Promise.all([
    getSpecialties(),
    getLocations(),
    getSameDayAvailabilityCount(),
  ]);

  return (
    <div className="flex min-h-screen flex-col">
      <Header />

      {/* Hero */}
      <section className="relative overflow-hidden bg-gradient-to-br from-primary/5 via-background to-primary/5 px-4 py-20 md:py-32">
        <div className="container mx-auto text-center">
          <h1 className="mx-auto max-w-3xl text-4xl font-bold tracking-tight md:text-6xl">
            {t("hero_title")}
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-lg text-muted-foreground md:text-xl">
            {t("hero_subtitle")}
          </p>

          {/* Real search bar */}
          <div className="mt-10">
            <HomeSearchBar specialties={specialties} locations={locations} />
          </div>

          {/* Trust indicators */}
          <div className="mt-8 flex flex-wrap items-center justify-center gap-6 text-sm text-muted-foreground">
            <div className="flex items-center gap-1.5">
              <Shield className="h-4 w-4 text-green-600" />
              <span>Verified Doctors</span>
            </div>
            <div className="flex items-center gap-1.5">
              <Calendar className="h-4 w-4 text-blue-600" />
              <span>Instant Booking</span>
            </div>
            <div className="flex items-center gap-1.5">
              <Video className="h-4 w-4 text-purple-600" />
              <span>Video Consultations</span>
            </div>
            <div className="flex items-center gap-1.5">
              <Star className="h-4 w-4 text-yellow-500" />
              <span>{t("trusted_by")}</span>
            </div>
          </div>
        </div>
      </section>

      {/* Same-Day Appointments Banner */}
      {sameDayCount > 0 && (
        <section className="px-4 py-8 md:py-12">
          <div className="container mx-auto">
            <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200 p-6 md:p-8 dark:from-green-950/30 dark:to-emerald-950/30 dark:border-green-900">
              <div className="flex flex-col items-center gap-4 text-center md:flex-row md:text-left">
                <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-green-100 dark:bg-green-900/50">
                  <Clock className="h-7 w-7 text-green-600 dark:text-green-400" />
                </div>
                <div className="flex-1">
                  <h2 className="text-xl font-bold text-green-900 dark:text-green-100">
                    {t("same_day_title")}
                  </h2>
                  <p className="mt-1 text-green-700 dark:text-green-300">
                    {t("same_day_subtitle", { count: sameDayCount })}
                  </p>
                </div>
                <Button
                  size="lg"
                  className="shrink-0 rounded-full bg-green-600 text-white hover:bg-green-700"
                  asChild
                >
                  <Link href="/doctors?availableToday=true">
                    {t("same_day_cta")} <ArrowRight className="ml-2 h-4 w-4" />
                  </Link>
                </Button>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* Popular Specialties */}
      <section className="px-4 py-16 md:py-24">
        <div className="container mx-auto">
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-bold md:text-3xl">
              {t("popular_specialties")}
            </h2>
            <Button variant="ghost" asChild>
              <Link href="/specialties" className="gap-1">
                View All <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
          </div>

          <div className="mt-8 grid grid-cols-2 gap-4 sm:grid-cols-4 lg:grid-cols-8">
            {popularSpecialties.map((spec) => {
              const Icon = specialtyIcons[spec.icon] || Stethoscope;
              return (
                <Link key={spec.slug} href={`/specialties/${spec.slug}`}>
                  <Card className="group cursor-pointer transition-all hover:border-primary hover:shadow-md">
                    <CardContent className="flex flex-col items-center gap-3 p-4 text-center">
                      <div className="rounded-full bg-primary/10 p-3 transition-colors group-hover:bg-primary/20">
                        <Icon className="h-6 w-6 text-primary" />
                      </div>
                      <span className="text-xs font-medium">
                        {ts(spec.key)}
                      </span>
                    </CardContent>
                  </Card>
                </Link>
              );
            })}
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="bg-muted/30 px-4 py-16 md:py-24">
        <div className="container mx-auto text-center">
          <h2 className="text-2xl font-bold md:text-3xl">
            {t("how_it_works_title")}
          </h2>

          <div className="mt-12 grid gap-8 md:grid-cols-3">
            {[
              {
                icon: Search,
                title: t("step_1_title"),
                desc: t("step_1_desc"),
                step: "01",
              },
              {
                icon: Calendar,
                title: t("step_2_title"),
                desc: t("step_2_desc"),
                step: "02",
              },
              {
                icon: Video,
                title: t("step_3_title"),
                desc: t("step_3_desc"),
                step: "03",
              },
            ].map((step) => (
              <div key={step.step} className="flex flex-col items-center">
                <div className="relative">
                  <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary text-primary-foreground">
                    <step.icon className="h-7 w-7" />
                  </div>
                  <span className="absolute -right-2 -top-2 flex h-7 w-7 items-center justify-center rounded-full bg-foreground text-xs font-bold text-background">
                    {step.step}
                  </span>
                </div>
                <h3 className="mt-4 text-lg font-semibold">{step.title}</h3>
                <p className="mt-2 text-sm text-muted-foreground">
                  {step.desc}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* For Doctors CTA */}
      <section className="px-4 py-16 md:py-24">
        <div className="container mx-auto">
          <Card className="overflow-hidden bg-gradient-to-br from-primary to-primary/80">
            <CardContent className="flex flex-col items-center gap-6 p-8 text-center text-primary-foreground md:p-16">
              <Stethoscope className="h-12 w-12" />
              <h2 className="text-2xl font-bold md:text-3xl">
                {t("for_doctors_title")}
              </h2>
              <p className="max-w-xl text-primary-foreground/80">
                {t("for_doctors_desc")}
              </p>
              <Button
                size="lg"
                variant="secondary"
                className="mt-2 rounded-full"
                asChild
              >
                <Link href="/register-doctor">
                  {t("for_doctors_cta")} <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
            </CardContent>
          </Card>
        </div>
      </section>

      <Footer />
    </div>
  );
}
