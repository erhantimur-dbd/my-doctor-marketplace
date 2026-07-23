/**
 * Monthly vs annual licence billing.
 * Annual = 2 months free → charge 10 months, bill once per year.
 */

export type BillingPeriod = "monthly" | "annual";

/** Months free when paying annually */
export const ANNUAL_FREE_MONTHS = 2;

/** Months charged when paying annually (12 − free) */
export const ANNUAL_BILLED_MONTHS = 12 - ANNUAL_FREE_MONTHS; // 10

/** Discount percent for annual vs 12× monthly (e.g. 2/12 ≈ 16.67%) */
export function annualDiscountPercent(): number {
  return Math.round((ANNUAL_FREE_MONTHS / 12) * 1000) / 10;
}

/**
 * Total amount charged once per year (GBP pence), from monthly pence.
 * Equals 10 × monthly (2 months free).
 */
export function annualTotalPence(monthlyPence: number): number {
  if (monthlyPence <= 0) return 0;
  return monthlyPence * ANNUAL_BILLED_MONTHS;
}

/**
 * Effective per-month amount when billed annually (for comparison display).
 */
export function annualEffectiveMonthlyPence(monthlyPence: number): number {
  if (monthlyPence <= 0) return 0;
  return Math.round(annualTotalPence(monthlyPence) / 12);
}

export function isBillingPeriod(v: string | null | undefined): v is BillingPeriod {
  return v === "monthly" || v === "annual";
}
