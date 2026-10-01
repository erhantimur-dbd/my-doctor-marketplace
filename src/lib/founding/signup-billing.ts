import type { BillingPeriod } from "@/lib/constants/billing-period";

/**
 * Founding is monthly only. A `?billing=annual` link or the annual toggle
 * must not present that plan as 10 months for 12.
 */
export function signupBillingPeriod(input: {
  monthlyOnly: boolean;
  requested: BillingPeriod;
}): BillingPeriod {
  if (input.monthlyOnly) return "monthly";
  return input.requested === "annual" ? "annual" : "monthly";
}

/** Search params for /register-doctor. Legacy tier=free still opens founding, monthly. */
export function signupBillingPeriodFromSearch(input: {
  tier: string | null;
  founding: string | null;
  billing: string | null;
}): { tierLockedMonthly: boolean; period: BillingPeriod } {
  const foundingOffer =
    input.founding === "1" ||
    input.tier === "founding" ||
    input.tier === "free";
  if (foundingOffer) {
    return { tierLockedMonthly: true, period: "monthly" };
  }
  if (input.billing === "annual") {
    return { tierLockedMonthly: false, period: "annual" };
  }
  return { tierLockedMonthly: false, period: "monthly" };
}
