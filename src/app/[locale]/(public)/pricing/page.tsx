import { Link } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
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
} from "lucide-react";
import { SUBSCRIPTION_PLANS } from "@/lib/constants/subscription-plans";
import { formatCurrency } from "@/lib/utils/currency";
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

/** Map locale to display currency */
function getDisplayCurrency(locale: string): string {
  switch (locale) {
    case "en":
      return "GBP";
    case "tr":
      return "TRY";
    default:
      return "EUR";
  }
}

/** Format price in the locale's currency, no decimals */
function formatPriceForLocale(cents: number, planCurrency: string, locale: string): string {
  const displayCurrency = getDisplayCurrency(locale);

  // If plan is in a different currency, we still show it in the plan's native currency
  // (doctor plans = EUR, testing = GBP). Convert when currencies differ.
  let displayCents = cents;
  let currency = planCurrency;

  if (planCurrency === "EUR" && displayCurrency === "GBP") {
    // Approximate EUR → GBP conversion for display
    displayCents = Math.round(cents * 0.86);
    currency = "GBP";
  } else if (planCurrency === "EUR" && displayCurrency === "TRY") {
    displayCents = Math.round(cents * 38);
    currency = "TRY";
  } else if (planCurrency === "GBP" && displayCurrency === "EUR") {
    displayCents = Math.round(cents * 1.16);
    currency = "EUR";
  } else if (planCurrency === "GBP" && displayCurrency === "TRY") {
    displayCents = Math.round(cents * 44);
    currency = "TRY";
  } else {
    currency = planCurrency;
  }

  return new Intl.NumberFormat(locale === "de" ? "de-DE" : locale === "fr" ? "fr-FR" : locale === "tr" ? "tr-TR" : "en-GB", {
    style: "currency",
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(displayCents / 100);
}

export default function PricingPage() {
  const locale = useLocale();
  const testingPlan = SUBSCRIPTION_PLANS.find((p) => p.id === "testing_service")!;

  return (
    <>
      {/* Hero */}
      <section className="bg-gradient-to-br from-primary/5 via-background to-primary/5 px-4 py-16 md:py-24">
        <div className="container mx-auto text-center">
          <Badge variant="secondary" className="mb-4">
            For Doctors
          </Badge>
          <h1 className="text-3xl font-bold tracking-tight md:text-5xl">
            Grow Your Practice with MyDoctors360
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-lg text-muted-foreground">
            Join our premium marketplace and reach patients across Europe. Simple pricing, powerful tools, no long-term contracts.
          </p>
        </div>
      </section>

      {/* Pricing Plans */}
      <section className="px-4 py-12 md:py-20">
        <div className="container mx-auto max-w-5xl">
          <div className="grid gap-6 md:grid-cols-3">
            {SUBSCRIPTION_PLANS.filter((plan) => plan.priceMonthly > 0 && plan.id !== "testing_service").map((plan) => {
              const isPopular = "popular" in plan && plan.popular;
              return (
                <Card
                  key={plan.id}
                  className={`relative flex flex-col ${
                    isPopular ? "border-primary shadow-lg scale-[1.02]" : ""
                  }`}
                >
                  {isPopular && (
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                      <Badge className="bg-primary text-primary-foreground">
                        Most Doctors start here
                      </Badge>
                    </div>
                  )}
                  <CardHeader className="pb-4 pt-6 text-center">
                    <h3 className="text-lg font-bold">{plan.name}</h3>
                    <p className="min-h-[2.5rem] text-sm text-muted-foreground">
                      {plan.description}
                    </p>
                    <div className="mt-4">
                      <span className="text-4xl font-bold">
                        {formatPriceForLocale(plan.priceMonthly, plan.currency, locale)}
                      </span>
                      <span className="text-muted-foreground"> / month</span>
                      <p className="mt-1.5 text-xs font-medium text-primary/70">
                        Introductory pricing
                      </p>
                    </div>
                  </CardHeader>
                  <Separator />
                  <CardContent className="flex flex-1 flex-col p-6">
                    <ul className="flex-1 space-y-3">
                      {plan.features.map((feature) => (
                        <li
                          key={feature}
                          className="flex items-start gap-2 text-sm"
                        >
                          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-green-600" />
                          {feature}
                        </li>
                      ))}
                    </ul>
                    <Button
                      className="mt-6 w-full rounded-full"
                      variant={isPopular ? "default" : "outline"}
                      asChild
                    >
                      <Link href="/register-doctor">
                        Get Started
                      </Link>
                    </Button>
                  </CardContent>
                </Card>
              );
            })}
          </div>

          <p className="mt-8 text-center text-sm text-muted-foreground">
            All plans include a 15% platform commission on each booking. Cancel anytime, no long-term contracts.
          </p>
          <p className="mt-2 text-center text-xs text-muted-foreground/70">
            These are introductory rates for early adopters. Lock in your price today — it stays the same for as long as you&apos;re subscribed.
          </p>

          {/* Free Profile Note */}
          <div className="mx-auto mt-10 max-w-xl rounded-xl border border-emerald-200 bg-emerald-50/50 px-6 py-5 text-center dark:border-emerald-900 dark:bg-emerald-950/20">
            <div className="flex items-center justify-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-emerald-600" />
              <h3 className="font-semibold text-emerald-900 dark:text-emerald-100">
                Free Doctor Profile
              </h3>
            </div>
            <p className="mx-auto mt-2 max-w-lg text-sm text-emerald-800/80 dark:text-emerald-200/70">
              Every doctor starts with a free listing in our directory. Add your details, get discovered by patients, and upgrade to Professional or Premium when you&apos;re ready.
            </p>
            <Button
              variant="link"
              className="mt-1 text-emerald-700 dark:text-emerald-400"
              asChild
            >
              <Link href="/register-doctor">
                Create your free profile <ArrowRight className="ml-1 h-3.5 w-3.5" />
              </Link>
            </Button>
          </div>
        </div>
      </section>

      {/* Medical Testing Services */}
      <section className="px-4 pb-12 md:pb-20">
        <div className="container mx-auto max-w-5xl">
          <div className="text-center">
            <Badge variant="secondary" className="mb-4">
              <FlaskConical className="mr-1.5 h-3 w-3" />
              For Testing Providers
            </Badge>
            <h2 className="text-2xl font-bold md:text-3xl">
              Medical Testing Services
            </h2>
            <p className="mx-auto mt-3 max-w-xl text-muted-foreground">
              For labs, clinics, and nurses offering diagnostic testing. List your services and accept bookings online.
            </p>
          </div>

          <Card className="mx-auto mt-8 max-w-2xl border-teal-200 dark:border-teal-900">
            <CardContent className="p-6 md:p-8">
              <div className="flex flex-col items-center gap-6 md:flex-row md:items-start">
                {/* Icon + Price */}
                <div className="flex flex-col items-center text-center md:w-1/3">
                  <div className="rounded-2xl bg-teal-50 p-3 dark:bg-teal-950/30">
                    <FlaskConical className="h-8 w-8 text-teal-600" />
                  </div>
                  <div className="mt-4">
                    <span className="text-3xl font-bold">
                      {formatPriceForLocale(testingPlan.priceMonthly, testingPlan.currency, locale)}
                    </span>
                    <span className="text-muted-foreground"> / month</span>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    + 15% platform commission
                  </p>
                </div>

                {/* Features + CTA */}
                <div className="flex-1">
                  <h3 className="text-lg font-semibold">{testingPlan.name}</h3>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {testingPlan.description}
                  </p>
                  <ul className="mt-4 space-y-2.5">
                    {testingPlan.features.map((feature) => (
                      <li
                        key={feature}
                        className="flex items-start gap-2 text-sm"
                      >
                        <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-teal-600" />
                        {feature}
                      </li>
                    ))}
                  </ul>
                  <Button
                    className="mt-6 rounded-full bg-teal-600 hover:bg-teal-700"
                    asChild
                  >
                    <Link href="/register-testing-service">
                      Register as Testing Service <ArrowRight className="ml-2 h-4 w-4" />
                    </Link>
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
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
                icon: Calendar,
                title: "Set Your Availability",
                desc: "Configure your weekly schedule, set appointment durations, and manage availability overrides.",
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
                <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl ${item.bg} ring-1 ${item.ring}`}>
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
          <Card className="overflow-hidden border-0 bg-gradient-to-br from-slate-900 via-blue-950 to-slate-900">
            <CardContent className="p-8 md:p-14 lg:p-16">
              <div className="mx-auto max-w-3xl text-center">
                <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-white/10 backdrop-blur-sm">
                  <Stethoscope className="h-7 w-7 text-teal-400" />
                </div>
                <h2 className="mt-5 text-2xl font-bold text-white md:text-3xl">
                  Ready to Grow Your Practice?
                </h2>
                <p className="mx-auto mt-3 max-w-xl text-white/70">
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
