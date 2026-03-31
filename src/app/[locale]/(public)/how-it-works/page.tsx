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
    title: "Verified Doctors",
    description:
      "Every doctor on our platform is credential-verified and licensed to practice in their country.",
    color: { bg: "bg-emerald-50", text: "text-emerald-600" },
  },
  {
    icon: CreditCard,
    title: "Transparent Pricing",
    description:
      "See consultation fees upfront. No hidden charges, no surprises. Pay securely online.",
    color: { bg: "bg-blue-50", text: "text-blue-600" },
  },
  {
    icon: Clock,
    title: "Instant Booking",
    description:
      "Book appointments 24/7 with real-time availability. No phone calls needed.",
    color: { bg: "bg-amber-50", text: "text-amber-600" },
  },
  {
    icon: Globe,
    title: "Cross-Border Care",
    description:
      "Access top specialists across Europe. Book in your language, pay in your currency.",
    color: { bg: "bg-teal-50", text: "text-teal-600" },
  },
  {
    icon: Star,
    title: "Patient Reviews",
    description:
      "Make informed decisions with honest reviews from verified patients.",
    color: { bg: "bg-yellow-50", text: "text-yellow-600" },
  },
  {
    icon: MessageSquare,
    title: "Smart Reminders",
    description:
      "Never miss an appointment with automatic email, SMS, and WhatsApp reminders.",
    color: { bg: "bg-violet-50", text: "text-violet-600" },
  },
];

const bookingTypes = [
  {
    icon: Video,
    title: "Video Consultations",
    description: "See a doctor from home via secure HD video call",
    color: "bg-blue-50 text-blue-600",
  },
  {
    icon: MapPin,
    title: "In-Person Visits",
    description: "Book face-to-face appointments at clinics near you",
    color: "bg-emerald-50 text-emerald-600",
  },
  {
    icon: CalendarCheck,
    title: "Same-Day Appointments",
    description: "Need to be seen urgently? Many doctors offer same-day slots",
    color: "bg-amber-50 text-amber-600",
  },
  {
    icon: Stethoscope,
    title: "Specialist Referrals",
    description: "Access 24+ specialties from cardiology to dermatology",
    color: "bg-purple-50 text-purple-600",
  },
  {
    icon: Microscope,
    title: "Health Screenings",
    description: "Blood tests, scans, and diagnostic checks without the wait",
    color: "bg-teal-50 text-teal-600",
  },
  {
    icon: HeartPulse,
    title: "Mental Health Support",
    description: "Psychiatrists, psychologists, and therapists available privately",
    color: "bg-rose-50 text-rose-600",
  },
];

const testimonials = [
  {
    quote:
      "I booked a same-day GP appointment and was seen within the hour. The whole process took minutes \u2014 I was back with the children before lunch.",
    name: "Mary T.",
    location: "Islington, London",
  },
  {
    quote:
      "My GP said I\u2019d be waiting weeks for an ultrasound. I went private through MyDoctors360 and had it booked within days. The relief was worth every penny.",
    name: "Colin A.",
    location: "Surrey",
  },
  {
    quote:
      "I\u2019d been putting off seeing a dentist for years. MyDoctors360 let me find someone highly rated for nervous patients and book without a phone call.",
    name: "James R.",
    location: "Edinburgh",
  },
];

const faqs = [
  {
    question: "Do I need a GP referral to book?",
    answer:
      "No. You can book directly with any specialist on MyDoctors360 without a referral. Some patients choose to get a referral from their NHS GP first, but it is not required for private consultations.",
  },
  {
    question: "How much does a private consultation cost?",
    answer:
      "Consultation fees vary by specialist and are shown upfront on every doctor\u2019s profile before you book. Initial consultations typically range from \u00a3100 to \u00a3300. There are no hidden fees or surprise charges.",
  },
  {
    question: "Can I book an appointment for a family member?",
    answer:
      "Yes. You can book appointments for family members through your account. Simply add them via the Family section in your dashboard and book on their behalf.",
  },
  {
    question: "What happens if I need to cancel or reschedule?",
    answer:
      "You can cancel or reschedule through your dashboard. Each doctor sets their own cancellation policy, which is displayed when you book. Most offer free cancellation up to 24 hours before the appointment.",
  },
  {
    question: "Is my payment secure?",
    answer:
      "Absolutely. All payments are processed through Stripe, which uses bank-level encryption. We never store your card details. You can also pay via Apple Pay or Google Pay.",
  },
  {
    question: "Can I see a doctor via video call?",
    answer:
      "Yes. Many doctors on MyDoctors360 offer video consultations. Look for the \u201cVideo\u201d badge on their profile. Video calls are conducted through our secure, built-in platform \u2014 no app download needed.",
  },
  {
    question: "Will the doctor have access to my NHS records?",
    answer:
      "Private doctors do not automatically have access to your NHS records. However, you can share any relevant documents, test results, or letters during your consultation. Many patients bring a summary from their GP.",
  },
  {
    question: "How quickly can I get an appointment?",
    answer:
      "Many specialists offer appointments within days, and some GPs have same-day availability. You can filter by \u201cEarliest Available\u201d when searching to find the fastest option.",
  },
];

export default async function HowItWorksPage() {
  // Fetch latest 3 blog posts for the blog preview section
  const { posts: latestPosts } = await getPublishedPosts("en", 1, 3);

  return (
    <>
      {/* Hero */}
      <section className="relative bg-gradient-to-br from-primary/5 via-background to-primary/5 px-4 py-16 md:py-24">
        <HeroSpecialtyIcons />
        <div className="relative container mx-auto text-center">
          <h1 className="text-3xl font-bold tracking-tight md:text-5xl">
            How MyDoctors360 Works
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-lg text-muted-foreground">
            Book appointments with top private specialists in just a few steps.
            Simple, transparent, and secure.
          </p>
          <div className="mt-5 hidden items-center gap-2 rounded-full bg-primary/10 px-4 py-2 text-sm font-medium text-primary md:inline-flex">
            <CheckCircle2 className="h-4 w-4" />
            Free to sign up &mdash; No subscription required for patients or
            doctors
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
            What Can You Book?
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-center text-muted-foreground">
            From a quick GP consultation to specialist diagnostics, everything
            is available in a few clicks.
          </p>
          <div className="mx-auto mt-12 grid max-w-5xl gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {bookingTypes.map((type) => (
              <div
                key={type.title}
                className="flex items-start gap-4 rounded-xl border bg-background p-5 transition-shadow hover:shadow-md"
              >
                <div className={`shrink-0 rounded-lg p-2.5 ${type.color}`}>
                  <type.icon className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="font-semibold">{type.title}</h3>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {type.description}
                  </p>
                </div>
              </div>
            ))}
          </div>
          <div className="mt-8 text-center">
            <Button variant="ghost" asChild>
              <Link href="/specialties" className="gap-1">
                Browse All Specialties <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
          </div>
        </div>
      </section>

      {/* Benefits */}
      <section className="px-4 py-12 md:py-20">
        <div className="container mx-auto">
          <h2 className="text-center text-2xl font-bold md:text-3xl">
            Why Choose MyDoctors360
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-center text-muted-foreground">
            We make finding and booking the right doctor simple, safe, and
            transparent.
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

      {/* Testimonials */}
      <section className="bg-muted/30 px-4 py-12 md:py-20">
        <div className="container mx-auto">
          <h2 className="text-center text-2xl font-bold md:text-3xl">
            Trusted by Patients Across the UK
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-center text-muted-foreground">
            Real feedback from patients who took control of their healthcare.
          </p>
          <div className="mx-auto mt-12 grid max-w-5xl gap-6 md:grid-cols-3">
            {testimonials.map((t) => (
              <div key={t.name} className="flex flex-col">
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
                    &ldquo;{t.quote}&rdquo;
                  </p>
                  <div className="absolute -bottom-2.5 left-8 h-5 w-5 rotate-45 border-b border-r bg-background" />
                </div>
                <div className="mt-4 pl-2">
                  <p className="text-sm font-semibold">{t.name}</p>
                  <p className="text-xs text-muted-foreground">{t.location}</p>
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
            Frequently Asked Questions
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-center text-muted-foreground">
            Everything you need to know before booking your first appointment.
          </p>
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

      {/* Trust & Security Bar */}
      <section className="border-y bg-muted/20 px-4 py-8">
        <div className="container mx-auto">
          <div className="flex flex-wrap items-center justify-center gap-x-10 gap-y-4 text-sm text-muted-foreground">
            <div className="flex items-center gap-2">
              <Lock className="h-4 w-4 text-green-600" />
              <span>Stripe Secure Payments</span>
            </div>
            <div className="flex items-center gap-2">
              <Shield className="h-4 w-4 text-blue-600" />
              <span>GDPR Compliant</span>
            </div>
            <div className="flex items-center gap-2">
              <BadgeCheck className="h-4 w-4 text-emerald-600" />
              <span>GMC-Verified Doctors</span>
            </div>
            <div className="flex items-center gap-2">
              <Lock className="h-4 w-4 text-violet-600" />
              <span>SSL Encrypted</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-primary" />
              <span>No Subscription Required</span>
            </div>
          </div>
        </div>
      </section>

      {/* Latest from the Blog */}
      {latestPosts && latestPosts.length > 0 && (
        <section className="px-4 py-12 md:py-20">
          <div className="container mx-auto">
            <h2 className="text-center text-2xl font-bold md:text-3xl">
              Latest from Our Health Blog
            </h2>
            <p className="mx-auto mt-4 max-w-xl text-center text-muted-foreground">
              Expert articles on private healthcare, NHS wait times, and making
              informed health decisions.
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
                        Read article
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              ))}
            </div>
            <div className="mt-8 text-center">
              <Button variant="ghost" asChild>
                <Link href="/blog" className="gap-1">
                  View All Articles <ArrowRight className="h-4 w-4" />
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
            Ready to Book Your First Appointment?
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-muted-foreground">
            Join thousands of patients who trust MyDoctors360 for their
            healthcare needs.
          </p>
          <div className="mt-8 flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
            <Button size="lg" className="rounded-full" asChild>
              <Link href="/doctors">
                Find a Doctor <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
            <Button
              size="lg"
              variant="outline"
              className="rounded-full"
              asChild
            >
              <Link href="/register">Create Free Account</Link>
            </Button>
          </div>
          <p className="mt-4 text-sm text-muted-foreground">
            Free for patients and doctors. No credit card required.
          </p>
        </div>
      </section>
    </>
  );
}
