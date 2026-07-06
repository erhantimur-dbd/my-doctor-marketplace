import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { StepAnimation } from "@/components/how-it-works/step-animation";
import {
  CreditCard,
  Shield,
  Star,
  Clock,
  Globe,
  ArrowRight,
  CheckCircle2,
  MessageSquare,
  Stethoscope,
  Video,
  CalendarCheck,
  MapPin,
  Microscope,
  HeartPulse,
  Lock,
  BadgeCheck,
  Quote,
  BookOpen,
} from "lucide-react";
import { HeroSpecialtyIcons } from "@/components/shared/hero-specialty-icons";
import { getPublishedPosts } from "@/actions/blog";

const benefits = [
  {
    icon: Shield,
    key: "benefit_verified",
    color: { bg: "bg-emerald-50", text: "text-emerald-600" },
  },
  {
    icon: CreditCard,
    key: "benefit_pricing",
    color: { bg: "bg-blue-50", text: "text-blue-600" },
  },
  {
    icon: Clock,
    key: "benefit_instant",
    color: { bg: "bg-amber-50", text: "text-amber-600" },
  },
  {
    icon: Globe,
    key: "benefit_crossborder",
    color: { bg: "bg-teal-50", text: "text-teal-600" },
  },
  {
    icon: Star,
    key: "benefit_reviews",
    color: { bg: "bg-yellow-50", text: "text-yellow-600" },
  },
  {
    icon: MessageSquare,
    key: "benefit_reminders",
    color: { bg: "bg-violet-50", text: "text-violet-600" },
  },
] as const;

const bookingTypes = [
  { icon: Video, key: "type_video", color: "bg-blue-50 text-blue-600" },
  { icon: MapPin, key: "type_inperson", color: "bg-emerald-50 text-emerald-600" },
  { icon: CalendarCheck, key: "type_sameday", color: "bg-amber-50 text-amber-600" },
  { icon: Stethoscope, key: "type_referrals", color: "bg-purple-50 text-purple-600" },
  { icon: Microscope, key: "type_screenings", color: "bg-teal-50 text-teal-600" },
  { icon: HeartPulse, key: "type_mental", color: "bg-rose-50 text-rose-600" },
] as const;

// Names and locations are real attributions and stay untranslated
const testimonials = [
  { quoteKey: "testimonial_sameday_quote", name: "Mary T.", location: "Islington, London" },
  { quoteKey: "testimonial_ultrasound_quote", name: "Colin A.", location: "Surrey" },
  { quoteKey: "testimonial_dentist_quote", name: "James R.", location: "Edinburgh" },
] as const;

const faqs = [
  "faq_referral",
  "faq_cost",
  "faq_family",
  "faq_cancel",
  "faq_payment",
  "faq_video",
  "faq_nhs",
  "faq_speed",
] as const;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "meta" });
  const seoMeta = (await import("@/lib/seo/metadata")).generateMetadata;
  return seoMeta({
    title: t("howItWorks.title"),
    description: t("howItWorks.description"),
    path: `/${locale}/how-it-works`,
  });
}

export default async function HowItWorksPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "howItWorks" });
  // Fetch latest 3 blog posts for the blog preview section
  const { posts: latestPosts } = await getPublishedPosts("en", 1, 3);

  return (
    <>
      {/* Hero */}
      <section className="relative bg-gradient-to-br from-primary/5 via-background to-primary/5 px-4 py-16 md:py-24">
        <HeroSpecialtyIcons />
        <div className="relative container mx-auto text-center">
          <h1 className="text-3xl font-bold tracking-tight md:text-5xl">
            {t("hero_title")}
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-lg text-muted-foreground">
            {t("hero_subtitle")}
          </p>
          <div className="mt-5 hidden items-center gap-2 rounded-full bg-primary/10 px-4 py-2 text-sm font-medium text-primary md:inline-flex">
            <CheckCircle2 className="h-4 w-4" />
            {t("hero_badge")}
          </div>
        </div>
      </section>

      {/* Interactive Step Animation */}
      <section className="px-4 py-12 md:py-16">
        <div className="container mx-auto">
          <StepAnimation />
        </div>
      </section>

      {/* What Can You Book? */}
      <section className="bg-muted/30 px-4 py-12 md:py-20">
        <div className="container mx-auto">
          <h2 className="text-center text-2xl font-bold md:text-3xl">
            {t("book_title")}
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-center text-muted-foreground">
            {t("book_subtitle")}
          </p>
          <div className="mx-auto mt-12 grid max-w-5xl gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {bookingTypes.map((type) => (
              <div
                key={type.key}
                className="flex items-start gap-4 rounded-xl border bg-background p-5 transition-shadow hover:shadow-md"
              >
                <div className={`shrink-0 rounded-lg p-2.5 ${type.color}`}>
                  <type.icon className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="font-semibold">{t(`${type.key}_title`)}</h3>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {t(`${type.key}_desc`)}
                  </p>
                </div>
              </div>
            ))}
          </div>
          <div className="mt-8 text-center">
            <Button variant="ghost" asChild>
              <Link href="/specialties" className="gap-1">
                {t("browse_specialties")} <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
          </div>
        </div>
      </section>

      {/* Benefits */}
      <section className="px-4 py-12 md:py-20">
        <div className="container mx-auto">
          <h2 className="text-center text-2xl font-bold md:text-3xl">
            {t("why_title")}
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-center text-muted-foreground">
            {t("why_subtitle")}
          </p>
          <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {benefits.map((benefit) => (
              <Card key={benefit.key}>
                <CardContent className="flex flex-col items-center p-6 text-center">
                  <div className={`rounded-xl ${benefit.color.bg} p-3`}>
                    <benefit.icon
                      className={`h-6 w-6 ${benefit.color.text}`}
                    />
                  </div>
                  <h3 className="mt-4 font-semibold">{t(`${benefit.key}_title`)}</h3>
                  <p className="mt-2 text-sm text-muted-foreground">
                    {t(`${benefit.key}_desc`)}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Testimonials */}
      <section className="bg-muted/30 px-4 py-12 md:py-20">
        <div className="container mx-auto">
          <h2 className="text-center text-2xl font-bold md:text-3xl">
            {t("testimonials_title")}
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-center text-muted-foreground">
            {t("testimonials_subtitle")}
          </p>
          <div className="mx-auto mt-12 grid max-w-5xl gap-6 md:grid-cols-3">
            {testimonials.map((item) => (
              <div key={item.name} className="flex flex-col">
                <div className="relative flex-1 rounded-xl border bg-background p-5 shadow-sm">
                  <Quote className="mb-2 h-5 w-5 text-primary/25" />
                  <div className="mb-3 flex gap-0.5">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <Star
                        key={i}
                        className="h-4 w-4 fill-yellow-400 text-yellow-400"
                      />
                    ))}
                  </div>
                  <p className="text-[13px] leading-relaxed text-foreground/90 italic">
                    &ldquo;{t(item.quoteKey)}&rdquo;
                  </p>
                  <div className="absolute -bottom-2.5 left-8 h-5 w-5 rotate-45 border-b border-r bg-background" />
                </div>
                <div className="mt-4 pl-2">
                  <p className="text-sm font-semibold">{item.name}</p>
                  <p className="text-xs text-muted-foreground">{item.location}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="px-4 py-12 md:py-20">
        <div className="container mx-auto">
          <h2 className="text-center text-2xl font-bold md:text-3xl">
            {t("faq_title")}
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-center text-muted-foreground">
            {t("faq_subtitle")}
          </p>
          <div className="mx-auto mt-12 max-w-3xl">
            <Accordion type="single" collapsible className="w-full">
              {faqs.map((key, i) => (
                <AccordionItem key={key} value={`faq-${i}`}>
                  <AccordionTrigger className="text-left text-[15px] font-medium">
                    {t(`${key}_q`)}
                  </AccordionTrigger>
                  <AccordionContent className="text-sm text-muted-foreground leading-relaxed">
                    {t(`${key}_a`)}
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </div>
        </div>
      </section>

      {/* Trust & Security Bar */}
      <section className="border-y bg-muted/20 px-4 py-8">
        <div className="container mx-auto">
          <div className="flex flex-wrap items-center justify-center gap-x-10 gap-y-4 text-sm text-muted-foreground">
            <div className="flex items-center gap-2">
              <Lock className="h-4 w-4 text-green-600" />
              <span>{t("trust_stripe")}</span>
            </div>
            <div className="flex items-center gap-2">
              <Shield className="h-4 w-4 text-blue-600" />
              <span>{t("trust_gdpr")}</span>
            </div>
            <div className="flex items-center gap-2">
              <BadgeCheck className="h-4 w-4 text-emerald-600" />
              <span>{t("trust_gmc")}</span>
            </div>
            <div className="flex items-center gap-2">
              <Lock className="h-4 w-4 text-violet-600" />
              <span>{t("trust_ssl")}</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-primary" />
              <span>{t("trust_nosub")}</span>
            </div>
          </div>
        </div>
      </section>

      {/* Latest from the Blog */}
      {latestPosts && latestPosts.length > 0 && (
        <section className="px-4 py-12 md:py-20">
          <div className="container mx-auto">
            <h2 className="text-center text-2xl font-bold md:text-3xl">
              {t("blog_title")}
            </h2>
            <p className="mx-auto mt-4 max-w-xl text-center text-muted-foreground">
              {t("blog_subtitle")}
            </p>
            <div className="mx-auto mt-12 grid max-w-5xl gap-6 md:grid-cols-3">
              {latestPosts.map((post: any) => (
                <Link
                  key={post.slug}
                  href={`/blog/${post.slug}`}
                  className="group"
                >
                  <Card className="flex h-full flex-col overflow-hidden transition-shadow hover:shadow-md">
                    <div className="aspect-[16/9] overflow-hidden bg-muted">
                      {post.cover_image_url ? (
                        <img
                          src={post.cover_image_url}
                          alt={post.title}
                          className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                        />
                      ) : (
                        <div className="flex h-full items-center justify-center">
                          <BookOpen className="h-10 w-10 text-muted-foreground/30" />
                        </div>
                      )}
                    </div>
                    <CardContent className="flex flex-1 flex-col p-5">
                      {post.tags && post.tags.length > 0 && (
                        <div className="mb-2 flex flex-wrap gap-1.5">
                          {post.tags.slice(0, 2).map((tag: string) => (
                            <span
                              key={tag}
                              className="rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium text-muted-foreground"
                            >
                              {tag}
                            </span>
                          ))}
                        </div>
                      )}
                      <h3 className="font-semibold leading-snug line-clamp-2 group-hover:text-primary">
                        {post.title}
                      </h3>
                      {post.excerpt && (
                        <p className="mt-2 text-sm text-muted-foreground line-clamp-2">
                          {post.excerpt}
                        </p>
                      )}
                      <div className="mt-auto flex items-center gap-1 pt-3 text-sm font-medium text-primary">
                        <BookOpen className="h-3.5 w-3.5" />
                        {t("blog_read")}
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              ))}
            </div>
            <div className="mt-8 text-center">
              <Button variant="ghost" asChild>
                <Link href="/blog" className="gap-1">
                  {t("blog_view_all")} <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
            </div>
          </div>
        </section>
      )}

      {/* CTA */}
      <section className="bg-muted/30 px-4 py-12 md:py-20">
        <div className="container mx-auto text-center">
          <h2 className="text-2xl font-bold md:text-3xl">
            {t("cta_title")}
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-muted-foreground">
            {t("cta_subtitle")}
          </p>
          <div className="mt-8 flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
            <Button size="lg" className="rounded-full" asChild>
              <Link href="/doctors">
                {t("cta_find")} <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
            <Button
              size="lg"
              variant="outline"
              className="rounded-full"
              asChild
            >
              <Link href="/register">{t("cta_create")}</Link>
            </Button>
          </div>
          <p className="mt-4 text-sm text-muted-foreground">
            {t("cta_footnote")}
          </p>
        </div>
      </section>
    </>
  );
}
