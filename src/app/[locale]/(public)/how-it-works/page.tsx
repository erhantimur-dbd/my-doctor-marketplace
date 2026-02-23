import { Link } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Search,
  Calendar,
  Video,
  CreditCard,
  Shield,
  Star,
  Clock,
  Globe,
  ArrowRight,
  CheckCircle2,
  Stethoscope,
  Bell,
  MessageSquare,
} from "lucide-react";

const steps = [
  {
    step: "01",
    icon: Search,
    title: "Search & Discover",
    description:
      "Browse verified doctors by specialty, location, language, or price. Read real patient reviews and compare profiles to find the perfect match.",
    features: [
      "Filter by 24+ medical specialties",
      "Search across multiple European cities",
      "View transparent pricing upfront",
      "Read verified patient reviews",
    ],
  },
  {
    step: "02",
    icon: Calendar,
    title: "Book Instantly",
    description:
      "Choose a convenient time slot from the doctor's real-time availability calendar. Book in-person or video consultations with just a few clicks.",
    features: [
      "Real-time availability calendar",
      "In-person or video consultations",
      "Secure online payment via Stripe",
      "Instant booking confirmation",
    ],
  },
  {
    step: "03",
    icon: Bell,
    title: "Get Reminders",
    description:
      "Receive automatic reminders via email, SMS, or WhatsApp before your appointment so you never miss a visit.",
    features: [
      "24-hour advance email reminder",
      "1-hour SMS/WhatsApp reminder",
      "In-app notification center",
      "Calendar integration",
    ],
  },
  {
    step: "04",
    icon: Stethoscope,
    title: "Visit Your Doctor",
    description:
      "Attend your appointment at the doctor's clinic or join a secure video call from anywhere. Your health, your choice.",
    features: [
      "Premium clinic locations",
      "HD video consultations",
      "Secure & private sessions",
      "Follow-up booking option",
    ],
  },
];

const benefits = [
  {
    icon: Shield,
    title: "Verified Doctors",
    description: "Every doctor on our platform is credential-verified and licensed to practice in their country.",
  },
  {
    icon: CreditCard,
    title: "Transparent Pricing",
    description: "See consultation fees upfront. No hidden charges, no surprises. Pay securely online.",
  },
  {
    icon: Clock,
    title: "Instant Booking",
    description: "Book appointments 24/7 with real-time availability. No phone calls needed.",
  },
  {
    icon: Globe,
    title: "Cross-Border Care",
    description: "Access top specialists across Europe. Book in your language, pay in your currency.",
  },
  {
    icon: Star,
    title: "Patient Reviews",
    description: "Make informed decisions with honest reviews from verified patients.",
  },
  {
    icon: MessageSquare,
    title: "Smart Reminders",
    description: "Never miss an appointment with automatic email, SMS, and WhatsApp reminders.",
  },
];

export default function HowItWorksPage() {
  return (
    <>
      {/* Hero */}
      <section className="bg-gradient-to-br from-primary/5 via-background to-primary/5 px-4 py-16 md:py-24">
        <div className="container mx-auto text-center">
          <h1 className="text-3xl font-bold tracking-tight md:text-5xl">
            How MyDoctor Works
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-lg text-muted-foreground">
            Book appointments with top private specialists in just a few steps. Simple, transparent, and secure.
          </p>
        </div>
      </section>

      {/* Steps */}
      <section className="px-4 py-12 md:py-20">
        <div className="container mx-auto max-w-4xl">
          <div className="space-y-12">
            {steps.map((step, i) => (
              <div
                key={step.step}
                className={`flex flex-col gap-8 md:flex-row md:items-center ${
                  i % 2 === 1 ? "md:flex-row-reverse" : ""
                }`}
              >
                <div className="flex-1">
                  <div className="flex items-center gap-3">
                    <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-sm font-bold text-primary-foreground">
                      {step.step}
                    </span>
                    <h2 className="text-xl font-bold md:text-2xl">
                      {step.title}
                    </h2>
                  </div>
                  <p className="mt-3 text-muted-foreground">
                    {step.description}
                  </p>
                  <ul className="mt-4 space-y-2">
                    {step.features.map((feature) => (
                      <li key={feature} className="flex items-center gap-2 text-sm">
                        <CheckCircle2 className="h-4 w-4 shrink-0 text-green-600" />
                        {feature}
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="flex flex-1 items-center justify-center">
                  <div className="flex h-32 w-32 items-center justify-center rounded-3xl bg-primary/10 md:h-40 md:w-40">
                    <step.icon className="h-16 w-16 text-primary md:h-20 md:w-20" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Benefits */}
      <section className="bg-muted/30 px-4 py-12 md:py-20">
        <div className="container mx-auto">
          <h2 className="text-center text-2xl font-bold md:text-3xl">
            Why Choose MyDoctor
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-center text-muted-foreground">
            We make finding and booking the right doctor simple, safe, and transparent.
          </p>
          <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {benefits.map((benefit) => (
              <Card key={benefit.title}>
                <CardContent className="flex flex-col items-center p-6 text-center">
                  <div className="rounded-xl bg-primary/10 p-3">
                    <benefit.icon className="h-6 w-6 text-primary" />
                  </div>
                  <h3 className="mt-4 font-semibold">{benefit.title}</h3>
                  <p className="mt-2 text-sm text-muted-foreground">
                    {benefit.description}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="px-4 py-12 md:py-20">
        <div className="container mx-auto text-center">
          <h2 className="text-2xl font-bold md:text-3xl">
            Ready to Book Your First Appointment?
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-muted-foreground">
            Join thousands of patients who trust MyDoctor for their healthcare needs.
          </p>
          <div className="mt-8 flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
            <Button size="lg" className="rounded-full" asChild>
              <Link href="/doctors">
                Find a Doctor <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
            <Button size="lg" variant="outline" className="rounded-full" asChild>
              <Link href="/register">Create Free Account</Link>
            </Button>
          </div>
        </div>
      </section>
    </>
  );
}
