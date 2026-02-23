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
