import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Header } from "@/components/layout/dynamic-header";
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
  Search,
  Bell,
  BarChart3,
  CreditCard,
  Globe,
  CheckCircle2,
  Clock,
  MessageSquare,
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
  Scan,
} from "lucide-react";
import { SpecialtyMarquee } from "@/components/shared/specialty-marquee";

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
        {/* Decorative specialty icons — all 24 specialties scattered across hero */}
        <div className="absolute inset-0 pointer-events-none" aria-hidden="true">
          {/* Top row */}
          <Stethoscope className="absolute top-[8%] left-[2%] h-8 w-8 text-primary/[0.04] rotate-12" />
          <Heart className="absolute top-[12%] left-[14%] h-6 w-6 text-primary/[0.05] -rotate-6" />
          <Flower className="absolute top-[5%] left-[25%] h-6 w-6 text-primary/[0.04] rotate-[18deg]" />
          <Activity className="absolute top-[15%] left-[36%] h-7 w-7 text-primary/[0.03] -rotate-12" />
          <Brain className="absolute top-[6%] left-[60%] h-8 w-8 text-primary/[0.04] rotate-6" />
          <Eye className="absolute top-[14%] left-[73%] h-6 w-6 text-primary/[0.05] -rotate-6" />
          <Ear className="absolute top-[4%] left-[84%] h-6 w-6 text-primary/[0.04] rotate-[10deg]" />
          <Baby className="absolute top-[10%] left-[94%] h-7 w-7 text-primary/[0.03] -rotate-12" />

          {/* Middle-left + middle-right edges */}
          <Scan className="absolute top-[40%] left-[1%] h-6 w-6 text-primary/[0.04] rotate-[20deg]" />
          <Smile className="absolute top-[55%] left-[4%] h-5 w-5 text-primary/[0.05] -rotate-[8deg]" />
          <Apple className="absolute top-[35%] right-[2%] h-7 w-7 text-primary/[0.04] rotate-12" />
          <Wind className="absolute top-[52%] right-[5%] h-6 w-6 text-primary/[0.05] -rotate-[15deg]" />

          {/* Bottom row */}
          <Activity className="absolute bottom-[12%] left-[3%] h-6 w-6 text-primary/[0.04] -rotate-[20deg]" />
          <Apple className="absolute bottom-[8%] left-[13%] h-7 w-7 text-primary/[0.03] rotate-12" />
          <Droplets className="absolute bottom-[15%] left-[24%] h-5 w-5 text-primary/[0.05] -rotate-6" />
          <Shield className="absolute bottom-[6%] left-[35%] h-6 w-6 text-primary/[0.04] rotate-[15deg]" />
          <Baby className="absolute bottom-[18%] left-[48%] h-5 w-5 text-primary/[0.04] rotate-6" />
          <Heart className="absolute bottom-[10%] left-[58%] h-5 w-5 text-primary/[0.03] rotate-[22deg]" />
          <Flower className="absolute bottom-[5%] left-[68%] h-6 w-6 text-primary/[0.04] -rotate-12" />
          <Activity className="absolute bottom-[14%] left-[77%] h-7 w-7 text-primary/[0.03] rotate-[25deg]" />
          <Droplets className="absolute bottom-[8%] left-[87%] h-5 w-5 text-primary/[0.05] -rotate-[15deg]" />
          <Brain className="absolute bottom-[16%] left-[95%] h-6 w-6 text-primary/[0.04] rotate-6" />
        </div>

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
              <span>{t("verified_doctors")}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <Calendar className="h-4 w-4 text-blue-600" />
              <span>{t("instant_booking")}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <Video className="h-4 w-4 text-purple-600" />
              <span>{t("video_consultations")}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <Star className="h-4 w-4 text-yellow-500" />
              <span>{t("trusted_by")}</span>
            </div>
          </div>
        </div>
      </section>

      {/* Popular Specialties — animated marquee */}
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

          <SpecialtyMarquee
            specialties={allSpecialties.map((s) => ({
              slug: s.slug,
              icon: s.icon,
              label: ts(s.key),
            }))}
          />
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
