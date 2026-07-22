/**
 * First-use voice privacy consent. Audio is processed (Grok Voice STT/TTS) and never stored.
 * Consent is client-side only (localStorage) — pure storage key + parse helpers for tests.
 */

export const VOICE_PRIVACY_STORAGE_KEY = "md360_voice_privacy_v1";

export type VoicePrivacyConsent = {
  accepted: boolean;
  at: string; // ISO timestamp
};

export function parseVoicePrivacyConsent(
  raw: string | null | undefined
): VoicePrivacyConsent | null {
  if (!raw) return null;
  try {
    const data = JSON.parse(raw) as Partial<VoicePrivacyConsent>;
    if (typeof data.accepted !== "boolean") return null;
    if (typeof data.at !== "string" || !data.at) return null;
    return { accepted: data.accepted, at: data.at };
  } catch {
    return null;
  }
}

export function hasAcceptedVoicePrivacy(
  raw: string | null | undefined
): boolean {
  const parsed = parseVoicePrivacyConsent(raw);
  return parsed?.accepted === true;
}

export function buildVoicePrivacyConsent(
  accepted: boolean,
  now: Date = new Date()
): VoicePrivacyConsent {
  return { accepted, at: now.toISOString() };
}

export function serializeVoicePrivacyConsent(
  consent: VoicePrivacyConsent
): string {
  return JSON.stringify(consent);
}
