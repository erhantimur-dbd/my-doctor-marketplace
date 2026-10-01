/**
 * A referral "1 month free" is a 100% coupon for one invoice.
 * The founding plan stays £99 for as long as it is kept, so that coupon
 * must not land on a founding subscription.
 */
export function referralMonthFreeAppliesToTier(
  tier: string | null | undefined
): boolean {
  return tier !== "founding";
}

export function referralMonthFreeAppliesToCheckout(input: {
  tier?: string | null;
  priceId?: string | null;
  foundingPriceId?: string | null;
}): boolean {
  if (!referralMonthFreeAppliesToTier(input.tier)) return false;
  if (
    input.foundingPriceId &&
    input.priceId &&
    input.priceId === input.foundingPriceId
  ) {
    return false;
  }
  return true;
}
