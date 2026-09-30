/**
 * Launch currencies for a new practice.
 *
 * GBP is the only enabled currency. EUR is next and USD later. Turn a
 * currency on by adding its code to ENABLED_CURRENCIES — country mappings
 * below already name the currency each country would use.
 *
 * currencyForCountry returns null when the country is missing, not in the
 * map, or mapped to a currency that is not enabled. Callers must then omit
 * base_currency so the existing database default still applies
 * (organizations.base_currency defaults to EUR). That is the behaviour
 * before this helper: sign-up did not set the organisation currency.
 */

export const ENABLED_CURRENCIES = ["GBP"] as const;

export type EnabledCurrency = (typeof ENABLED_CURRENCIES)[number];

/** Country code (ISO 3166-1 alpha-2) → billing currency. */
export const COUNTRY_CURRENCY = {
  GB: "GBP",
  // EUR launch. Stays off until "EUR" is added to ENABLED_CURRENCIES.
  IE: "EUR",
  DE: "EUR",
  FR: "EUR",
  ES: "EUR",
  IT: "EUR",
  NL: "EUR",
  PT: "EUR",
  AT: "EUR",
  BE: "EUR",
  // USD later. Stays off until "USD" is added to ENABLED_CURRENCIES.
  US: "USD",
} as const;

export type MappedCurrency = (typeof COUNTRY_CURRENCY)[keyof typeof COUNTRY_CURRENCY];

export function currencyForCountry(
  countryCode: string | null | undefined
): EnabledCurrency | null {
  const code = countryCode?.trim().toUpperCase();
  if (!code) return null;
  const currency = COUNTRY_CURRENCY[code as keyof typeof COUNTRY_CURRENCY];
  if (!currency) return null;
  if (!(ENABLED_CURRENCIES as readonly string[]).includes(currency)) {
    return null;
  }
  return currency as EnabledCurrency;
}
