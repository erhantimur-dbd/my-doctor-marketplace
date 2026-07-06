import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Link } from "@/i18n/navigation";
import { Mail, FileText, MessageCircle, HelpCircle, BookOpen, ArrowRight } from "lucide-react";
import { getTranslations } from "next-intl/server";
import type { Metadata } from "next";

const supportEmail =
  process.env.NEXT_PUBLIC_SUPPORT_EMAIL || "support@mydoctors360.com";
const whatsappNumber = process.env.NEXT_PUBLIC_WHATSAPP_BUSINESS_NUMBER || "";

const faqs = [
  { question: "faq_booking_q", answer: "faq_booking_a" },
  { question: "faq_cancel_q", answer: "faq_cancel_a" },
  { question: "faq_refunds_q", answer: "faq_refunds_a" },
  { question: "faq_video_q", answer: "faq_video_a" },
  { question: "faq_profile_q", answer: "faq_profile_a" },
  { question: "faq_doctor_join_q", answer: "faq_doctor_join_a" },
] as const;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "meta" });
  const seoMeta = (await import("@/lib/seo/metadata")).generateMetadata;
  return seoMeta({
    title: t("support.title"),
    description: t("support.description"),
    path: `/${locale}/support`,
  });
}

export default async function SupportPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "helpCenter" });
  return (
    <>
      {/* Hero */}
      <section className="bg-gradient-to-br from-primary/5 via-background to-primary/5 px-4 py-16 md:py-24">
        <div className="container mx-auto text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-primary/10">
            <HelpCircle className="h-7 w-7 text-primary" />
          </div>
          <h1 className="text-3xl font-bold tracking-tight md:text-5xl">
            {t("support_hero_title")}
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-lg text-muted-foreground">
            {t("support_hero_subtitle")}
          </p>
        </div>
      </section>

      {/* Help Center Banner */}
      <section className="px-4 py-8">
        <div className="container mx-auto max-w-5xl">
          <Card className="border-primary/20 bg-primary/5">
            <CardContent className="flex flex-col items-start gap-4 p-6 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-4">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10">
                  <BookOpen className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <h3 className="font-semibold">
                    {t("help_center_banner_title")}
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    {t("help_center_banner_desc")}
                  </p>
                </div>
              </div>
              <Button className="shrink-0 rounded-full" asChild>
                <Link href="/help-center">
                  {t("browse_help_center")}{" "}
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
            </CardContent>
          </Card>
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
                  {t("support_email_title")}
                </h3>
              </div>
              <CardContent className="flex flex-1 flex-col items-center gap-4 pt-6">
                <p className="text-sm text-muted-foreground">
                  {t("support_email_desc")}
                </p>
                <span className="text-sm font-medium text-primary">
                  {supportEmail}
                </span>
                <Button className="mt-auto w-full rounded-full" asChild>
                  <a href={`mailto:${supportEmail}`}>{t("support_email_button")}</a>
                </Button>
              </CardContent>
            </Card>

            {/* Support Tickets */}
            <Card className="overflow-hidden text-center">
              <div className="flex flex-col items-center gap-2 bg-emerald-50 px-6 py-6 dark:bg-emerald-950/30">
                <FileText className="h-7 w-7 text-emerald-600" />
                <h3 className="text-lg font-semibold text-emerald-900 dark:text-emerald-100">
                  {t("support_tickets_title")}
                </h3>
              </div>
              <CardContent className="flex flex-1 flex-col items-center gap-4 pt-6">
                <p className="text-sm text-muted-foreground">
                  {t("support_tickets_desc")}
                </p>
                <Button
                  className="mt-auto w-full rounded-full"
                  variant="outline"
                  asChild
                >
                  <Link href="/login">{t("support_tickets_button")}</Link>
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
                  {t("support_whatsapp_desc")}
                </p>
                <span className="text-xs font-medium text-muted-foreground">
                  {t("support_whatsapp_hours")}
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
                    {t("support_whatsapp_button")}
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
            {t("support_faq_title")}
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-center text-muted-foreground">
            {t("support_faq_subtitle")}
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
                        {t(faq.question)}
                      </AccordionTrigger>
                      <AccordionContent className="text-muted-foreground">
                        {t(faq.answer)}
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
            {t("still_need_help")}
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-muted-foreground">
            {t("support_cta_desc")}
          </p>
          <Button size="lg" className="mt-8 rounded-full" asChild>
            <a href={`mailto:${supportEmail}`}>
              {t("contact_support")} <Mail className="ml-2 h-4 w-4" />
            </a>
          </Button>
        </div>
      </section>
    </>
  );
}
