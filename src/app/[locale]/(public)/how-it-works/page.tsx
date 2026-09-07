import { Link } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  ArrowRight,
  BadgeCheck,
  Calendar,
  CheckCircle2,
  CreditCard,
  Lock,
  Shield,
  Stethoscope,
  UserPlus,
  Zap,
} from "lucide-react";
import { HeroSpecialtyIcons } from "@/components/shared/hero-specialty-icons";
import { FOUNDING_REGISTER_HREF } from "@/lib/constants/company";

const steps = [
  {
    step: "1",
    icon: UserPlus,
    title: "Register on Founding Free",
    desc: "Create your doctor account — no card required. Tell us your specialty, qualifications and where you practise.",
    bg: "bg-teal-50 dark:bg-teal-950/30",
    text: "text-teal-600",
    ring: "ring-teal-200 dark:ring-teal-800",
  },
  {
    step: "2",
    icon: Stethoscope,
    title: "Build your profile",
    desc: "Add credentials, fees, hours and consultation types in your dashboard — all before we open to patients.",
    bg: "bg-blue-50 dark:bg-blue-950/30",
    text: "text-blue-600",
    ring: "ring-blue-200 dark:ring-blue-800",
  },
  {
    step: "3",
    icon: Shield,
    title: "Get verified",
    desc: "Upload your medical licence and certifications. Our team reviews credentials before any profile goes live.",
    bg: "bg-violet-50 dark:bg-violet-950/30",
    text: "text-violet-600",
    ring: "ring-violet-200 dark:ring-violet-800",
  },
  {
    step: "4",
    icon: Zap,
    title: "Go live with us",
    desc: "When we launch to patients, founding doctors go live with priority placement and founding-tier benefits.",
    bg: "bg-amber-50 dark:bg-amber-950/30",
    text: "text-amber-600",
    ring: "ring-amber-200 dark:ring-amber-800",
  },
];

const benefits = [
  {
    icon: Calendar,
    title: "Own your schedule",
    description:
      "Set hours, fees and consultation types now. Your calendar is ready on day one.",
    color: { bg: "bg-blue-50", text: "text-blue-600" },
  },
  {
    icon: CreditCard,
    title: "Transparent pricing",
    description:
      "Founding Free is £0. Starter £199, Professional £299, Clinic £897 — upgrade when you are ready.",
    color: { bg: "bg-emerald-50", text: "text-emerald-600" },
  },
  {
    icon: Shield,
    title: "Verified profiles",
    description:
      "Credential checks before go-live. Patients will see a verified badge — not a live directory today.",
    color: { bg: "bg-teal-50", text: "text-teal-600" },
  },
];

const faqs = [
  {
    question: "Can I sign up before patient launch?",
    answer:
      "Yes. Register today on Founding Free, complete your profile and configure availability. Patient booking is not open yet.",
  },
  {
    question: "What does Founding Free include?",
    answer:
      "A verified public listing and doctor dashboard after credential review. Online bookings, video, AI insights and multi-channel reminders unlock on paid plans.",
  },
  {
    question: "What is on Professional?",
    answer:
      "Everything in Starter plus SMS & WhatsApp reminders, advanced analytics, patient CRM, waitlist auto-notify and priority support. One doctor seat — multi-doctor practices use Clinic.",
  },
  {
    question: "Is MyDoctors360 a care provider?",
    answer:
      "No. MyDoctors360 is a marketplace platform, not a care provider. We do not provide medical advice, diagnosis, treatment or prescriptions.",
  },
];

export default function HowItWorksPage() {
  return (
    <>
      <section className="relative bg-gradient-to-br from-primary/5 via-background to-primary/5 px-4 py-16 md:py-24">
        <HeroSpecialtyIcons />
        <div className="relative container mx-auto text-center">
          <h1 className="text-3xl font-bold tracking-tight md:text-5xl">
            How the Founding Doctor Programme works
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-lg text-muted-foreground">
            Register, build your profile, and go live with us. Patient booking
            opens at public launch — this page is for founding doctors.
          </p>
          <div className="mt-5 hidden items-center gap-2 rounded-full bg-primary/10 px-4 py-2 text-sm font-medium text-primary md:inline-flex">
            <CheckCircle2 className="h-4 w-4" />
            First 100 founding doctors — Founding Free, no card required
          </div>
        </div>
      </section>

      <section className="px-4 py-12 md:py-20">
        <div className="container mx-auto max-w-3xl">
          <h2 className="text-center text-2xl font-bold md:text-3xl">
            Four steps to get set up
          </h2>
          <div className="mt-12 space-y-8">
            {steps.map((item) => (
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

      <section className="bg-muted/30 px-4 py-12 md:py-20">
        <div className="container mx-auto">
          <h2 className="text-center text-2xl font-bold md:text-3xl">
            Why doctors are joining
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-center text-muted-foreground">
            Less admin later. A ready profile on day one.
          </p>
          <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {benefits.map((benefit) => (
              <Card key={benefit.title}>
                <CardContent className="flex flex-col items-center p-6 text-center">
                  <div className={`rounded-xl ${benefit.color.bg} p-3`}>
                    <benefit.icon
                      className={`h-6 w-6 ${benefit.color.text}`}
                    />
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

      <section className="px-4 py-12 md:py-20">
        <div className="container mx-auto">
          <h2 className="text-center text-2xl font-bold md:text-3xl">
            Frequently asked questions
          </h2>
          <div className="mx-auto mt-12 max-w-3xl">
            <Accordion type="single" collapsible className="w-full">
              {faqs.map((faq, i) => (
                <AccordionItem key={i} value={`faq-${i}`}>
                  <AccordionTrigger className="text-left text-[15px] font-medium">
                    {faq.question}
                  </AccordionTrigger>
                  <AccordionContent className="text-sm text-muted-foreground leading-relaxed">
                    {faq.answer}
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </div>
        </div>
      </section>

      <section className="border-y bg-muted/20 px-4 py-8">
        <div className="container mx-auto">
          <div className="flex flex-wrap items-center justify-center gap-x-10 gap-y-4 text-sm text-muted-foreground">
            <div className="flex items-center gap-2">
              <Lock className="h-4 w-4 text-green-600" />
              <span>Marketplace platform — not a care provider</span>
            </div>
            <div className="flex items-center gap-2">
              <Shield className="h-4 w-4 text-blue-600" />
              <span>GDPR Compliant</span>
            </div>
            <div className="flex items-center gap-2">
              <BadgeCheck className="h-4 w-4 text-emerald-600" />
              <span>Credential verification before go-live</span>
            </div>
          </div>
        </div>
      </section>

      <section className="bg-muted/30 px-4 py-12 md:py-20">
        <div className="container mx-auto text-center">
          <h2 className="text-2xl font-bold md:text-3xl">
            Join the Founding Doctor Programme
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-muted-foreground">
            Register, build your profile, go live with us.
          </p>
          <div className="mt-8 flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
            <Button size="lg" className="rounded-full" asChild>
              <Link href={FOUNDING_REGISTER_HREF}>
                Claim My Founding Spot <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
            <Button
              size="lg"
              variant="outline"
              className="rounded-full"
              asChild
            >
              <Link href="/pricing">See plans</Link>
            </Button>
          </div>
          <p className="mt-4 text-sm text-muted-foreground">
            First 100 founding doctors. Founding Free is free forever — no
            credit card required.
          </p>
        </div>
      </section>
    </>
  );
}
