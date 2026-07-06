import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  CheckCircle2,
  ArrowRight,
  Stethoscope,
  Calendar,
  BarChart3,
  CreditCard,
  Users,
  Video,
  Globe,
  Bell,
  Shield,
  Zap,
  FlaskConical,
  X,
  Building2,
  Crown,
  Award,
  TrendingUp,
  Target,
  MessageSquareHeart,
  Globe2,
} from "lucide-react";
import { HeroSpecialtyIcons } from "@/components/shared/hero-specialty-icons";
import { ClinicGetStartedButton } from "@/components/shared/clinic-get-started-button";
import {
  LICENSE_TIERS,
  AVAILABLE_MODULES,
  TESTING_STANDALONE_PLAN,
  PLATFORM_BOOKING_FEE_PERCENT,
  formatPriceForLocale,
  formatPrice,
} from "@/lib/constants/license-tiers";

const BENEFITS = [
  { icon: Award, key: "benefit_reputation" },
  { icon: TrendingUp, key: "benefit_grow" },
  { icon: Target, key: "benefit_target" },
  { icon: MessageSquareHeart, key: "benefit_experience" },
  { icon: Globe2, key: "benefit_network" },
] as const;

const platformFeatures = [
  { icon: Globe, key: "pf_visibility", bg: "bg-blue-50 dark:bg-blue-950/30", text: "text-blue-600" },
  { icon: Calendar, key: "pf_scheduling", bg: "bg-violet-50 dark:bg-violet-950/30", text: "text-violet-600" },
  { icon: CreditCard, key: "pf_payments", bg: "bg-emerald-50 dark:bg-emerald-950/30", text: "text-emerald-600" },
  { icon: Video, key: "pf_video", bg: "bg-purple-50 dark:bg-purple-950/30", text: "text-purple-600" },
  { icon: Bell, key: "pf_reminders", bg: "bg-amber-50 dark:bg-amber-950/30", text: "text-amber-600" },
  { icon: BarChart3, key: "pf_analytics", bg: "bg-cyan-50 dark:bg-cyan-950/30", text: "text-cyan-600" },
  { icon: Users, key: "pf_crm", bg: "bg-rose-50 dark:bg-rose-950/30", text: "text-rose-600" },
  { icon: Shield, key: "pf_badge", bg: "bg-teal-50 dark:bg-teal-950/30", text: "text-teal-600" },
] as const;

const gettingStartedSteps = [
  {
    step: "1",
    icon: Stethoscope,
    key: "step1",
    bg: "bg-teal-50 dark:bg-teal-950/30",
    text: "text-teal-600",
    ring: "ring-teal-200 dark:ring-teal-800",
  },
  {
    step: "2",
    icon: Shield,
    key: "step2",
    bg: "bg-blue-50 dark:bg-blue-950/30",
    text: "text-blue-600",
    ring: "ring-blue-200 dark:ring-blue-800",
  },
  {
    step: "3",
    icon: CreditCard,
    key: "step3",
    bg: "bg-violet-50 dark:bg-violet-950/30",
    text: "text-violet-600",
    ring: "ring-violet-200 dark:ring-violet-800",
  },
  {
    step: "4",
    icon: Zap,
    key: "step4",
    bg: "bg-amber-50 dark:bg-amber-950/30",
    text: "text-amber-600",
    ring: "ring-amber-200 dark:ring-amber-800",
  },
] as const;

const uspFeatures = [
  { icon: Calendar, key: "usp_booking" },
  { icon: Bell, key: "usp_reminders" },
  { icon: BarChart3, key: "usp_analytics" },
  { icon: Shield, key: "usp_verified" },
  { icon: CreditCard, key: "usp_payments" },
  { icon: Globe, key: "usp_multilang" },
] as const;

/** Icon for each tier */
function getTierIcon(tierId: string) {
  switch (tierId) {
    case "free":
      return Stethoscope;
    case "starter":
      return Zap;
    case "professional":
      return BarChart3;
    case "clinic":
      return Building2;
    case "enterprise":
      return Crown;
    default:
      return Stethoscope;
  }
}

/** Colour scheme for each tier icon */
function getTierColor(tierId: string) {
  switch (tierId) {
    case "starter":
      return {
        bg: "bg-teal-50 dark:bg-teal-950/30",
        text: "text-teal-600",
      };
    case "professional":
      return {
        bg: "bg-violet-50 dark:bg-violet-950/30",
        text: "text-violet-600",
      };
    case "clinic":
      return {
        bg: "bg-blue-50 dark:bg-blue-950/30",
        text: "text-blue-600",
      };
    case "enterprise":
      return {
        bg: "bg-amber-50 dark:bg-amber-950/30",
        text: "text-amber-600",
      };
    default:
      return {
        bg: "bg-emerald-50 dark:bg-emerald-950/30",
        text: "text-emerald-600",
      };
  }
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "meta" });
  const seoMeta = (await import("@/lib/seo/metadata")).generateMetadata;
  return seoMeta({
    title: t("pricing.title"),
    description: t("pricing.description"),
    path: `/${locale}/pricing`,
  });
}

export default async function PricingPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "pricing" });

  // Get paid tiers for the main grid (exclude free, it's shown separately)
  const paidTiers = LICENSE_TIERS.filter((t) => !t.isFreeTier);
  const testingModule = AVAILABLE_MODULES.find((m) => m.key === "medical_testing");

  return (
    <>
      {/* Hero */}
      <section className="relative bg-gradient-to-br from-primary/5 via-background to-primary/5 px-4 py-16 md:py-24">
        <HeroSpecialtyIcons />
        <div className="relative container mx-auto text-center">
          <Badge className="mb-4 bg-primary/10 text-primary hover:bg-primary/15 border-primary/20">
            {t("hero_badge")}
          </Badge>
          <h1 className="text-3xl font-bold tracking-tight md:text-5xl">
            {t("hero_title")}
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-lg text-muted-foreground">
            {t("hero_subtitle")}
          </p>
        </div>
      </section>

      {/* Benefits */}
      <section className="border-b bg-background px-4 py-12 md:py-16">
        <div className="container mx-auto max-w-6xl">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
            {BENEFITS.map((benefit) => {
              const Icon = benefit.icon;
              return (
                <div
                  key={benefit.key}
                  className="flex flex-col rounded-xl border bg-card p-5 shadow-sm transition-shadow hover:shadow-md"
                >
                  <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <Icon className="h-5 w-5" />
                  </div>
                  <h3 className="text-base font-semibold leading-tight">{t(`${benefit.key}_title`)}</h3>
                  <p className="mt-2 text-sm text-muted-foreground">{t(`${benefit.key}_desc`)}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Pricing Plans */}
      <section className="px-4 py-12 md:py-20">
        <div className="container mx-auto max-w-6xl">
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4 lg:items-stretch">
            {paidTiers.map((tier) => {
              const TierIcon = getTierIcon(tier.id);
              const tierColor = getTierColor(tier.id);
              const isPopular = tier.popular;
              const isEnterprise = tier.isCustomPricing;

              return (
                <Card
                  key={tier.id}
                  className={`relative flex flex-col overflow-hidden ${
                    isPopular
                      ? "border-foreground/20 shadow-lg"
                      : ""
                  }`}
                >
                  {isPopular && (
                    <div className="absolute -top-0 left-1/2 z-10 -translate-x-1/2 translate-y-2">
                      <Badge className="bg-foreground text-background shadow-md hover:bg-foreground">
                        {t("most_popular")}
                      </Badge>
                    </div>
                  )}

                  {/* ── Fixed-height header: icon + name + description ── */}
                  <div className="flex flex-col items-center px-6 pt-10 text-center">
                    <div className={`mb-3 flex h-10 w-10 items-center justify-center rounded-xl ${tierColor.bg}`}>
                      <TierIcon className={`h-5 w-5 ${tierColor.text}`} />
                    </div>
                    <h3 className="text-lg font-bold">{tier.name}</h3>
                    <p className="mt-1 h-[40px] text-sm text-muted-foreground">
                      {tier.description}
                    </p>
                  </div>

                  {/* ── Fixed-height price block ── */}
                  <div className="flex h-[80px] flex-col items-center justify-center px-6 text-center">
                    {isEnterprise ? (
                      <>
                        <span className="text-4xl font-bold">{t("custom_price")}</span>
                      </>
                    ) : (
                      <>
                        <div>
                          <span className="text-4xl font-bold">
                            {formatPriceForLocale(tier.priceMonthlyPence, locale)}
                          </span>
                          <span className="text-muted-foreground">
                            {" "}
                            {tier.perUser ? t("per_user_mo") : t("per_month")}
                          </span>
                        </div>
                      </>
                    )}
                  </div>

                  {/* ── Fixed-height meta: commitment + seat info ── */}
                  <div className="flex h-[48px] flex-col items-center justify-center px-6 text-center">
                    {isEnterprise ? (
                      <p className="text-xs text-muted-foreground">
                        {t("enterprise_tailored")}
                      </p>
                    ) : (
                      <>
                        {tier.commitmentMonths > 0 && (
                          <p className="text-xs text-muted-foreground">
                            {t("commitment_note")}
                          </p>
                        )}
                        <p className="text-xs text-muted-foreground">
                          {tier.perUser
                            ? t("seats_range", { min: tier.defaultSeats, max: tier.maxSeats })
                            : tier.includedSeats > 1
                              ? t("seats_included", { included: tier.includedSeats, max: tier.maxSeats })
                              : t("seats_single", { count: tier.defaultSeats })}
                          {tier.extraSeatPricePence > 0 && !tier.perUser && (
                            <>
                              {" · "}
                              {t("extra_seat", {
                                price: formatPriceForLocale(tier.extraSeatPricePence, locale),
                              })}
                            </>
                          )}
                        </p>
                      </>
                    )}
                  </div>

                  {/* ── Separator ── */}
                  <div className="px-6 pb-6 pt-2">
                    <Separator />
                  </div>

                  {/* ── Features list (flex-1 fills remaining space) ── */}
                  <CardContent className="flex flex-1 flex-col px-6 pb-6 pt-0">
                    <ul className="flex-1 space-y-2.5">
                      {tier.features.map((feature) => (
                        <li key={feature} className="flex items-start gap-2 text-sm">
                          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                          {feature}
                        </li>
                      ))}
                    </ul>
                  </CardContent>

                  {/* ── CTA button ── */}
                  <CardFooter className="p-6 pt-0">
                    {isEnterprise ? (
                      <Button
                        className="w-full rounded-full"
                        variant="outline"
                        asChild
                      >
                        <Link href="/support">
                          {t("enterprise_cta")}
                          <ArrowRight className="ml-2 h-4 w-4" />
                        </Link>
                      </Button>
                    ) : tier.id === "clinic" ? (
                      <ClinicGetStartedButton locale={locale} tier={tier.id} />
                    ) : (
                      <Button
                        className="w-full rounded-full"
                        variant={isPopular ? "default" : "outline"}
                        asChild
                      >
                        <Link href={`/register-doctor?tier=${tier.id}`}>
                          {t("get_started")}
                        </Link>
                      </Button>
                    )}
                  </CardFooter>
                </Card>
              );
            })}
          </div>

          <p className="mt-8 text-center text-sm text-muted-foreground">
            {t("commission_note", { percent: PLATFORM_BOOKING_FEE_PERCENT })}
          </p>

          {/* Free Profile Note */}
          <p className="mt-6 text-center text-sm text-muted-foreground">
            {t("free_note_prefix")}{" "}
            <Link
              href="/register-doctor?tier=free"
              className="font-medium text-primary hover:underline"
            >
              {t("free_note_link")}
            </Link>{" "}
            {t("free_note_suffix")}
          </p>
        </div>
      </section>

      {/* Medical Testing Services */}
      <section className="px-4 pb-12 md:pb-20">
        <div className="container mx-auto max-w-5xl">
          <div className="text-center">
            <Badge className="mb-4 bg-primary/10 text-primary hover:bg-primary/15 border-primary/20">
              <FlaskConical className="mr-1.5 h-3 w-3" />
              {t("testing_badge")}
            </Badge>
            <h2 className="text-2xl font-bold md:text-3xl">
              {t("testing_title")}
            </h2>
            <p className="mx-auto mt-3 max-w-xl text-muted-foreground">
              {t("testing_subtitle")}
            </p>
          </div>

          <div className="mx-auto mt-8 max-w-lg">
            {/* Single unified testing card */}
            <Card className="relative border-sky-200 dark:border-sky-900">
              <CardContent className="p-6 md:p-8">
                <div className="flex flex-col items-center text-center">
                  <div className="rounded-2xl bg-sky-50 p-3 dark:bg-sky-950/30">
                    <FlaskConical className="h-7 w-7 text-sky-500" />
                  </div>
                  <h3 className="mt-4 text-lg font-bold">
                    {TESTING_STANDALONE_PLAN.name}
                  </h3>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {TESTING_STANDALONE_PLAN.description}
                  </p>
                </div>

                {/* Pricing options */}
                <div className="mt-6 grid gap-3 sm:grid-cols-2">
                  {/* Standalone price */}
                  <div className="rounded-xl border border-sky-200 bg-sky-50/50 p-4 text-center dark:border-sky-900 dark:bg-sky-950/20">
                    <span className="text-3xl font-bold">
                      {formatPriceForLocale(
                        TESTING_STANDALONE_PLAN.priceMonthlyPence,
                        locale
                      )}
                    </span>
                    <span className="text-muted-foreground"> {t("per_month")}</span>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {t("standalone")}
                    </p>
                  </div>

                  {/* Add-on price */}
                  {testingModule && (
                    <div className="relative rounded-xl border border-sky-400 bg-sky-50/50 p-4 text-center dark:border-sky-800 dark:bg-sky-950/20">
                      <Badge className="absolute -top-2.5 left-1/2 -translate-x-1/2 bg-sky-500 text-white shadow-sm hover:bg-sky-500">
                        {t("save_50")}
                      </Badge>
                      <span className="text-3xl font-bold">
                        {formatPriceForLocale(
                          testingModule.priceMonthlyPence,
                          locale
                        )}
                      </span>
                      <span className="text-muted-foreground"> {t("per_month")}</span>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {t("addon_note")}
                      </p>
                    </div>
                  )}
                </div>

                <p className="mt-3 text-center text-xs text-muted-foreground">
                  {t("commission_suffix", { percent: PLATFORM_BOOKING_FEE_PERCENT })}
                </p>

                {/* Features */}
                <ul className="mt-6 space-y-2.5">
                  {TESTING_STANDALONE_PLAN.features.map((feature) => (
                    <li
                      key={feature}
                      className="flex items-start gap-2 text-sm"
                    >
                      <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-sky-500" />
                      {feature}
                    </li>
                  ))}
                </ul>

                {/* CTAs */}
                <div className="mt-6 flex flex-col gap-3 sm:flex-row">
                  <Button
                    className="flex-1 rounded-full bg-sky-500 hover:bg-sky-600"
                    asChild
                  >
                    <Link href="/register-testing-service">
                      {t("register_testing")}
                    </Link>
                  </Button>
                  <Button
                    className="flex-1 rounded-full"
                    variant="outline"
                    asChild
                  >
                    <Link href="/register-doctor?tier=starter">
                      {t("register_doctor")} <ArrowRight className="ml-2 h-4 w-4" />
                    </Link>
                  </Button>
                </div>
                <p className="mt-3 text-center text-xs text-muted-foreground">
                  {t("already_doctor")}
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* Platform Features */}
      <section className="bg-muted/30 px-4 py-12 md:py-20">
        <div className="container mx-auto">
          <h2 className="text-center text-2xl font-bold md:text-3xl">
            {t("features_title")}
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-center text-muted-foreground">
            {t("features_subtitle")}
          </p>
          <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {platformFeatures.map((feature) => (
              <Card key={feature.key}>
                <CardContent className="p-5">
                  <div className={`rounded-xl ${feature.bg} p-2.5 w-fit`}>
                    <feature.icon className={`h-5 w-5 ${feature.text}`} />
                  </div>
                  <h3 className="mt-3 font-semibold">{t(`${feature.key}_title`)}</h3>
                  <p className="mt-1.5 text-sm text-muted-foreground">
                    {t(`${feature.key}_desc`)}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* How It Works for Doctors */}
      <section className="px-4 py-12 md:py-20">
        <div className="container mx-auto max-w-3xl">
          <h2 className="text-center text-2xl font-bold md:text-3xl">
            {t("steps_title")}
          </h2>
          <div className="mt-12 space-y-8">
            {gettingStartedSteps.map((item) => (
              <div key={item.step} className="flex gap-4">
                <div
                  className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl ${item.bg} ring-1 ${item.ring}`}
                >
                  <item.icon className={`h-6 w-6 ${item.text}`} />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className={`text-xs font-bold ${item.text}`}>
                      {t("step_label", { step: item.step })}
                    </span>
                  </div>
                  <h3 className="font-semibold">{t(`${item.key}_title`)}</h3>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {t(`${item.key}_desc`)}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="px-4 py-16 md:py-24">
        <div className="container mx-auto">
          <Card className="overflow-hidden border-0 bg-gradient-to-br from-primary via-primary/90 to-primary/80">
            <CardContent className="p-8 md:p-14 lg:p-16">
              <div className="mx-auto max-w-3xl text-center">
                <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-white/15 backdrop-blur-sm">
                  <Stethoscope className="h-7 w-7 text-white" />
                </div>
                <h2 className="mt-5 text-2xl font-bold text-white md:text-3xl">
                  {t("cta_title")}
                </h2>
                <p className="mx-auto mt-3 max-w-xl text-white/80">
                  {t("cta_subtitle")}
                </p>

                {/* USP Feature Grid */}
                <div className="mt-10 grid grid-cols-2 gap-3 md:grid-cols-3">
                  {uspFeatures.map((feature) => (
                    <div
                      key={feature.key}
                      className="flex items-start gap-3 rounded-xl bg-white/10 p-4 text-left backdrop-blur-sm transition-colors hover:bg-white/15"
                    >
                      <feature.icon
                        className="mt-0.5 h-5 w-5 shrink-0 text-white/90"
                      />
                      <div>
                        <p className="text-sm font-semibold text-white">
                          {t(`${feature.key}_title`)}
                        </p>
                        <p className="mt-0.5 text-xs leading-relaxed text-white/70">
                          {t(`${feature.key}_desc`)}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>

                <Button
                  size="lg"
                  className="mt-10 rounded-full bg-white text-primary font-semibold hover:bg-white/90"
                  asChild
                >
                  <Link href="/register-doctor?tier=professional">
                    {t("cta_join")} <ArrowRight className="ml-2 h-4 w-4" />
                  </Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </section>
    </>
  );
}
