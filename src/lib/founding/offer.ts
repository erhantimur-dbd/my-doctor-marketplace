/**
 * Founding doctor offer (decided 29 Sep 2026).
 *
 * First 100 doctors, £99/month, monthly, cancel anytime. The Stripe
 * subscription stays on STRIPE_PRICE_FOUNDING for as long as they keep the
 * plan. Cancel forfeits the price. Already-granted `tier=free` licences are
 * not rewritten here.
 */

import { FOUNDING_PROGRAMME_MAX_SPOTS } from "@/lib/constants/company";

export const FOUNDING_OFFER_TIER = "founding" as const;

/** £99 in GBP pence. Not a free plan. */
export const FOUNDING_OFFER_PRICE_PENCE = 9900;

export const FOUNDING_OFFER_MAX_SPOTS = FOUNDING_PROGRAMME_MAX_SPOTS;

export const FOUNDING_OFFER_CLOSED_ERROR =
  "The founding plan is limited to the first 100 doctors. This price is no longer available. You can choose Starter, Professional, or Clinic instead.";

export const FOUNDING_OFFER_FORFEIT_ERROR =
  "You have already cancelled the founding plan. The £99 price is no longer available.";

export function isFoundingOfferTier(tier: string | null | undefined): boolean {
  return tier === FOUNDING_OFFER_TIER;
}

/**
 * Licence grant gate. Doctor 101 (claim failed or number outside 1..100)
 * must not receive the £99 licence.
 */
export function mayGrantFoundingLicence(claim: {
  claimed: boolean;
  foundingNumber: number | null;
}): boolean {
  if (!claim.claimed) return false;
  const n = claim.foundingNumber;
  if (n == null || !Number.isFinite(n)) return false;
  return n >= 1 && n <= FOUNDING_OFFER_MAX_SPOTS;
}

/**
 * While the subscription is active the billed amount stays £99, even if a
 * later public price is passed in. After cancel the lock does not apply.
 */
export function lockedFoundingPricePence(input: {
  subscriptionActive: boolean;
  publicPricePence: number;
}): number | null {
  void input.publicPricePence;
  if (!input.subscriptionActive) return null;
  return FOUNDING_OFFER_PRICE_PENCE;
}

/** A forfeited doctor cannot start another £99 subscription. */
export function canResubscribeFoundingOffer(input: {
  forfeitedAt: string | null | undefined;
}): boolean {
  return !input.forfeitedAt;
}

/** True when an in-place price swap would leave the locked £99 plan. */
export function foundingPriceLockBlocksPriceChange(input: {
  currentTier: string | null | undefined;
  nextTier: string | null | undefined;
}): boolean {
  return (
    input.currentTier === FOUNDING_OFFER_TIER &&
    input.nextTier === FOUNDING_OFFER_TIER
  );
}

export function foundingOfferLicenseMetadata(): Record<string, unknown> {
  return {
    founding_offer: true,
    price_locked_pence: FOUNDING_OFFER_PRICE_PENCE,
    price_lock: "while_subscribed",
    entitlement_tier: "professional",
    billing_period: "monthly",
    cancel_forfeits_offer: true,
  };
}

export function foundingCheckoutMetadata(): Record<string, string> {
  return {
    founding_offer: "1",
    price_locked_pence: String(FOUNDING_OFFER_PRICE_PENCE),
    billing_period: "monthly",
  };
}

export function isFoundingOfferSubscription(input: {
  metadataTier?: string | null;
  metadataFoundingOffer?: string | null;
  licenseTier?: string | null;
}): boolean {
  return (
    input.metadataTier === FOUNDING_OFFER_TIER ||
    input.metadataFoundingOffer === "1" ||
    input.licenseTier === FOUNDING_OFFER_TIER
  );
}
