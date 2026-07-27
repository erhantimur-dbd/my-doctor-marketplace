"use client";

import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { Clock, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";

interface SameDayBannerProps {
  /** Total doctors with near-term live availability */
  count: number;
}

export function SameDayBanner({ count }: SameDayBannerProps) {
  const t = useTranslations("home");

  if (count <= 0) return null;

  return (
    <section className="px-4 py-6 md:py-8">
      <div className="container mx-auto">
        <div className="flex flex-col items-start justify-between gap-4 rounded-2xl border border-amber-200/80 bg-gradient-to-r from-amber-50 to-orange-50 px-5 py-5 dark:border-amber-900/50 dark:from-amber-950/40 dark:to-orange-950/30 sm:flex-row sm:items-center sm:px-8">
          <div className="flex items-start gap-3 sm:items-center">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-amber-100 text-amber-700 dark:bg-amber-900/60 dark:text-amber-300">
              <Clock className="h-5 w-5" />
            </span>
            <div>
              <h2 className="text-lg font-semibold text-foreground md:text-xl">
                {t("same_day_title")}
              </h2>
              <p className="mt-0.5 text-sm text-muted-foreground">
                {t("same_day_subtitle", { count })}
              </p>
            </div>
          </div>
          <Button className="rounded-full shrink-0" asChild>
            <Link href="/doctors?sort=featured" className="gap-1">
              {t("same_day_cta")} <ArrowRight className="h-4 w-4" />
            </Link>
          </Button>
        </div>
      </div>
    </section>
  );
}
