import type { AnnualPlanId, OfferKind } from "@/lib/offers/plans";
import { isAnnualPlanId } from "@/lib/offers/plans";

export type OfferIssue = { ok: false; code: string; error: string };
export type OfferOk = { ok: true };
export type OfferResult = OfferOk | OfferIssue;

export type OfferDraft = {
  name: string;
  kind: OfferKind;
  percentOff: number | null;
  trialDays: number | null;
  eligiblePlans: string[];
  redeemBy: Date;
  now: Date;
};

export function validateOfferDraft(draft: OfferDraft): OfferResult {
  const name = draft.name.trim();
  if (name.length < 2 || name.length > 80) {
    return { ok: false, code: "invalid_name", error: "Give the offer a name (2–80 characters)." };
  }
  if (draft.kind !== "percent_first_year" && draft.kind !== "free_trial") {
    return { ok: false, code: "invalid_kind", error: "Choose a percent discount or a free trial." };
  }
  if (draft.kind === "percent_first_year") {
    if (
      draft.percentOff == null ||
      !Number.isInteger(draft.percentOff) ||
      draft.percentOff < 1 ||
      draft.percentOff > 100
    ) {
      return {
        ok: false,
        code: "percent_required",
        error: "Percent off must be a whole number from 1 to 100.",
      };
    }
    if (draft.trialDays != null) {
      return {
        ok: false,
        code: "percent_required",
        error: "A percent offer does not include a trial.",
      };
    }
  }
  if (draft.kind === "free_trial") {
    if (
      draft.trialDays == null ||
      !Number.isInteger(draft.trialDays) ||
      draft.trialDays < 1 ||
      draft.trialDays > 365
    ) {
      return {
        ok: false,
        code: "trial_required",
        error: "Trial length must be a whole number of days from 1 to 365.",
      };
    }
    if (draft.percentOff != null) {
      return {
        ok: false,
        code: "trial_required",
        error: "A trial offer does not include a percent discount.",
      };
    }
  }

  if (draft.eligiblePlans.length === 0) {
    return {
      ok: false,
      code: "plan_not_eligible",
      error: "Choose annual Solo, annual Pro, or both.",
    };
  }
  for (const plan of draft.eligiblePlans) {
    if (plan === "clinic" || plan === "clinic_annual" || plan.includes("clinic")) {
      return {
        ok: false,
        code: "clinic_excluded",
        error: "Clinic plans are not part of offers.",
      };
    }
    if (plan === "starter" || plan === "professional" || plan.endsWith("_monthly")) {
      return {
        ok: false,
        code: "not_annual",
        error: "Offers apply to annual Solo and annual Pro only.",
      };
    }
    if (!isAnnualPlanId(plan)) {
      return {
        ok: false,
        code: "plan_not_eligible",
        error: "Offers apply to annual Solo and annual Pro only.",
      };
    }
  }
  if (!(draft.redeemBy instanceof Date) || Number.isNaN(draft.redeemBy.getTime())) {
    return { ok: false, code: "expired", error: "Choose a redeem-by date." };
  }
  if (draft.redeemBy.getTime() <= draft.now.getTime()) {
    return { ok: false, code: "expired", error: "Redeem-by must be in the future." };
  }
  return { ok: true };
}

export type CheckoutOffer = {
  id: string;
  kind: OfferKind;
  percentOff: number | null;
  trialDays: number | null;
  eligiblePlans: AnnualPlanId[];
  redeemBy: Date;
  active: boolean;
  stripePromotionCodeId: string | null;
};

/**
 * One offer per doctor. A second promotion code is rejected whenever an
 * offer is attached. Offers cannot stack with Founding Free.
 */
export function validateOfferForCheckout(input: {
  offer: CheckoutOffer;
  planId: string;
  now: Date;
  foundingFree: boolean;
  existingOfferId: string | null;
  extraPromotionCode: string | null;
}): OfferResult {
  if (input.foundingFree) {
    return {
      ok: false,
      code: "founding_free",
      error: "Offers can't be combined with Founding Free.",
    };
  }
  if (!input.offer.active) {
    return { ok: false, code: "inactive", error: "This offer is no longer available." };
  }
  if (input.offer.redeemBy.getTime() <= input.now.getTime()) {
    return { ok: false, code: "expired", error: "This offer's redeem-by date has passed." };
  }
  if (!isAnnualPlanId(input.planId) || !input.offer.eligiblePlans.includes(input.planId)) {
    return {
      ok: false,
      code: "plan_not_eligible",
      error: "This offer doesn't apply to that plan.",
    };
  }
  const extra = input.extraPromotionCode?.trim();
  if (extra) {
    return {
      ok: false,
      code: "second_code",
      error: "Only one offer can be used. Remove the other promotion code.",
    };
  }
  if (input.existingOfferId && input.existingOfferId !== input.offer.id) {
    return {
      ok: false,
      code: "second_offer",
      error: "This account already has an offer. A second offer can't be added.",
    };
  }
  if (input.existingOfferId && input.existingOfferId === input.offer.id) {
    return {
      ok: false,
      code: "second_offer",
      error: "This offer is already attached to the account.",
    };
  }
  if (input.offer.kind === "percent_first_year" && !input.offer.stripePromotionCodeId) {
    return {
      ok: false,
      code: "missing_promotion_code",
      error: "This discount offer is not ready yet.",
    };
  }
  return { ok: true };
}

/** Statuses that mean the practice already has a subscription in force. */
export const LIVE_LICENCE_STATUSES = ["active", "trialing", "past_due"] as const;

export const LIVE_LICENCE_ERROR =
  "This practice already has a live subscription. A second one can't be started.";

export const LICENCE_CHECK_ERROR =
  "Could not check this practice's subscription. Checkout was not started.";

/**
 * One live licence per practice. A paying monthly or annual row blocks a new
 * offer checkout even when it has no offer attached.
 */
export function liveLicenceBlocksCheckout(
  licences: Array<{ status?: string | null }>
): string | null {
  const live = new Set<string>(LIVE_LICENCE_STATUSES);
  const blocked = licences.some((licence) => live.has((licence.status || "").toLowerCase()));
  return blocked ? LIVE_LICENCE_ERROR : null;
}

export function offerConflictsWithFoundingFree(input: {
  tier: string;
  foundingMember: boolean;
  licenseTier?: string | null;
}): boolean {
  if (input.tier === "free") return true;
  if (input.foundingMember) return true;
  if (input.licenseTier === "free") return true;
  return false;
}
