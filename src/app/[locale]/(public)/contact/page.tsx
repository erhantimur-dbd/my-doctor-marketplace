import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";
import {
  Phone,
  Mail,
  HelpCircle,
  ArrowRight,
  Stethoscope,
} from "lucide-react";
import { PackageRecommender } from "./package-recommender";
import { ContactForm } from "./contact-form";

const salesEmail =
  process.env.CONTACT_ADMIN_EMAIL ||
  process.env.NEXT_PUBLIC_SUPPORT_EMAIL ||
  "sales@mydoctors360.com";

export default function ContactPage() {
  return (
    <>
      {/* Hero */}
      <section className="bg-gradient-to-br from-primary/5 via-background to-primary/5 px-4 py-16 md:py-24">
        <div className="container mx-auto text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-primary/10">
            <Phone className="h-7 w-7 text-primary" />
          </div>
          <h1 className="text-3xl font-bold tracking-tight md:text-5xl">
            Get in Touch
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-lg text-muted-foreground">
            Whether you&apos;re a doctor exploring our platform, a potential
            partner, or just have a question — we&apos;d love to hear from you.
          </p>
        </div>
      </section>

      {/* Package Recommender + Sales Info */}
      <section className="px-4 py-12 md:py-20">
        <div className="container mx-auto max-w-5xl">
          <div className="mb-10 text-center">
            <h2 className="text-2xl font-bold md:text-3xl">
              For Doctors
            </h2>
            <p className="mx-auto mt-3 max-w-xl text-muted-foreground">
              Find the right plan for your practice, or speak to our sales team
              for personalised guidance.
            </p>
          </div>

          <div className="grid items-start gap-8 lg:grid-cols-3">
            {/* Recommender — takes 2 columns */}
            <div className="lg:col-span-2">
              <PackageRecommender />
            </div>

            {/* Sales Contact Card */}
            <div className="space-y-6">
              <Card className="overflow-hidden">
                <div className="flex flex-col items-center gap-2 bg-amber-50 px-6 py-6 dark:bg-amber-950/30">
                  <Stethoscope className="h-7 w-7 text-amber-600" />
                  <h3 className="text-lg font-semibold text-amber-900 dark:text-amber-100">
                    Talk to Sales
                  </h3>
                </div>
                <CardContent className="flex flex-col items-center gap-4 pt-6 text-center">
                  <p className="text-sm text-muted-foreground">
                    Need help deciding? Our team can walk you through the plans,
                    answer questions about onboarding, and help you get set up.
                  </p>
                  <span className="text-sm font-medium text-primary">
                    {salesEmail}
                  </span>
                  <Button className="w-full rounded-full" asChild>
                    <a href={`mailto:${salesEmail}?subject=Doctor Onboarding Inquiry`}>
                      <Mail className="mr-2 h-4 w-4" />
                      Email Sales Team
                    </a>
                  </Button>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="py-5 text-center">
                  <p className="text-sm font-medium">Quick Links</p>
                  <div className="mt-3 flex flex-col gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full rounded-full"
                      asChild
                    >
                      <Link href="/pricing">View Pricing Plans</Link>
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full rounded-full"
                      asChild
                    >
                      <Link href="/register-doctor">Join as Doctor</Link>
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full rounded-full"
                      asChild
                    >
                      <Link href="/how-it-works">How It Works</Link>
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </section>

      {/* General Inquiry Form */}
      <section className="bg-muted/30 px-4 py-12 md:py-20">
        <div className="container mx-auto max-w-5xl">
          <div className="mb-10 text-center">
            <h2 className="text-2xl font-bold md:text-3xl">
              General Inquiries
            </h2>
            <p className="mx-auto mt-3 max-w-xl text-muted-foreground">
              Partnerships, press, or anything else — drop us a message and
              we&apos;ll get back to you within 24 hours.
            </p>
          </div>

          <ContactForm />
        </div>
      </section>

      {/* Already a User? Support Redirect */}
      <section className="px-4 py-12 md:py-20">
        <div className="container mx-auto max-w-2xl">
          <Card className="overflow-hidden">
            <div className="flex flex-col items-center gap-2 bg-sky-50 px-6 py-6 dark:bg-sky-950/30">
              <HelpCircle className="h-7 w-7 text-sky-600" />
              <h3 className="text-lg font-semibold text-sky-900 dark:text-sky-100">
                Already a User?
              </h3>
            </div>
            <CardContent className="flex flex-col items-center gap-4 pt-6 text-center">
              <p className="max-w-md text-sm text-muted-foreground">
                If you&apos;re an existing patient or doctor and need help with
                bookings, billing, or your account, visit our Support Centre for
                faster assistance.
              </p>
              <Button variant="outline" className="rounded-full" asChild>
                <Link href="/support">
                  Go to Support Centre
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* CTA */}
      <section className="bg-gradient-to-br from-primary to-primary/80 px-4 py-16 md:py-24">
        <div className="container mx-auto text-center">
          <h2 className="text-2xl font-bold text-primary-foreground md:text-3xl">
            Ready to Grow Your Practice?
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-primary-foreground/80">
            Join hundreds of doctors across Europe who use MyDoctors360 to connect
            with patients and manage their practice.
          </p>
          <div className="mt-8 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
            <Button
              size="lg"
              variant="secondary"
              className="rounded-full"
              asChild
            >
              <Link href="/register-doctor">
                Join as Doctor <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
            <Button
              size="lg"
              variant="ghost"
              className="rounded-full text-primary-foreground hover:bg-primary-foreground/10 hover:text-primary-foreground"
              asChild
            >
              <Link href="/pricing">View Pricing</Link>
            </Button>
          </div>
        </div>
      </section>
    </>
  );
}
