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
} from "lucide-react";
import { SUBSCRIPTION_PLANS } from "@/lib/constants/subscription-plans";

const platformFeatures = [
  {
    icon: Globe,
    title: "Multi-Country Visibility",
    description: "Reach patients across Germany, UK, Turkey, France, and more EU countries.",
  },
  {
    icon: Calendar,
    title: "Smart Scheduling",
    description: "Customizable availability calendar with recurring schedules and date overrides.",
  },
  {
    icon: CreditCard,
    title: "Secure Payments",
    description: "Automatic payment collection via Stripe. Patients pay upfront, you get paid out to your bank.",
  },
  {
    icon: Video,
    title: "Video Consultations",
    description: "Offer telemedicine appointments with built-in HD video calling.",
  },
  {
    icon: Bell,
    title: "Automated Reminders",
    description: "Reduce no-shows with automatic email, SMS, and WhatsApp appointment reminders.",
  },
  {
    icon: BarChart3,
    title: "Revenue Analytics",
    description: "Track your earnings, booking trends, and patient demographics in real-time.",
  },
  {
    icon: Users,
    title: "Patient CRM",
    description: "Manage patient records, visit history, and notes in one place.",
  },
  {
    icon: Shield,
    title: "Verification Badge",
    description: "Get a verified badge on your profile after our credential verification process.",
  },
];

function formatPrice(cents: number): string {
  return new Intl.NumberFormat("en-EU", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(cents / 100);
}

export default function PricingPage() {
  return (
    <>
      {/* Hero */}
      <section className="bg-gradient-to-br from-primary/5 via-background to-primary/5 px-4 py-16 md:py-24">
        <div className="container mx-auto text-center">
          <Badge variant="secondary" className="mb-4">
            For Doctors
          </Badge>
          <h1 className="text-3xl font-bold tracking-tight md:text-5xl">
            Grow Your Practice with MyDoctor
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
            {SUBSCRIPTION_PLANS.map((plan) => {
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
                        Most Popular
                      </Badge>
                    </div>
                  )}
                  <CardHeader className="pb-4 pt-6 text-center">
                    <h3 className="text-lg font-bold">{plan.name}</h3>
                    <p className="text-sm text-muted-foreground">
                      {plan.description}
                    </p>
                    <div className="mt-4">
                      <span className="text-4xl font-bold">
                        {formatPrice(plan.priceMonthly)}
                      </span>
                      <span className="text-muted-foreground"> / month</span>
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
                  <div className="rounded-xl bg-primary/10 p-2.5 w-fit">
                    <feature.icon className="h-5 w-5 text-primary" />
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
              },
              {
                step: "2",
                icon: Shield,
                title: "Get Verified",
                desc: "Upload your medical license and certifications. Our team reviews and verifies within 24-48 hours.",
              },
              {
                step: "3",
                icon: Calendar,
                title: "Set Your Availability",
                desc: "Configure your weekly schedule, set appointment durations, and manage availability overrides.",
              },
              {
                step: "4",
                icon: Zap,
                title: "Start Receiving Patients",
                desc: "Your profile goes live and patients can discover, book, and pay for appointments instantly.",
              },
            ].map((item) => (
              <div key={item.step} className="flex gap-4">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-bold text-primary-foreground">
                  {item.step}
                </div>
                <div>
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
      <section className="bg-gradient-to-br from-primary to-primary/80 px-4 py-12 md:py-20">
        <div className="container mx-auto text-center text-primary-foreground">
          <h2 className="text-2xl font-bold md:text-3xl">
            Ready to Grow Your Practice?
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-primary-foreground/80">
            Join hundreds of doctors already using MyDoctor to reach new patients and streamline their practice.
          </p>
          <Button
            size="lg"
            variant="secondary"
            className="mt-8 rounded-full"
            asChild
          >
            <Link href="/register-doctor">
              Join as a Doctor <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          </Button>
        </div>
      </section>
    </>
  );
}
