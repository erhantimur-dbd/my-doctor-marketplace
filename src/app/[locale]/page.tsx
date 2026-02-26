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
                iconBg: "bg-gradient-to-br from-blue-500 to-blue-600",
                badge: "bg-blue-900 text-blue-50",
              },
              {
                icon: Calendar,
                title: t("step_2_title"),
                desc: t("step_2_desc"),
                step: "02",
                iconBg: "bg-gradient-to-br from-emerald-500 to-emerald-600",
                badge: "bg-emerald-900 text-emerald-50",
              },
              {
                icon: Video,
                title: t("step_3_title"),
                desc: t("step_3_desc"),
                step: "03",
                iconBg: "bg-gradient-to-br from-violet-500 to-violet-600",
                badge: "bg-violet-900 text-violet-50",
              },
            ].map((step) => (
              <div key={step.step} className="flex flex-col items-center">
                <div className="relative">
                  <div className={`flex h-16 w-16 items-center justify-center rounded-2xl ${step.iconBg} text-white shadow-lg`}>
                    <step.icon className="h-7 w-7" />
                  </div>
                  <span className={`absolute -right-2 -top-2 flex h-7 w-7 items-center justify-center rounded-full ${step.badge} text-xs font-bold`}>
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
          <Card className="overflow-hidden border-0 bg-gradient-to-br from-slate-900 via-blue-950 to-slate-900">
            <CardContent className="p-8 md:p-14 lg:p-16">
              <div className="mx-auto max-w-3xl text-center">
                <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-white/10 backdrop-blur-sm">
                  <Stethoscope className="h-7 w-7 text-teal-400" />
                </div>
                <h2 className="mt-5 text-2xl font-bold text-white md:text-3xl">
                  {t("for_doctors_title")}
                </h2>
                <p className="mx-auto mt-3 max-w-xl text-white/70">
                  {t("for_doctors_desc")}
                </p>

                {/* USP Feature Grid */}
                <div className="mt-10 grid grid-cols-2 gap-3 md:grid-cols-3">
                  {[
                    {
                      icon: Calendar,
                      title: "Smart Booking",
                      desc: "Real-time calendar with instant patient booking",
                      color: "text-teal-400",
                    },
                    {
                      icon: Bell,
                      title: "Auto Reminders",
                      desc: "Reduce no-shows with email, SMS & WhatsApp",
                      color: "text-amber-400",
                    },
                    {
                      icon: BarChart3,
                      title: "Revenue Analytics",
                      desc: "Track earnings, bookings & growth metrics",
                      color: "text-blue-400",
                    },
                    {
                      icon: Shield,
                      title: "Verified Profile",
                      desc: "Build trust with a credential-verified badge",
                      color: "text-emerald-400",
                    },
                    {
                      icon: CreditCard,
                      title: "Secure Payments",
                      desc: "Stripe-powered payouts directly to your bank",
                      color: "text-violet-400",
                    },
                    {
                      icon: Globe,
                      title: "Multi-Language",
                      desc: "Reach patients across Europe in 4 languages",
                      color: "text-rose-400",
                    },
                  ].map((feature) => (
                    <div
                      key={feature.title}
                      className="flex items-start gap-3 rounded-xl bg-white/[0.06] p-4 text-left backdrop-blur-sm transition-colors hover:bg-white/[0.1]"
                    >
                      <feature.icon
                        className={`mt-0.5 h-5 w-5 shrink-0 ${feature.color}`}
                      />
                      <div>
                        <p className="text-sm font-semibold text-white">
                          {feature.title}
                        </p>
                        <p className="mt-0.5 text-xs leading-relaxed text-white/60">
                          {feature.desc}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>

                <Button
                  size="lg"
                  className="mt-10 rounded-full bg-white text-slate-900 hover:bg-white/90"
                  asChild
                >
                  <Link href="/register-doctor">
                    {t("for_doctors_cta")}{" "}
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </section>

      <Footer />
    </div>
  );
}
