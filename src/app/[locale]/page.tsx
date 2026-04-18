import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Header } from "@/components/layout/dynamic-header";
import { Footer } from "@/components/layout/footer";
import { HomeSearchBar } from "@/components/search/home-search-bar";
import { getSpecialties, getLocations } from "@/actions/search";
import { getLiveAvailabilityCounts } from "@/actions/live-availability";
import {
  Calendar,
  Video,
  Shield,
  Star,
  ArrowRight,
  CreditCard,
  Globe,
  Clock,
  MessageSquare,
  Quote,
} from "lucide-react";
import { SpecialtyMarquee } from "@/components/shared/specialty-marquee";
import { HeroSpecialtyIcons } from "@/components/shared/hero-specialty-icons";
import { HowItWorksSection } from "@/components/home/how-it-works-section";
import { ChatWidget } from "@/components/chat/chat-widget";

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

  const [specialties, locations, liveCounts] = await Promise.all([
    getSpecialties(),
    getLocations(),
    getLiveAvailabilityCounts(),
  ]);

  return (
    <div className="flex min-h-screen flex-col">
      <Header />

      {/* Hero */}
      <section className="relative bg-gradient-to-br from-primary via-primary/90 to-teal-600 dark:from-primary/80 dark:via-primary/70 dark:to-teal-800 px-4 pt-20 pb-40 md:pt-32 md:pb-56">
        {/* Radial highlight overlay */}
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_-20%,rgba(255,255,255,0.12),transparent_60%)]" />
        {/* Bottom fade to background */}
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-48 md:h-64 bg-gradient-to-b from-transparent to-background" />
        <HeroSpecialtyIcons hideOnMobile variant="dark" />

        <div className="relative container mx-auto text-center">
          <h1 className="mx-auto max-w-3xl text-4xl font-bold tracking-tight text-white md:text-6xl">
            {t("hero_title")}
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-lg text-white/80 md:text-xl">
            {t("hero_subtitle")}
          </p>

          {/* Real search bar */}
          <div className="relative z-20 mt-10">
            <HomeSearchBar specialties={specialties} locations={locations} />
          </div>

          {/* Trust indicators */}
          <div className="mt-8 flex flex-wrap items-center justify-center gap-4 text-sm font-medium text-white">
            <div className="flex items-center gap-2 rounded-full bg-white/15 px-4 py-2 backdrop-blur-sm">
              <Shield className="h-4 w-4 fill-green-400 text-green-400 drop-shadow-sm" />
              <span>{t("verified_doctors")}</span>
            </div>
            <div className="flex items-center gap-2 rounded-full bg-white/15 px-4 py-2 backdrop-blur-sm">
              <Calendar className="h-4 w-4 fill-blue-200 text-white drop-shadow-sm" />
              <span>{t("instant_booking")}</span>
            </div>
            <div className="flex items-center gap-2 rounded-full bg-white/15 px-4 py-2 backdrop-blur-sm">
              <Video className="h-4 w-4 fill-fuchsia-300 text-fuchsia-300 drop-shadow-sm" />
              <span>{t("video_consultations")}</span>
            </div>
            <div className="flex items-center gap-2 rounded-full bg-white/15 px-4 py-2 backdrop-blur-sm">
              <Star className="h-4 w-4 fill-yellow-400 text-yellow-400 drop-shadow-sm" />
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
            initialCounts={liveCounts}
          />
        </div>
      </section>

      {/* Patient Testimonials */}
      <section className="bg-muted/30 px-4 py-16 md:py-24">
        <div className="container mx-auto">
          <div className="text-center">
            <h2 className="text-2xl font-bold md:text-3xl">
              What Our Patients Say
            </h2>
            <p className="mx-auto mt-3 max-w-xl text-muted-foreground">
              Real stories from patients who took control of their healthcare
            </p>
          </div>

          <div className="mx-auto mt-12 grid max-w-6xl gap-x-5 gap-y-8 md:grid-cols-3 md:gap-y-0">
            {[
              {
                quote:
                  "As a childminder, I simply don\u2019t have time to sit in waiting rooms. I booked a same-day GP appointment and was seen within the hour. I was back with the children before lunch.",
                name: "Mary T.",
                location: "Islington, London",
                offset: "md:mt-0",
                rotate: "md:-rotate-[1.5deg]",
                desktopOnly: false,
              },
              {
                quote:
                  "My GP said I\u2019d be waiting weeks for an ultrasound. I went private through MyDoctors360, had it booked within days, and the relief of knowing everything was fine was worth every penny.",
                name: "Colin A.",
                location: "Surrey",
                offset: "md:mt-6",
                rotate: "md:rotate-[1deg]",
                desktopOnly: false,
              },
              {
                quote:
                  "Needed a full blood panel but the NHS wait was over a month. Found a clinic nearby, had bloods taken the next morning, results back in 48 hours. Incredibly simple.",
                name: "Priya S.",
                location: "Birmingham",
                offset: "md:-mt-2",
                rotate: "md:rotate-[1.8deg]",
                desktopOnly: true,
              },
              {
                quote:
                  "I\u2019d been putting off seeing a dentist for years out of sheer dread. MyDoctors360 let me find someone highly rated for nervous patients and book without a phone call. Best dental experience ever.",
                name: "James R.",
                location: "Edinburgh",
                offset: "md:mt-4",
                rotate: "md:rotate-[1.5deg]",
                desktopOnly: true,
              },
              {
                quote:
                  "My daughter needed a paediatric referral and the waiting list was months long. We found a specialist on here, got seen within a week, and had a clear plan of action straight away.",
                name: "Sarah L.",
                location: "Bristol",
                offset: "md:-mt-4",
                rotate: "md:-rotate-[1.2deg]",
                desktopOnly: true,
              },
              {
                quote:
                  "Moved to the UK recently and had no idea how to register with a GP. MyDoctors360 made it easy to see a doctor privately while I sorted out the paperwork. Lifesaver.",
                name: "Amir K.",
                location: "Manchester",
                offset: "md:mt-8",
                rotate: "md:-rotate-[1.8deg]",
                desktopOnly: true,
              },
            ].map((testimonial) => (
              <div
                key={testimonial.name}
                className={`${testimonial.desktopOnly ? "hidden md:flex" : "flex"} relative flex-col items-center transition-transform duration-200 hover:z-10 hover:scale-[1.03] ${testimonial.offset} ${testimonial.rotate}`}
              >
                {/* Speech bubble */}
                <div className="relative w-full rounded-xl border bg-background p-4 shadow-sm hover:shadow-lg">
                  <Quote className="mb-2 h-5 w-5 text-primary/25" />

                  {/* 5 stars */}
                  <div className="mb-2.5 flex gap-0.5">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <Star
                        key={i}
                        className="h-4 w-4 fill-yellow-400 text-yellow-400"
                      />
                    ))}
                  </div>

                  <p className="text-[13px] leading-relaxed text-foreground/90 italic">
                    &ldquo;{testimonial.quote}&rdquo;
                  </p>

                  {/* Speech bubble tail */}
                  <div className="absolute -bottom-2.5 left-8 h-5 w-5 rotate-45 border-b border-r bg-background" />
                </div>

                {/* Name & location */}
                <div className="mt-4 text-center">
                  <p className="text-sm font-semibold">{testimonial.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {testimonial.location}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How It Works — Enhanced */}
      <HowItWorksSection />

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
      <ChatWidget />
    </div>
  );
}
