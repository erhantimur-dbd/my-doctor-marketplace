/**
 * Pure helpers for the unified chat+voice agent welcome brief.
 * Used by ChatWindow on voice-session start and unit-tested without a browser.
 */

export const VOICE_WELCOME_PRODUCT_NAME = "MyDoctors360";

export type VoiceWelcomeCopy = {
  /** Short greeting line including product name */
  greeting: string;
  /** How the agent can help with search */
  brief: string;
};

/**
 * Build the full spoken/shown welcome brief for the voice agent.
 * Prefer i18n strings from the caller; falls back to English if missing.
 */
export function buildVoiceWelcomeBrief(
  copy?: Partial<VoiceWelcomeCopy> | null
): string {
  const greeting =
    copy?.greeting?.trim() ||
    `Welcome to ${VOICE_WELCOME_PRODUCT_NAME}.`;
  const brief =
    copy?.brief?.trim() ||
    "I can help you find a private doctor by specialty, location, language, or video versus in-person. Tell me what you need, and I will search and refine results with you.";
  return `${greeting} ${brief}`.replace(/\s+/g, " ").trim();
}

/**
 * Whether we should play the welcome when a voice session starts.
 * Once per browser session; pure over storage value.
 */
export function shouldSpeakVoiceWelcome(
  alreadyPlayedRaw: string | null | undefined
): boolean {
  return alreadyPlayedRaw !== "1" && alreadyPlayedRaw !== "true";
}

export const VOICE_WELCOME_SESSION_KEY = "md360_voice_welcome_played_v1";
