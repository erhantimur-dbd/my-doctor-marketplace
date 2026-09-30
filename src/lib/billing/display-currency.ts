import {
  COUNTRY_CURRENCY,
  DEFAULT_CURRENCY,
  ENABLED_CURRENCIES,
} from "@/lib/billing/currency-for-country";
import { localeToCountryCode } from "@/lib/gp/market-country";

/** Choices the header selector can offer. Filtered by ENABLED_CURRENCIES. */
export const DISPLAY_CURRENCY_CHOICES = [
  { code: "GBP", symbol: "£", label: "GBP (£)" },
  { code: "EUR", symbol: "€", label: "EUR (€)" },
  { code: "USD", symbol: "$", label: "USD ($)" },
] as const;

export type DisplayCurrencyCode =
  (typeof DISPLAY_CURRENCY_CHOICES)[number]["code"];

function countryCurrency(countryCode: string | null | undefined): string | null {
  const code = countryCode?.trim().toUpperCase();
  if (!code) return null;
  return COUNTRY_CURRENCY[code as keyof typeof COUNTRY_CURRENCY] ?? null;
}

function isEnabled(currency: string | null | undefined): currency is DisplayCurrencyCode {
  return (
    !!currency &&
    (ENABLED_CURRENCIES as readonly string[]).includes(currency)
  );
}

/**
 * Currency to show for licence and marketing prices.
 *
 * An explicit country wins. Otherwise the locale is mapped with
 * localeToCountryCode and then through the same country→currency map as
 * currencyForCountry. The mapped currency is returned only when it is
 * enabled. Otherwise DEFAULT_CURRENCY (GBP). Adding "EUR" to
 * ENABLED_CURRENCIES is what turns euro display on.
 */
export function displayCurrency(input: {
  locale?: string | null;
  country?: string | null;
}): DisplayCurrencyCode {
  const country =
    input.country?.trim() ||
    (input.locale ? localeToCountryCode(input.locale) : "");
  const mapped = countryCurrency(country);
  if (isEnabled(mapped)) return mapped;
  return DEFAULT_CURRENCY;
}

/**
 * Cookie override for displayCurrency. A stored code is used only when
 * that currency is enabled. Anything else is ignored and should be cleared.
 */
export function resolveDisplayCurrency(input: {
  locale?: string | null;
  country?: string | null;
  stored?: string | null;
}): { currency: DisplayCurrencyCode; clearStored: boolean } {
  const stored = input.stored?.trim().toUpperCase() ?? "";
  if (isEnabled(stored)) {
    return { currency: stored, clearStored: false };
  }
  return {
    currency: displayCurrency({
      locale: input.locale,
      country: input.country,
    }),
    clearStored: stored.length > 0,
  };
}

/** Header selector rows. Empty of every currency that checkout cannot charge. */
export function enabledDisplayCurrencyOptions() {
  return DISPLAY_CURRENCY_CHOICES.filter((choice) => isEnabled(choice.code));
}
