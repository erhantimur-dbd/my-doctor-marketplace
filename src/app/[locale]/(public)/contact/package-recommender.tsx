"use client";

import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Link } from "@/i18n/navigation";
import { getLicenseTier, formatPriceForLocale } from "@/lib/constants/license-tiers";
import type { LicenseTier } from "@/types";
import { CheckCircle2, ArrowRight, Sparkles } from "lucide-react";

type PatientVolume = "under_10" | "10_to_30" | "over_30";
type YesNo = "yes" | "no";

interface Answers {
  patientsPerWeek: PatientVolume | null;
  needsVideo: YesNo | null;
  wantsFeatured: YesNo | null;
}

function getRecommendation(
  answers: Answers
): LicenseTier | null {
  const { patientsPerWeek, needsVideo, wantsFeatured } = answers;
  if (!patientsPerWeek || !needsVideo || !wantsFeatured) return null;

  if (wantsFeatured === "yes") return "professional";
  if (needsVideo === "yes" || patientsPerWeek === "over_30")
    return "starter";
  return "free";
}

function getRecommendationReasonKey(
  tierId: LicenseTier,
  answers: Answers
): string {
  if (tierId === "professional") {
    return "reason_professional";
  }
  if (tierId === "starter") {
    if (answers.needsVideo === "yes" && answers.patientsPerWeek === "over_30") {
      return "reason_starter_video_volume";
    }
    if (answers.needsVideo === "yes") {
      return "reason_starter_video";
    }
    return "reason_starter_volume";
  }
  return "reason_free";
}

interface OptionCardProps {
  label: string;
  description?: string;
  selected: boolean;
  onClick: () => void;
}

function OptionCard({ label, description, selected, onClick }: OptionCardProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      className={`w-full rounded-lg border-2 p-3 text-left transition-all ${
        selected
          ? "border-primary bg-primary/5"
          : "border-border hover:border-primary/40"
      }`}
    >
      <div className="flex items-center gap-2">
        <div
          className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 transition-colors ${
            selected
              ? "border-primary bg-primary"
              : "border-muted-foreground/30"
          }`}
        >
          {selected && (
            <CheckCircle2 className="h-3.5 w-3.5 text-primary-foreground" />
          )}
        </div>
        <span className={`text-sm font-medium ${selected ? "text-primary" : ""}`}>
          {label}
        </span>
      </div>
      {description && (
        <p className="mt-1 pl-7 text-xs text-muted-foreground">{description}</p>
      )}
    </button>
  );
}

export function PackageRecommender() {
  const locale = useLocale();
  const t = useTranslations("contact");
  const [answers, setAnswers] = useState<Answers>({
    patientsPerWeek: null,
    needsVideo: null,
    wantsFeatured: null,
  });

  const recommendation = getRecommendation(answers);
  const tierConfig = recommendation ? getLicenseTier(recommendation) : null;

  return (
    <Card className="overflow-hidden">
      <div className="flex flex-col items-center gap-2 bg-indigo-50 px-6 py-6 dark:bg-indigo-950/30">
        <Sparkles className="h-7 w-7 text-indigo-600" />
        <h3 className="text-lg font-semibold text-indigo-900 dark:text-indigo-100">
          {t("rec_title")}
        </h3>
        <p className="text-center text-sm text-indigo-700/70 dark:text-indigo-300/70">
          {t("rec_subtitle")}
        </p>
      </div>

      <CardContent className="space-y-6 pt-6">
        {/* Question 1 */}
        <div>
          <p className="mb-3 text-sm font-semibold">
            {t("q1")}
          </p>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
            <OptionCard
              label={t("q1_under")}
              description={t("q1_under_desc")}
              selected={answers.patientsPerWeek === "under_10"}
              onClick={() =>
                setAnswers((a) => ({ ...a, patientsPerWeek: "under_10" }))
              }
            />
            <OptionCard
              label={t("q1_mid")}
              description={t("q1_mid_desc")}
              selected={answers.patientsPerWeek === "10_to_30"}
              onClick={() =>
                setAnswers((a) => ({ ...a, patientsPerWeek: "10_to_30" }))
              }
            />
            <OptionCard
              label={t("q1_over")}
              description={t("q1_over_desc")}
              selected={answers.patientsPerWeek === "over_30"}
              onClick={() =>
                setAnswers((a) => ({ ...a, patientsPerWeek: "over_30" }))
              }
            />
          </div>
        </div>

        {/* Question 2 */}
        <div>
          <p className="mb-3 text-sm font-semibold">
            {t("q2")}
          </p>
          <div className="grid grid-cols-2 gap-2">
            <OptionCard
              label={t("opt_yes")}
              description={t("q2_yes_desc")}
              selected={answers.needsVideo === "yes"}
              onClick={() =>
                setAnswers((a) => ({ ...a, needsVideo: "yes" }))
              }
            />
            <OptionCard
              label={t("opt_no")}
              description={t("q2_no_desc")}
              selected={answers.needsVideo === "no"}
              onClick={() =>
                setAnswers((a) => ({ ...a, needsVideo: "no" }))
              }
            />
          </div>
        </div>

        {/* Question 3 */}
        <div>
          <p className="mb-3 text-sm font-semibold">
            {t("q3")}
          </p>
          <div className="grid grid-cols-2 gap-2">
            <OptionCard
              label={t("opt_yes")}
              description={t("q3_yes_desc")}
              selected={answers.wantsFeatured === "yes"}
              onClick={() =>
                setAnswers((a) => ({ ...a, wantsFeatured: "yes" }))
              }
            />
            <OptionCard
              label={t("opt_no")}
              description={t("q3_no_desc")}
              selected={answers.wantsFeatured === "no"}
              onClick={() =>
                setAnswers((a) => ({ ...a, wantsFeatured: "no" }))
              }
            />
          </div>
        </div>

        {/* Result */}
        {tierConfig && recommendation && (
          <div className="animate-in fade-in slide-in-from-bottom-2 rounded-xl border-2 border-primary/20 bg-primary/5 p-5">
            <div className="mb-3 flex items-center gap-3">
              <Badge variant="default" className="text-sm">
                {t("recommended")}
              </Badge>
              <span className="text-lg font-bold">{tierConfig.name}</span>
              {tierConfig.isFreeTier ? (
                <span className="text-lg font-semibold text-primary">{t("free_label")}</span>
              ) : (
                <span className="text-lg font-semibold text-primary">
                  {t("price_per_month", {
                    price: formatPriceForLocale(tierConfig.priceMonthlyPence, locale),
                  })}
                  {tierConfig.perUser && ` ${t("per_user")}`}
                </span>
              )}
            </div>

            <p className="mb-4 text-sm text-muted-foreground">
              {t(getRecommendationReasonKey(recommendation, answers) as Parameters<typeof t>[0])}
            </p>

            <ul className="mb-5 space-y-1.5">
              {tierConfig.features.slice(0, 4).map((feature) => (
                <li
                  key={feature}
                  className="flex items-center gap-2 text-sm"
                >
                  <CheckCircle2 className="h-4 w-4 shrink-0 text-primary" />
                  {feature}
                </li>
              ))}
              {tierConfig.features.length > 4 && (
                <li className="pl-6 text-xs text-muted-foreground">
                  {t("more_features", { count: tierConfig.features.length - 4 })}
                </li>
              )}
            </ul>

            <div className="flex flex-col gap-2 sm:flex-row">
              <Button asChild className="rounded-full">
                <Link href={`/register-doctor?tier=${recommendation}`}>
                  {t("get_started")} <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
              <Button variant="outline" asChild className="rounded-full">
                <Link href="/pricing">{t("view_all_plans")}</Link>
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
