import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Link } from "@/i18n/navigation";
import { Mail, FileText, MessageCircle, HelpCircle } from "lucide-react";

const supportEmail =
  process.env.NEXT_PUBLIC_SUPPORT_EMAIL || "support@mydoctors360.com";
const whatsappNumber = process.env.NEXT_PUBLIC_WHATSAPP_BUSINESS_NUMBER || "";

const faqs = [
  {
    question: "How do I book an appointment?",
    answer:
      "Browse our doctor directory, select a specialist that fits your needs, choose an available time slot from their calendar, and complete the booking with a secure online payment. You'll receive an instant confirmation email with all the details.",
  },
  {
    question: "Can I cancel or reschedule my booking?",
    answer:
      "Yes. You can cancel or reschedule from your patient dashboard. Each doctor sets their own cancellation policy, so please review the policy on the doctor's profile before booking. Cancellations made within the allowed window are eligible for a full refund.",
  },
  {
    question: "How do refunds work?",
    answer:
      "If you cancel within the doctor's cancellation window, your refund is processed automatically back to your original payment method. Refunds typically appear within 5-10 business days depending on your bank. If a doctor cancels your appointment, you will always receive a full refund.",
  },
  {
    question: "How do video consultations work?",
    answer:
      "When you book a video consultation, you'll receive a unique video call link in your confirmation email and dashboard. At the scheduled time, simply click the link to join a secure, HD video session with your doctor. No software installation is required.",
  },
  {
    question: "How do I update my profile or payment information?",
    answer:
      "Log in to your dashboard and navigate to Settings. From there you can update your personal details, contact information, and manage your saved payment methods. Changes take effect immediately.",
  },
  {
    question: "I'm a doctor \u2014 how do I join MyDoctors360?",
    answer:
      "Visit our 'Join as a Doctor' page to create your professional profile. After submitting your credentials and medical license, our team will verify your information within 24-48 hours. Once approved, you can set your availability, consultation fees, and start receiving patient bookings.",
  },
];

export default function SupportPage() {
  return (
    <>
      {/* Hero */}
      <section className="bg-gradient-to-br from-primary/5 via-background to-primary/5 px-4 py-16 md:py-24">
        <div className="container mx-auto text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-primary/10">
            <HelpCircle className="h-7 w-7 text-primary" />
          </div>
          <h1 className="text-3xl font-bold tracking-tight md:text-5xl">
            How Can We Help?
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-lg text-muted-foreground">
            Reach our support team through email, support tickets, or WhatsApp.
            We&apos;re here to make your experience seamless.
          </p>
        </div>
      </section>

      {/* Support Path Cards */}
      <section className="px-4 py-12 md:py-20">
        <div className="container mx-auto max-w-5xl">
          <div className="grid gap-6 md:grid-cols-3">
            {/* Email Support */}
            <Card className="overflow-hidden text-center">
              <div className="flex flex-col items-center gap-2 bg-blue-50 px-6 py-6 dark:bg-blue-950/30">
                <Mail className="h-7 w-7 text-blue-600" />
                <h3 className="text-lg font-semibold text-blue-900 dark:text-blue-100">
                  Email Support
                </h3>
              </div>
              <CardContent className="flex flex-1 flex-col items-center gap-4 pt-6">
                <p className="text-sm text-muted-foreground">
                  Send us an email and we&apos;ll respond within 24 hours.
                </p>
                <span className="text-sm font-medium text-primary">
                  {supportEmail}
                </span>
                <Button className="mt-auto w-full rounded-full" asChild>
                  <a href={`mailto:${supportEmail}`}>Send Email</a>
                </Button>
              </CardContent>
            </Card>

            {/* Support Tickets */}
            <Card className="overflow-hidden text-center">
              <div className="flex flex-col items-center gap-2 bg-emerald-50 px-6 py-6 dark:bg-emerald-950/30">
                <FileText className="h-7 w-7 text-emerald-600" />
                <h3 className="text-lg font-semibold text-emerald-900 dark:text-emerald-100">
                  Support Tickets
                </h3>
              </div>
              <CardContent className="flex flex-1 flex-col items-center gap-4 pt-6">
                <p className="text-sm text-muted-foreground">
                  Create a ticket for the fastest response. Track status in
                  real-time from your dashboard.
                </p>
                <Button
                  className="mt-auto w-full rounded-full"
                  variant="outline"
                  asChild
                >
                  <Link href="/login">Log In to Create Ticket</Link>
                </Button>
              </CardContent>
            </Card>

            {/* WhatsApp */}
            <Card className="overflow-hidden text-center">
              <div className="flex flex-col items-center gap-2 bg-green-50 px-6 py-6 dark:bg-green-950/30">
                <MessageCircle className="h-7 w-7 text-green-600" />
                <h3 className="text-lg font-semibold text-green-900 dark:text-green-100">
                  WhatsApp
                </h3>
              </div>
              <CardContent className="flex flex-1 flex-col items-center gap-4 pt-6">
                <p className="text-sm text-muted-foreground">
                  Chat with us on WhatsApp during business hours for quick
                  assistance.
                </p>
                <span className="text-xs font-medium text-muted-foreground">
                  Mon&ndash;Fri, 9:00&ndash;18:00 CET
                </span>
                <Button
                  className="mt-auto w-full rounded-full"
                  variant="outline"
                  asChild
                >
                  <a
                    href={`https://wa.me/${whatsappNumber}`}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Chat on WhatsApp
                  </a>
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* FAQ Section */}
      <section className="bg-muted/30 px-4 py-12 md:py-20">
        <div className="container mx-auto max-w-3xl">
          <h2 className="text-center text-2xl font-bold md:text-3xl">
            Frequently Asked Questions
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-center text-muted-foreground">
            Find quick answers to common questions about bookings, payments, and
            using MyDoctors360.
          </p>

          <div className="mt-10">
            <Card>
              <CardContent className="px-6 py-2">
                <Accordion type="single" collapsible>
                  {faqs.map((faq, index) => (
                    <AccordionItem
                      key={index}
                      value={`faq-${index}`}
                    >
                      <AccordionTrigger className="text-left font-medium">
                        {faq.question}
                      </AccordionTrigger>
                      <AccordionContent className="text-muted-foreground">
                        {faq.answer}
                      </AccordionContent>
                    </AccordionItem>
                  ))}
                </Accordion>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="px-4 py-12 md:py-20">
        <div className="container mx-auto text-center">
          <h2 className="text-2xl font-bold md:text-3xl">
            Still Need Help?
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-muted-foreground">
            Our team is ready to assist you. Don&apos;t hesitate to reach out
            through any of the channels above.
          </p>
          <Button size="lg" className="mt-8 rounded-full" asChild>
            <a href={`mailto:${supportEmail}`}>
              Contact Support <Mail className="ml-2 h-4 w-4" />
            </a>
          </Button>
        </div>
      </section>
    </>
  );
}
