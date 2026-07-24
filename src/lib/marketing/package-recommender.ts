/**
 * Pure package recommender logic (D-simple packaging).
 * UI lives in contact/package-recommender.tsx — keep reasons aligned with
 * PACKAGE_MARKETING / hasFeature.
 */

import type { LicenseTier } from "@/types";

export type PatientVolume = "under_10" | "10_to_30" | "over_30";
export type YesNo = "yes" | "no";
export type PracticeSize = "solo" | "multi";

export interface PackageRecommenderAnswers {
  practiceSize: PracticeSize | null;
  patientsPerWeek: PatientVolume | null;
  needsVideo: YesNo | null;
  wantsGrowthTools: YesNo | null;
}

/**
 * D-simple ladder:
 *   multi-doctor → Clinic (3–15)
 *   solo + growth tools → Professional (1 seat)
 *   solo + video / high volume → Starter
 *   else → Founding Free
 */
export function getPackageRecommendation(
  answers: PackageRecommenderAnswers
): LicenseTier | null {
  const { practiceSize, patientsPerWeek, needsVideo, wantsGrowthTools } =
    answers;
  if (!practiceSize || !patientsPerWeek || !needsVideo || !wantsGrowthTools) {
    return null;
  }

  if (practiceSize === "multi") return "clinic";
  if (wantsGrowthTools === "yes") return "professional";
  if (needsVideo === "yes" || patientsPerWeek === "over_30") return "starter";
  return "free";
}

export function getPackageRecommendationReason(
  tierId: LicenseTier,
  answers: PackageRecommenderAnswers
): string {
  if (tierId === "clinic") {
    return "Clinic is the multi-doctor practice licence (£1,495/mo): 3 doctor seats included (expand to 15), multi-location, team tools, medical testing included, and everything in Professional. Solo doctors should use Free, Starter or Professional instead.";
  }
  if (tierId === "professional") {
    return "Professional is a solo growth plan (£299 flat): Starter plus SMS & WhatsApp, advanced analytics, patient CRM, care plans, waitlist auto-notify, and priority support. Multi-doctor seats (3–15), multi-location and included medical testing are on Clinic.";
  }
  if (tierId === "starter") {
    if (answers.needsVideo === "yes" && answers.patientsPerWeek === "over_30") {
      return "With high patient volume and video demand, Starter unlocks online bookings, video, email reminders, messaging and AI insights — upgrade to Professional later for SMS/WhatsApp, analytics and waitlist.";
    }
    if (answers.needsVideo === "yes") {
      return "Video and online bookings are on Starter (£199/mo), with email reminders, messaging and AI review summaries. SMS, WhatsApp, CRM and analytics come with Professional.";
    }
    return "With your patient volume, Starter is the right step for paid bookings, video, email and AI. SMS/WhatsApp, analytics and waitlist unlock on Professional.";
  }
  return "Founding Free is ideal to start — public listing after verification and a dashboard, with no online bookings, video or AI until you upgrade to Starter.";
}
