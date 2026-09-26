/**
 * Whole pounds render as £1,990. Amounts with pence render as £1,492.50.
 */
export function formatGbpFromPence(pence: number): string {
  const hasPence = pence % 100 !== 0;
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
    minimumFractionDigits: hasPence ? 2 : 0,
    maximumFractionDigits: hasPence ? 2 : 0,
  }).format(pence / 100);
}

/** First annual invoice after a percent-off coupon (duration once). */
export function firstYearPence(fullAnnualPence: number, percentOff: number): number {
  if (fullAnnualPence <= 0) return 0;
  const kept = 100 - percentOff;
  return Math.round((fullAnnualPence * kept) / 100);
}

export function poundsToPence(pounds: number): number | null {
  if (!Number.isFinite(pounds) || pounds <= 0) return null;
  const pence = Math.round(pounds * 100);
  if (pence <= 0) return null;
  return pence;
}
