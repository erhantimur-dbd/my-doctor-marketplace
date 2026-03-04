export const SUPPORTED_CURRENCIES = ["EUR", "GBP", "TRY", "USD"] as const;
export type SupportedCurrency = (typeof SUPPORTED_CURRENCIES)[number];

export function formatCurrency(
  amountCents: number,
  currency: string,
  locale: string = "en"
): string {
  const localeMap: Record<string, string> = {
    en: "en-GB",
    de: "de-DE",
    tr: "tr-TR",
    fr: "fr-FR",
  };

  return new Intl.NumberFormat(localeMap[locale] || "en-GB", {
    style: "currency",
    currency,
    minimumFractionDigits: currency === "TRY" ? 0 : 2,
  }).format(amountCents / 100);
}

export function centsToAmount(cents: number): number {
  return cents / 100;
}

export function amountToCents(amount: number): number {
  return Math.round(amount * 100);
}

/* ── Booking fee conversion ─────────────────────────────────
 * The patient booking fee is £4.95 GBP. For non-GBP doctors the
 * fee is converted using approximate exchange rates.
 * Rates should be updated periodically to stay close to market.
 * Last updated: 2026-03-04
 * ─────────────────────────────────────────────────────────── */
const BOOKING_FEE_GBP_CENTS = 495; // £4.95

// Source: Frankfurter API (ECB reference rates) — https://api.frankfurter.dev
const GBP_EXCHANGE_RATES: Record<string, number> = {
  GBP: 1.0,
  EUR: 1.15,   // 1 GBP ≈ 1.1472 EUR (rounded)
  USD: 1.33,   // 1 GBP ≈ 1.3314 USD (rounded)
  TRY: 58.55,  // 1 GBP ≈ 58.553 TRY
};

/**
 * Returns the patient booking fee in cents for the given currency.
 * Base fee is £4.95 GBP, converted at approximate exchange rates.
 *
 * Examples: GBP → 495, EUR → 569, USD → 663, TRY → 29205
 */
export function getBookingFeeCents(currency: string): number {
  const rate = GBP_EXCHANGE_RATES[currency] ?? 1.0;
  return Math.round(BOOKING_FEE_GBP_CENTS * rate);
}
