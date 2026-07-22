/**
 * Grok Voice (xAI) helpers — STT + TTS use XAI_API_KEY, not OpenAI.
 * @see https://docs.x.ai/developers/model-capabilities/audio/voice
 */

export const XAI_API_BASE = "https://api.x.ai/v1";

/** Default Grok TTS voice (multilingual, neutral). */
export const GROK_DEFAULT_VOICE_ID = "eve";

/**
 * Voice APIs require an xAI API key. Chat/symptom AI may still use OPENAI separately.
 */
export function isGrokVoiceEnabled(): boolean {
  return !!process.env.XAI_API_KEY?.trim();
}

export function getXaiApiKey(): string | null {
  const key = process.env.XAI_API_KEY?.trim();
  return key || null;
}

/**
 * Map app locale → TTS/STT language code accepted by Grok Voice
 * (typically ISO 639-1, e.g. "en", "de", "tr").
 */
export function localeToGrokLanguage(locale: string | null | undefined): string {
  if (!locale) return "en";
  const base = locale.split("-")[0]?.toLowerCase() || "en";
  const supported = new Set([
    "en",
    "de",
    "tr",
    "fr",
    "es",
    "it",
    "pt",
    "pl",
    "ja",
    "zh",
    "ar",
    "hi",
    "ko",
    "nl",
    "ru",
  ]);
  return supported.has(base) ? base : "en";
}
