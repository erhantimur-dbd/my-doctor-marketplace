import type { AnnualPlanId, OfferKind } from "@/lib/offers/plans";
import { isAnnualPlanId } from "@/lib/offers/plans";
import type { CheckoutOffer } from "@/lib/offers/validation";

export type OfferRow = {
  id: string;
  slug: string;
  name: string;
  kind: string;
  percent_off: number | null;
  trial_days: number | null;
  eligible_plans: string[] | null;
  redeem_by: string;
  active: boolean;
  stripe_coupon_id: string | null;
  stripe_promotion_code_id: string | null;
  created_at?: string;
};

export function toCheckoutOffer(row: OfferRow): CheckoutOffer {
  const plans = (row.eligible_plans || []).filter(isAnnualPlanId);
  return {
    id: row.id,
    kind: row.kind as OfferKind,
    percentOff: row.percent_off,
    trialDays: row.trial_days,
    eligiblePlans: plans as AnnualPlanId[],
    redeemBy: new Date(row.redeem_by),
    active: row.active,
    stripePromotionCodeId: row.stripe_promotion_code_id,
  };
}

export function slugifyOfferName(name: string, now = Date.now()): string {
  const base = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
  return `${base || "offer"}-${now.toString(36).slice(-4)}`;
}
