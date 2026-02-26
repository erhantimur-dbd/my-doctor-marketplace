"use client";

import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Link } from "@/i18n/navigation";
import { SUBSCRIPTION_PLANS } from "@/lib/constants/subscription-plans";
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
): "basic" | "professional" | "premium" | null {
  const { patientsPerWeek, needsVideo, wantsFeatured } = answers;
  if (!patientsPerWeek || !needsVideo || !wantsFeatured) return null;

  if (wantsFeatured === "yes") return "premium";
  if (needsVideo === "yes" || patientsPerWeek === "over_30")
    return "professional";
  return "basic";
}

function getRecommendationReason(
  planId: string,
  answers: Answers
): string {
  if (planId === "premium") {
    return "Featured placement will maximise your visibility to patients searching for specialists. You'll also get a dedicated account manager and advanced tools.";
  }
  if (planId === "professional") {
    if (answers.needsVideo === "yes" && answers.patientsPerWeek === "over_30") {
      return "With high patient volume and video consultations, Professional gives you unlimited bookings, telemedicine tools, and advanced analytics to manage your growing practice.";
    }
    if (answers.needsVideo === "yes") {
      return "Video consultations are included in Professional, along with unlimited bookings and a patient CRM to grow your practice.";
    }
    return "With your high patient volume, Professional gives you unlimited bookings, advanced analytics, and priority support to keep things running smoothly.";
  }
  return "Basic is perfect for getting started — you'll have a public profile, online booking, and email reminders to build your presence on the platform.";
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
  const [answers, setAnswers] = useState<Answers>({
    patientsPerWeek: null,
    needsVideo: null,
    wantsFeatured: null,
  });

  const recommendation = getRecommendation(answers);
  const plan = recommendation
    ? SUBSCRIPTION_PLANS.find((p) => p.id === recommendation)
    : null;

  return (
    <Card className="overflow-hidden">
      <div className="flex flex-col items-center gap-2 bg-indigo-50 px-6 py-6 dark:bg-indigo-950/30">
        <Sparkles className="h-7 w-7 text-indigo-600" />
        <h3 className="text-lg font-semibold text-indigo-900 dark:text-indigo-100">
          Which Package is Right for You?
        </h3>
        <p className="text-center text-sm text-indigo-700/70 dark:text-indigo-300/70">
          Answer 3 quick questions and we&apos;ll recommend the best plan.
        </p>
      </div>

      <CardContent className="space-y-6 pt-6">
        {/* Question 1 */}
        <div>
          <p className="mb-3 text-sm font-semibold">
            1. How many patients do you see per week?
          </p>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
            <OptionCard
              label="Under 10"
              description="Starting out"
              selected={answers.patientsPerWeek === "under_10"}
              onClick={() =>
                setAnswers((a) => ({ ...a, patientsPerWeek: "under_10" }))
              }
            />
            <OptionCard
              label="10 – 30"
              description="Established"
              selected={answers.patientsPerWeek === "10_to_30"}
              onClick={() =>
                setAnswers((a) => ({ ...a, patientsPerWeek: "10_to_30" }))
              }
            />
            <OptionCard
              label="Over 30"
              description="High volume"
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
            2. Do you need video consultations?
          </p>
          <div className="grid grid-cols-2 gap-2">
            <OptionCard
              label="Yes"
              description="Offer telemedicine"
              selected={answers.needsVideo === "yes"}
              onClick={() =>
                setAnswers((a) => ({ ...a, needsVideo: "yes" }))
              }
            />
            <OptionCard
              label="No"
              description="In-person only"
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
            3. Do you want featured placement in search results?
          </p>
          <div className="grid grid-cols-2 gap-2">
            <OptionCard
              label="Yes"
              description="Maximum visibility"
              selected={answers.wantsFeatured === "yes"}
              onClick={() =>
                setAnswers((a) => ({ ...a, wantsFeatured: "yes" }))
              }
            />
            <OptionCard
              label="No"
              description="Standard listing"
              selected={answers.wantsFeatured === "no"}
              onClick={() =>
                setAnswers((a) => ({ ...a, wantsFeatured: "no" }))
              }
            />
          </div>
        </div>

        {/* Result */}
        {plan && recommendation && (
          <div className="animate-in fade-in slide-in-from-bottom-2 rounded-xl border-2 border-primary/20 bg-primary/5 p-5">
            <div className="mb-3 flex items-center gap-3">
              <Badge variant="default" className="text-sm">
                Recommended
              </Badge>
              <span className="text-lg font-bold">{plan.name}</span>
              <span className="text-lg font-semibold text-primary">
                €{(plan.priceMonthly / 100).toFixed(0)}/mo
              </span>
            </div>

            <p className="mb-4 text-sm text-muted-foreground">
              {getRecommendationReason(recommendation, answers)}
            </p>

            <ul className="mb-5 space-y-1.5">
              {plan.features.slice(0, 4).map((feature) => (
                <li
                  key={feature}
                  className="flex items-center gap-2 text-sm"
                >
                  <CheckCircle2 className="h-4 w-4 shrink-0 text-primary" />
                  {feature}
                </li>
              ))}
              {plan.features.length > 4 && (
                <li className="pl-6 text-xs text-muted-foreground">
                  + {plan.features.length - 4} more features
                </li>
              )}
            </ul>

            <div className="flex flex-col gap-2 sm:flex-row">
              <Button asChild className="rounded-full">
                <Link href="/register-doctor">
                  Get Started <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
              <Button variant="outline" asChild className="rounded-full">
                <Link href="/pricing">View All Plans</Link>
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
