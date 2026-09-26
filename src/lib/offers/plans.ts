/**
 * Annual Solo and Pro are the only plans an offer can target.
 * Clinic, monthly, Founding Free, and Enterprise are not offer plans.
 * Amounts come from the licence catalogue (10 × monthly) unless a newer
 * annual price has been recorded in plan_price_versions.
 */

export const ANNUAL_OFFER_PLAN_IDS = [
  "starter_annual",
  "professional_annual",
] as const;

export type AnnualPlanId = (typeof ANNUAL_OFFER_PLAN_IDS)[number];

export type OfferKind = "percent_first_year" | "free_trial";

export const PLAN_LABEL: Record<AnnualPlanId, "Solo" | "Pro"> = {
  starter_annual: "Solo",
  professional_annual: "Pro",
};

export const PLAN_TIER: Record<AnnualPlanId, "starter" | "professional"> = {
  starter_annual: "starter",
  professional_annual: "professional",
};

export function isAnnualPlanId(value: string): value is AnnualPlanId {
  return (ANNUAL_OFFER_PLAN_IDS as readonly string[]).includes(value);
}

export function annualPlanIdForTier(tier: string): AnnualPlanId | null {
  if (tier === "starter") return "starter_annual";
  if (tier === "professional") return "professional_annual";
  return null;
}

export function tierForAnnualPlan(planId: AnnualPlanId): "starter" | "professional" {
  return PLAN_TIER[planId];
}
