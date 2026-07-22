/**
 * Map next-intl / app locale codes to BCP-47 tags for STT/TTS and date formatting.
 * Pure helper — unit-testable without browser APIs.
 */
const LOCALE_TO_BCP47: Record<string, string> = {
  en: "en-GB",
  "en-GB": "en-GB",
  "en-IE": "en-IE",
  de: "de-DE",
  tr: "tr-TR",
  fr: "fr-FR",
  es: "es-ES",
  it: "it-IT",
  pt: "pt-PT",
  pl: "pl-PL",
  ja: "ja-JP",
  zh: "zh-CN",
};

/** Default when locale is unknown. */
export const DEFAULT_BCP47 = "en-GB";

/**
 * Resolve an app locale (e.g. `de`, `en-GB`) to a BCP-47 language tag.
 */
export function localeToBcp47(locale: string | null | undefined): string {
  if (!locale) return DEFAULT_BCP47;
  if (LOCALE_TO_BCP47[locale]) return LOCALE_TO_BCP47[locale];
  // Strip region variants we don't list: "de-AT" → try "de"
  const base = locale.split("-")[0];
  return LOCALE_TO_BCP47[base] || DEFAULT_BCP47;
}
