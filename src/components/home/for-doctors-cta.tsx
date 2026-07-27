"use client";

import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { ArrowRight, Briefcase } from "lucide-react";
import { Button } from "@/components/ui/button";

export function ForDoctorsCta() {
  const t = useTranslations("home");

  return (
    <section className="px-4 py-12 md:py-16">
      <div className="container mx-auto">
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-primary via-primary/90 to-teal-600 px-6 py-10 text-center text-white shadow-lg md:px-12 md:py-14">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_80%_20%,rgba(255,255,255,0.12),transparent_50%)]" />
          <div className="relative mx-auto max-w-2xl">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-white/15 backdrop-blur-sm">
              <Briefcase className="h-6 w-6" />
            </div>
            <h2 className="text-2xl font-bold md:text-3xl">
              {t("for_doctors_title")}
            </h2>
            <p className="mx-auto mt-3 max-w-xl text-white/85">
              {t("for_doctors_desc")}
            </p>
            <Button
              size="lg"
              variant="secondary"
              className="mt-6 rounded-full font-semibold"
              asChild
            >
              <Link href="/register-doctor" className="gap-1">
                {t("for_doctors_cta")} <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
}
