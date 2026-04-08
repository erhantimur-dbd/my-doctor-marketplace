"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Search,
  Calendar,
  Bell,
  Stethoscope,
  CheckCircle2,
  ArrowRight,
} from "lucide-react";

const steps = [
  {
    icon: Search,
    step: "01",
    anchor: "step-search",
    iconBg: "bg-gradient-to-br from-blue-500 to-blue-600",
    badge: "bg-blue-900 text-blue-50",
    check: "text-blue-500",
    lineBg: "bg-blue-500",
    hoverDetail:
      "Use our AI symptom checker to find the right specialty, or filter by language, price, and reviews.",
    animClass: "animate-hiw-search",
  },
  {
    icon: Calendar,
    step: "02",
    anchor: "step-book",
    iconBg: "bg-gradient-to-br from-emerald-500 to-emerald-600",
    badge: "bg-emerald-900 text-emerald-50",
    check: "text-emerald-500",
    lineBg: "bg-emerald-500",
    hoverDetail:
      "See real-time availability, pick your slot, and pay securely — all in under two minutes.",
    animClass: "animate-hiw-calendar",
  },
  {
    icon: Bell,
    step: "03",
    anchor: "step-reminders",
    iconBg: "bg-gradient-to-br from-amber-500 to-amber-600",
    badge: "bg-amber-900 text-amber-50",
    check: "text-amber-500",
    lineBg: "bg-amber-500",
    hoverDetail:
      "Get a reminder 24 hours before via email, and again 1 hour before via SMS or WhatsApp.",
    animClass: "animate-hiw-bell",
  },
  {
    icon: Stethoscope,
    step: "04",
    anchor: "step-visit",
    iconBg: "bg-gradient-to-br from-teal-500 to-teal-600",
    badge: "bg-teal-900 text-teal-50",
    check: "text-teal-500",
    lineBg: "bg-teal-500",
    hoverDetail:
      "Join a secure HD video call from any device, or visit the clinic in person. Follow-ups are one click away.",
    animClass: "animate-hiw-stethoscope",
  },
];

export function HowItWorksSection() {
  const t = useTranslations("home");
  const [hoveredStep, setHoveredStep] = useState<string | null>(null);

  const stepData = steps.map((s, i) => ({
    ...s,
    title: t(`step_${i + 1}_title`),
    desc: t(`step_${i + 1}_desc`),
    features: [
      t(`step_${i + 1}_f1`),
      t(`step_${i + 1}_f2`),
      t(`step_${i + 1}_f3`),
    ],
  }));

  return (
    <section className="bg-muted/30 px-4 py-16 md:py-24">
      <div className="container mx-auto">
        {/* Header */}
        <div className="text-center">
          <h2 className="text-2xl font-bold md:text-3xl">
            {t("how_it_works_title")}
          </h2>
          <p className="mx-auto mt-3 max-w-xl text-muted-foreground">
            {t("how_it_works_subtitle")}
          </p>
        </div>

        {/* ── Progress Stepper (desktop) ── */}
        <div className="mx-auto mt-10 hidden max-w-3xl lg:block">
          <div className="flex items-center justify-between">
            {stepData.map((step, i) => (
              <div key={step.step} className="flex items-center">
                <div className="flex flex-col items-center">
                  <div
                    className={`flex h-9 w-9 items-center justify-center rounded-full text-xs font-bold text-white shadow-md ${step.iconBg}`}
                  >
                    {step.step}
                  </div>
                  <span className="mt-1.5 text-xs font-medium text-muted-foreground">
                    {step.title}
                  </span>
                </div>
                {i < stepData.length - 1 && (
                  <div className="mx-1 flex-1">
                    <div className="relative h-0.5 w-full min-w-[80px] bg-border">
                      <div
                        className="absolute inset-y-0 left-0 bg-gradient-to-r from-blue-500 via-emerald-500 to-amber-500"
                        style={{ width: "100%" }}
                      />
                      <ArrowRight className="absolute -right-1.5 -top-[7px] h-4 w-4 text-muted-foreground/60" />
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* ── Mobile: Vertical Timeline ── */}
        <div className="mt-10 lg:hidden">
          {stepData.map((step, i) => (
            <Link
              key={step.step}
              href={`/how-it-works#${step.anchor}`}
              className="group flex gap-4"
            >
              {/* Timeline track */}
              <div className="flex flex-col items-center">
                {/* Icon circle */}
                <div
                  className={`relative flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${step.iconBg} text-white shadow-md`}
                >
                  <step.icon className={`h-5 w-5 ${step.animClass}`} />
                  <span
                    className={`absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full ${step.badge} text-[9px] font-bold`}
                  >
                    {step.step}
                  </span>
                </div>
                {/* Connecting line */}
                {i < stepData.length - 1 && (
                  <div className={`my-1 w-0.5 flex-1 ${step.lineBg} opacity-30`} />
                )}
              </div>

              {/* Content */}
              <div className={`pb-6 ${i === stepData.length - 1 ? "pb-0" : ""}`}>
                <h3 className="text-base font-semibold leading-tight">
                  {step.title}
                </h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  {step.desc}
                </p>
                <ul className="mt-2.5 space-y-1.5">
                  {step.features.map((feature) => (
                    <li
                      key={feature}
                      className="flex items-center gap-2 text-sm"
                    >
                      <CheckCircle2
                        className={`h-3.5 w-3.5 shrink-0 ${step.check}`}
                      />
                      {feature}
                    </li>
                  ))}
                </ul>
              </div>
            </Link>
          ))}
        </div>

        {/* ── Desktop: Card Grid with connecting line ── */}
        <div className="relative mt-10 hidden lg:block">
          {/* Horizontal connector line */}
          <div className="absolute left-[calc(12.5%+28px)] right-[calc(12.5%+28px)] top-[52px] z-0">
            <div className="h-px w-full border-t-2 border-dashed border-border" />
          </div>

          <div className="grid grid-cols-4 gap-6">
            {stepData.map((step) => (
              <Link
                key={step.step}
                href={`/how-it-works#${step.anchor}`}
                className="group relative z-10"
                onMouseEnter={() => setHoveredStep(step.step)}
                onMouseLeave={() => setHoveredStep(null)}
              >
                <Card className="relative h-full overflow-hidden border bg-background transition-all duration-300 group-hover:-translate-y-1 group-hover:shadow-lg">
                  <CardContent className="p-6">
                    {/* Animated icon */}
                    <div className="relative mb-4 inline-block">
                      <div
                        className={`flex h-14 w-14 items-center justify-center rounded-2xl ${step.iconBg} text-white shadow-lg transition-transform duration-300 group-hover:scale-110`}
                      >
                        <step.icon
                          className={`h-6 w-6 transition-transform duration-500 ${step.animClass} group-hover:animate-none`}
                        />
                      </div>
                      <span
                        className={`absolute -right-2 -top-2 flex h-6 w-6 items-center justify-center rounded-full ${step.badge} text-[10px] font-bold`}
                      >
                        {step.step}
                      </span>
                    </div>

                    <h3 className="text-lg font-semibold">{step.title}</h3>
                    <p className="mt-1.5 text-sm text-muted-foreground">
                      {step.desc}
                    </p>

                    <ul className="mt-4 space-y-2">
                      {step.features.map((feature) => (
                        <li
                          key={feature}
                          className="flex items-center gap-2 text-sm"
                        >
                          <CheckCircle2
                            className={`h-4 w-4 shrink-0 ${step.check}`}
                          />
                          {feature}
                        </li>
                      ))}
                    </ul>

                    {/* Hover expanded detail */}
                    <div
                      className={`mt-3 overflow-hidden transition-all duration-300 ${
                        hoveredStep === step.step
                          ? "max-h-24 opacity-100"
                          : "max-h-0 opacity-0"
                      }`}
                    >
                      <p className="border-t pt-3 text-xs leading-relaxed text-muted-foreground">
                        {step.hoverDetail}
                      </p>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        </div>

        {/* CTA */}
        <div className="mt-8 text-center">
          <Button variant="ghost" asChild>
            <Link href="/how-it-works" className="gap-1">
              {t("learn_more")} <ArrowRight className="h-4 w-4" />
            </Link>
          </Button>
        </div>
      </div>
    </section>
  );
}
