import { createAdminClient } from "@/lib/supabase/admin";
import { log } from "@/lib/utils/logger";
import { annualTotalPence } from "@/lib/constants/billing-period";
import { getLicenseTier } from "@/lib/constants/license-tiers";
import { annualPlanIdForTier, type AnnualPlanId } from "@/lib/offers/plans";
import { isStripeTestMode } from "@/lib/offers/stripe-mode";

export function fallbackAnnualPence(tier: "starter" | "professional"): number {
  const monthly = getLicenseTier(tier)?.priceMonthlyPence ?? 0;
  return annualTotalPence(monthly);
}

export function pickAnnualAmountPence(
  catalogPence: number | null | undefined,
  fallbackPence: number
): number {
  if (catalogPence && catalogPence > 0) return catalogPence;
  return fallbackPence;
}

function isMissingRelation(error: { code?: string; message?: string } | null): boolean {
  if (!error) return false;
  if (error.code === "42P01" || error.code === "PGRST205") return true;
  const message = error.message?.toLowerCase() ?? "";
  return message.includes("plan_price_versions") && message.includes("does not exist");
}

export async function resolveLatestAnnualPrice(
  tier: string
): Promise<{ stripePriceId: string | null; amountPence: number } | null> {
  const planId = annualPlanIdForTier(tier);
  if (!planId) return null;
  const fallback = fallbackAnnualPence(tier as "starter" | "professional");
  if (!isStripeTestMode()) {
    return { stripePriceId: null, amountPence: fallback };
  }
  try {
    const admin = createAdminClient();
    const { data, error } = await admin
      .from("plan_price_versions")
      .select("stripe_price_id, amount_pence")
      .eq("plan_id", planId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) {
      if (!isMissingRelation(error)) {
        log.error("Annual price catalogue read failed", { err: error });
      }
      return { stripePriceId: null, amountPence: fallback };
    }
    if (!data?.stripe_price_id) {
      return { stripePriceId: null, amountPence: fallback };
    }
    return {
      stripePriceId: data.stripe_price_id,
      amountPence: pickAnnualAmountPence(data.amount_pence, fallback),
    };
  } catch (err) {
    log.error("Annual price catalogue unavailable", { err });
    return { stripePriceId: null, amountPence: fallback };
  }
}

export async function annualDisplayPence(): Promise<{
  solo: number;
  pro: number;
}> {
  const solo = await resolveLatestAnnualPrice("starter");
  const pro = await resolveLatestAnnualPrice("professional");
  return {
    solo: solo?.amountPence ?? fallbackAnnualPence("starter"),
    pro: pro?.amountPence ?? fallbackAnnualPence("professional"),
  };
}

export function envAnnualPriceId(planId: AnnualPlanId): string | null {
  const envName =
    planId === "starter_annual"
      ? "STRIPE_PRICE_STARTER_ANNUAL"
      : "STRIPE_PRICE_PROFESSIONAL_ANNUAL";
  const id = process.env[envName]?.trim();
  if (id && id.startsWith("price_")) return id;
  return null;
}
