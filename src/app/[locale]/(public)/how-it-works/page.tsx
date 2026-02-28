import { Link } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
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
} from "lucide-react";

const benefits = [
  {
    icon: Shield,
    title: "Verified Doctors",
    description: "Every doctor on our platform is credential-verified and licensed to practice in their country.",
    color: { bg: "bg-emerald-50", text: "text-emerald-600" },
  },
  {
    icon: CreditCard,
    title: "Transparent Pricing",
    description: "See consultation fees upfront. No hidden charges, no surprises. Pay securely online.",
    color: { bg: "bg-blue-50", text: "text-blue-600" },
  },
  {
    icon: Clock,
    title: "Instant Booking",
    description: "Book appointments 24/7 with real-time availability. No phone calls needed.",
    color: { bg: "bg-amber-50", text: "text-amber-600" },
  },
  {
    icon: Globe,
    title: "Cross-Border Care",
    description: "Access top specialists across Europe. Book in your language, pay in your currency.",
    color: { bg: "bg-teal-50", text: "text-teal-600" },
  },
  {
    icon: Star,
    title: "Patient Reviews",
    description: "Make informed decisions with honest reviews from verified patients.",
    color: { bg: "bg-yellow-50", text: "text-yellow-600" },
  },
  {
    icon: MessageSquare,
    title: "Smart Reminders",
    description: "Never miss an appointment with automatic email, SMS, and WhatsApp reminders.",
    color: { bg: "bg-violet-50", text: "text-violet-600" },
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
          <div className="mt-5 inline-flex items-center gap-2 rounded-full bg-emerald-50 px-4 py-2 text-sm font-medium text-emerald-700">
            <CheckCircle2 className="h-4 w-4" />
            Free to sign up &mdash; No subscription required for patients or doctors
          </div>
        </div>
      </section>

      {/* Interactive Step Animation */}
      <section className="px-4 py-12 md:py-16">
        <div className="container mx-auto">
          <StepAnimation />
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
                  <div className={`rounded-xl ${benefit.color.bg} p-3`}>
                    <benefit.icon className={`h-6 w-6 ${benefit.color.text}`} />
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
          <p className="mt-4 text-sm text-muted-foreground">
            Free for patients and doctors. No credit card required.
          </p>
          <div className="mt-6 flex items-center justify-center gap-2 text-sm text-muted-foreground">
            <Stethoscope className="h-4 w-4" />
            <span>Are you a doctor?</span>
            <Link
              href="/register-doctor"
              className="inline-flex items-center gap-1 font-medium text-primary hover:underline"
            >
              Join as a Doctor <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}
