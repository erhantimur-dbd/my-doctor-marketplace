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

const BENEFITS = [
  {
    icon: Award,
    title: "Enhance your reputation",
    description: "Your expertise, backed by verified patients and trusted colleagues.",
  },
  {
    icon: TrendingUp,
    title: "Grow your practice",
    description: "Harness trust to drive visibility, enquiries and sustainable growth.",
  },
  {
    icon: Target,
    title: "Reach target patients",
    description: "Reach target patients with treatment tags.",
  },
  {
    icon: MessageSquareHeart,
    title: "Improve patient experience",
    description: "Get actionable insights from review analytics.",
  },
  {
    icon: Globe2,
    title: "Build your professional network",
    description: "Network and collaborate with MyDoctors360 Connect.",
  },
];
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
import { useLocale } from "next-intl";

const platformFeatures = [
  {
    icon: Globe,
    title: "Multi-Country Visibility",
    description: "Reach patients across Germany, UK, Turkey, France, and more EU countries.",
    bg: "bg-blue-50 dark:bg-blue-950/30",
    text: "text-blue-600",
  },
  {
    icon: Calendar,
    title: "Smart Scheduling",
    description: "Customizable availability calendar with recurring schedules and date overrides.",
    bg: "bg-violet-50 dark:bg-violet-950/30",
    text: "text-violet-600",
  },
  {
    icon: CreditCard,
    title: "Secure Payments",
    description: "Automatic payment collection via Stripe. Patients pay upfront, you get paid out to your bank.",
    bg: "bg-emerald-50 dark:bg-emerald-950/30",
    text: "text-emerald-600",
  },
  {
    icon: Video,
    title: "Video Consultations",
    description: "Offer telemedicine appointments with built-in HD video calling.",
    bg: "bg-purple-50 dark:bg-purple-950/30",
    text: "text-purple-600",
  },
  {
    icon: Bell,
    title: "Automated Reminders",
    description: "Reduce no-shows with automatic email, SMS, and WhatsApp appointment reminders.",
    bg: "bg-amber-50 dark:bg-amber-950/30",
    text: "text-amber-600",
  },
  {
    icon: BarChart3,
    title: "Revenue Analytics",
    description: "Track your earnings, booking trends, and patient demographics in real-time.",
    bg: "bg-cyan-50 dark:bg-cyan-950/30",
    text: "text-cyan-600",
  },
  {
    icon: Users,
    title: "Patient CRM",
    description: "Manage patient records, visit history, and notes in one place.",
    bg: "bg-rose-50 dark:bg-rose-950/30",
    text: "text-rose-600",
  },
  {
    icon: Shield,
    title: "Verification Badge",
    description: "Get a verified badge on your profile after our credential verification process.",
    bg: "bg-teal-50 dark:bg-teal-950/30",
    text: "text-teal-600",
  },
];

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

export default function PricingPage() {
  const locale = useLocale();

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
            For Doctors &amp; Clinics
          </Badge>
          <h1 className="text-3xl font-bold tracking-tight md:text-5xl">
            Grow Your Practice with MyDoctors360
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-lg text-muted-foreground">
            Join our premium marketplace and reach patients across Europe.
            Simple pricing, powerful tools, 12-month commitment billed monthly.
          </p>
        </div>
      </section>

      {/* Benefits */}
      <section className="border-b bg-background px-4 py-12 md:py-16">
        <div className="container mx-auto max-w-6xl">
          <div className="mx-auto max-w-3xl text-center">
            <h2 className="text-2xl font-bold tracking-tight md:text-3xl">
              Build trust, grow your practice
            </h2>
            <p className="mt-3 text-muted-foreground">
              Strengthen your online presence with a comprehensive profile, verified reviews and professional connections that drive practice growth.
            </p>
          </div>
          <div className="mt-10 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
            {BENEFITS.map((benefit) => {
              const Icon = benefit.icon;
              return (
                <div
                  key={benefit.title}
                  className="flex flex-col rounded-xl border bg-card p-5 shadow-sm transition-shadow hover:shadow-md"
                >
                  <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <Icon className="h-5 w-5" />
                  </div>
                  <h3 className="text-base font-semibold leading-tight">{benefit.title}</h3>
                  <p className="mt-2 text-sm text-muted-foreground">{benefit.description}</p>
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
                        Most Popular
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
                        <span className="text-4xl font-bold">Custom</span>
                      </>
                    ) : (
                      <>
                        <div>
                          <span className="text-4xl font-bold">
                            {formatPriceForLocale(tier.priceMonthlyPence, locale)}
                          </span>
                          <span className="text-muted-foreground">
                            {tier.perUser ? " / user / mo" : " / month"}
                          </span>
                        </div>
                      </>
                    )}
                  </div>

                  {/* ── Fixed-height meta: commitment + seat info ── */}
                  <div className="flex h-[48px] flex-col items-center justify-center px-6 text-center">
                    {isEnterprise ? (
                      <p className="text-xs text-muted-foreground">
                        Tailored to your needs
                      </p>
                    ) : (
                      <>
                        {tier.commitmentMonths > 0 && (
                          <p className="text-xs text-muted-foreground">
                            12-month commitment, billed monthly
                          </p>
                        )}
                        <p className="text-xs text-muted-foreground">
                          {tier.perUser
                            ? `${tier.defaultSeats}–${tier.maxSeats} users`
                            : tier.includedSeats > 1
                              ? `${tier.includedSeats} users included, up to ${tier.maxSeats}`
                              : `${tier.defaultSeats} user`}
                          {tier.extraSeatPricePence > 0 && !tier.perUser && (
                            <>
                              {" · "}
                              {formatPriceForLocale(tier.extraSeatPricePence, locale)}/extra seat
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
                          Get in Touch for a Demo
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
                          Get Started
                        </Link>
                      </Button>
                    )}
                  </CardFooter>
                </Card>
              );
            })}
          </div>

          <p className="mt-8 text-center text-sm text-muted-foreground">
            All plans include a {PLATFORM_BOOKING_FEE_PERCENT}% platform commission on each booking, invoiced monthly.
            All paid plans require a 12-month commitment, billed monthly.
          </p>

          {/* Free Profile Note */}
          <p className="mt-6 text-center text-sm text-muted-foreground">
            Not ready to commit?{" "}
            <Link
              href="/register-doctor?tier=free"
              className="font-medium text-primary hover:underline"
            >
              Create a free doctor profile
            </Link>{" "}
            — a basic listing to get started.
          </p>
        </div>
      </section>

      {/* Medical Testing Services */}
      <section className="px-4 pb-12 md:pb-20">
        <div className="container mx-auto max-w-5xl">
          <div className="text-center">
            <Badge className="mb-4 bg-primary/10 text-primary hover:bg-primary/15 border-primary/20">
              <FlaskConical className="mr-1.5 h-3 w-3" />
              Medical Testing
            </Badge>
            <h2 className="text-2xl font-bold md:text-3xl">
              Medical Testing Services
            </h2>
            <p className="mx-auto mt-3 max-w-xl text-muted-foreground">
              List in-person diagnostic services and set your own prices.
              Choose the plan that fits your practice.
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
                    <span className="text-muted-foreground"> / month</span>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Standalone
                    </p>
                  </div>

                  {/* Add-on price */}
                  {testingModule && (
                    <div className="relative rounded-xl border border-sky-400 bg-sky-50/50 p-4 text-center dark:border-sky-800 dark:bg-sky-950/20">
                      <Badge className="absolute -top-2.5 left-1/2 -translate-x-1/2 bg-sky-500 text-white shadow-sm hover:bg-sky-500">
                        Save 50%
                      </Badge>
                      <span className="text-3xl font-bold">
                        {formatPriceForLocale(
                          testingModule.priceMonthlyPence,
                          locale
                        )}
                      </span>
                      <span className="text-muted-foreground"> / month</span>
                      <p className="mt-1 text-xs text-muted-foreground">
                        Add-on for Starter or Professional
                      </p>
                    </div>
                  )}
                </div>

                <p className="mt-3 text-center text-xs text-muted-foreground">
                  + {PLATFORM_BOOKING_FEE_PERCENT}% platform commission
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
                      Register as Testing Service
                    </Link>
                  </Button>
                  <Button
                    className="flex-1 rounded-full"
                    variant="outline"
                    asChild
                  >
                    <Link href="/register-doctor?tier=starter">
                      Register as Doctor <ArrowRight className="ml-2 h-4 w-4" />
                    </Link>
                  </Button>
                </div>
                <p className="mt-3 text-center text-xs text-muted-foreground">
                  Already a doctor? Add from your billing dashboard.
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
            Everything You Need to Run Your Practice
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-center text-muted-foreground">
            Our platform gives you the tools to attract patients, manage bookings, and grow your revenue.
          </p>
          <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {platformFeatures.map((feature) => (
              <Card key={feature.title}>
                <CardContent className="p-5">
                  <div className={`rounded-xl ${feature.bg} p-2.5 w-fit`}>
                    <feature.icon className={`h-5 w-5 ${feature.text}`} />
                  </div>
                  <h3 className="mt-3 font-semibold">{feature.title}</h3>
                  <p className="mt-1.5 text-sm text-muted-foreground">
                    {feature.description}
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
            Getting Started is Easy
          </h2>
          <div className="mt-12 space-y-8">
            {[
              {
                step: "1",
                icon: Stethoscope,
                title: "Create Your Profile",
                desc: "Sign up and complete your doctor profile with credentials, specialties, and consultation fees.",
                bg: "bg-teal-50 dark:bg-teal-950/30",
                text: "text-teal-600",
                ring: "ring-teal-200 dark:ring-teal-800",
              },
              {
                step: "2",
                icon: Shield,
                title: "Get Verified",
                desc: "Upload your medical license and certifications. Our team reviews and verifies within 24-48 hours.",
                bg: "bg-blue-50 dark:bg-blue-950/30",
                text: "text-blue-600",
                ring: "ring-blue-200 dark:ring-blue-800",
              },
              {
                step: "3",
                icon: CreditCard,
                title: "Choose Your Plan",
                desc: "Select a plan that fits your practice. All paid plans include a 12-month commitment billed monthly.",
                bg: "bg-violet-50 dark:bg-violet-950/30",
                text: "text-violet-600",
                ring: "ring-violet-200 dark:ring-violet-800",
              },
              {
                step: "4",
                icon: Zap,
                title: "Start Receiving Patients",
                desc: "Your profile goes live and patients can discover, book, and pay for appointments instantly.",
                bg: "bg-amber-50 dark:bg-amber-950/30",
                text: "text-amber-600",
                ring: "ring-amber-200 dark:ring-amber-800",
              },
            ].map((item) => (
              <div key={item.step} className="flex gap-4">
                <div
                  className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl ${item.bg} ring-1 ${item.ring}`}
                >
                  <item.icon className={`h-6 w-6 ${item.text}`} />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className={`text-xs font-bold ${item.text}`}>
                      Step {item.step}
                    </span>
                  </div>
                  <h3 className="font-semibold">{item.title}</h3>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {item.desc}
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
                  Ready to Grow Your Practice?
                </h2>
                <p className="mx-auto mt-3 max-w-xl text-white/80">
                  Join hundreds of doctors already using MyDoctors360 to reach new
                  patients and streamline their practice.
                </p>

                {/* USP Feature Grid */}
                <div className="mt-10 grid grid-cols-2 gap-3 md:grid-cols-3">
                  {[
                    {
                      icon: Calendar,
                      title: "Smart Booking",
                      desc: "Real-time calendar with instant patient booking",
                    },
                    {
                      icon: Bell,
                      title: "Auto Reminders",
                      desc: "Reduce no-shows with email, SMS & WhatsApp",
                    },
                    {
                      icon: BarChart3,
                      title: "Revenue Analytics",
                      desc: "Track earnings, bookings & growth metrics",
                    },
                    {
                      icon: Shield,
                      title: "Verified Profile",
                      desc: "Build trust with a credential-verified badge",
                    },
                    {
                      icon: CreditCard,
                      title: "Secure Payments",
                      desc: "Stripe-powered payouts directly to your bank",
                    },
                    {
                      icon: Globe,
                      title: "Multi-Language",
                      desc: "Reach patients across Europe in 4 languages",
                    },
                  ].map((feature) => (
                    <div
                      key={feature.title}
                      className="flex items-start gap-3 rounded-xl bg-white/10 p-4 text-left backdrop-blur-sm transition-colors hover:bg-white/15"
                    >
                      <feature.icon
                        className="mt-0.5 h-5 w-5 shrink-0 text-white/90"
                      />
                      <div>
                        <p className="text-sm font-semibold text-white">
                          {feature.title}
                        </p>
                        <p className="mt-0.5 text-xs leading-relaxed text-white/70">
                          {feature.desc}
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
                    Join as a Doctor <ArrowRight className="ml-2 h-4 w-4" />
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
