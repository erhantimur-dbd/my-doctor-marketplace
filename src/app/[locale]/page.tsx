import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Header } from "@/components/layout/header";
import { Footer } from "@/components/layout/footer";
import { HomeSearchBar } from "@/components/search/home-search-bar";
import { getSpecialties, getLocations } from "@/actions/search";
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
  Bell,
  BarChart3,
  CreditCard,
  Globe,
  CheckCircle2,
  Clock,
  MessageSquare,
} from "lucide-react";
import { getSpecialtyColor } from "@/lib/constants/specialty-colors";

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

  const [specialties, locations] = await Promise.all([
    getSpecialties(),
    getLocations(),
  ]);

  return (
    <div className="flex min-h-screen flex-col">
      <Header />

      {/* Hero */}
      <section className="relative bg-gradient-to-br from-primary/5 via-background to-primary/5 px-4 py-20 md:py-32">
        <div className="container mx-auto text-center">
          <h1 className="mx-auto max-w-3xl text-4xl font-bold tracking-tight md:text-6xl">
            {t("hero_title")}
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-lg text-muted-foreground md:text-xl">
            {t("hero_subtitle")}
          </p>

          {/* Real search bar */}
          <div className="relative z-20 mt-10">
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
              const c = getSpecialtyColor(spec.slug);
              return (
                <Link key={spec.slug} href={`/specialties/${spec.slug}`}>
                  <Card className={`group cursor-pointer transition-all ${c.border} hover:shadow-md`}>
                    <CardContent className="flex flex-col items-center gap-3 p-4 text-center">
                      <div className={`rounded-full ${c.bg} p-3 transition-colors ${c.hoverBg}`}>
                        <Icon className={`h-6 w-6 ${c.text}`} />
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

      {/* How It Works — Enhanced */}
      <section className="bg-muted/30 px-4 py-16 md:py-24">
        <div className="container mx-auto">
          <div className="text-center">
            <h2 className="text-2xl font-bold md:text-3xl">
              {t("how_it_works_title")}
            </h2>
            <p className="mx-auto mt-3 max-w-xl text-muted-foreground">
              {t("how_it_works_subtitle")}
            </p>
          </div>

          <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {[
              {
                icon: Search,
                title: t("step_1_title"),
                desc: t("step_1_desc"),
                features: [t("step_1_f1"), t("step_1_f2"), t("step_1_f3")],
                step: "01",
                iconBg: "bg-gradient-to-br from-blue-500 to-blue-600",
                badge: "bg-blue-900 text-blue-50",
                check: "text-blue-500",
              },
              {
                icon: Calendar,
                title: t("step_2_title"),
                desc: t("step_2_desc"),
                features: [t("step_2_f1"), t("step_2_f2"), t("step_2_f3")],
                step: "02",
                iconBg: "bg-gradient-to-br from-emerald-500 to-emerald-600",
                badge: "bg-emerald-900 text-emerald-50",
                check: "text-emerald-500",
              },
              {
                icon: Bell,
                title: t("step_3_title"),
                desc: t("step_3_desc"),
                features: [t("step_3_f1"), t("step_3_f2"), t("step_3_f3")],
                step: "03",
                iconBg: "bg-gradient-to-br from-amber-500 to-amber-600",
                badge: "bg-amber-900 text-amber-50",
                check: "text-amber-500",
              },
              {
                icon: Stethoscope,
                title: t("step_4_title"),
                desc: t("step_4_desc"),
                features: [t("step_4_f1"), t("step_4_f2"), t("step_4_f3")],
                step: "04",
                iconBg: "bg-gradient-to-br from-teal-500 to-teal-600",
                badge: "bg-teal-900 text-teal-50",
                check: "text-teal-500",
              },
            ].map((step) => (
              <Card key={step.step} className="relative overflow-hidden border bg-background">
                <CardContent className="p-6">
                  <div className="relative mb-4 inline-block">
                    <div className={`flex h-14 w-14 items-center justify-center rounded-2xl ${step.iconBg} text-white shadow-lg`}>
                      <step.icon className="h-6 w-6" />
                    </div>
                    <span className={`absolute -right-2 -top-2 flex h-6 w-6 items-center justify-center rounded-full ${step.badge} text-[10px] font-bold`}>
                      {step.step}
                    </span>
                  </div>
                  <h3 className="text-lg font-semibold">{step.title}</h3>
                  <p className="mt-1.5 text-sm text-muted-foreground">
                    {step.desc}
                  </p>
                  <ul className="mt-4 space-y-2">
                    {step.features.map((feature) => (
                      <li key={feature} className="flex items-center gap-2 text-sm">
                        <CheckCircle2 className={`h-4 w-4 shrink-0 ${step.check}`} />
                        {feature}
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            ))}
          </div>

          <div className="mt-8 text-center">
            <Button variant="ghost" asChild>
              <Link href="/how-it-works" className="gap-1">
                {t("learn_more")} <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
          </div>
        </div>
      </section>

      {/* Why Choose MyDoctors360 */}
      <section className="px-4 py-16 md:py-24">
        <div className="container mx-auto">
          <div className="text-center">
            <h2 className="text-2xl font-bold md:text-3xl">
              {t("why_choose_title")}
            </h2>
            <p className="mx-auto mt-3 max-w-xl text-muted-foreground">
              {t("why_choose_subtitle")}
            </p>
          </div>

          <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {[
              {
                icon: Shield,
                title: t("why_verified_title"),
                desc: t("why_verified_desc"),
                color: { bg: "bg-emerald-50", text: "text-emerald-600" },
              },
              {
                icon: CreditCard,
                title: t("why_pricing_title"),
                desc: t("why_pricing_desc"),
                color: { bg: "bg-blue-50", text: "text-blue-600" },
              },
              {
                icon: Clock,
                title: t("why_booking_title"),
                desc: t("why_booking_desc"),
                color: { bg: "bg-amber-50", text: "text-amber-600" },
              },
              {
                icon: Globe,
                title: t("why_cross_border_title"),
                desc: t("why_cross_border_desc"),
                color: { bg: "bg-teal-50", text: "text-teal-600" },
              },
              {
                icon: Star,
                title: t("why_reviews_title"),
                desc: t("why_reviews_desc"),
                color: { bg: "bg-yellow-50", text: "text-yellow-600" },
              },
              {
                icon: MessageSquare,
                title: t("why_reminders_title"),
                desc: t("why_reminders_desc"),
                color: { bg: "bg-violet-50", text: "text-violet-600" },
              },
            ].map((benefit) => (
              <Card key={benefit.title} className="border bg-background transition-shadow hover:shadow-md">
                <CardContent className="flex flex-col items-center p-6 text-center">
                  <div className={`rounded-xl ${benefit.color.bg} p-3`}>
                    <benefit.icon className={`h-6 w-6 ${benefit.color.text}`} />
                  </div>
                  <h3 className="mt-4 font-semibold">{benefit.title}</h3>
                  <p className="mt-2 text-sm text-muted-foreground">
                    {benefit.desc}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>

          <div className="mt-10 text-center">
            <Button size="lg" className="rounded-full" asChild>
              <Link href="/doctors">
                {t("why_choose_cta")} <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
}
