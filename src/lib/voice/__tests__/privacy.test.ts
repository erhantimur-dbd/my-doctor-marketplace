import { describe, expect, it } from "vitest";
import {
  buildVoicePrivacyConsent,
  hasAcceptedVoicePrivacy,
  parseVoicePrivacyConsent,
  serializeVoicePrivacyConsent,
  VOICE_PRIVACY_STORAGE_KEY,
} from "@/lib/voice/privacy";

describe("voice privacy consent", () => {
  it("uses a stable storage key", () => {
    expect(VOICE_PRIVACY_STORAGE_KEY).toBe("md360_voice_privacy_v1");
  });

  it("round-trips accepted consent", () => {
    const consent = buildVoicePrivacyConsent(true, new Date("2026-07-22T12:00:00Z"));
    const raw = serializeVoicePrivacyConsent(consent);
    expect(hasAcceptedVoicePrivacy(raw)).toBe(true);
    expect(parseVoicePrivacyConsent(raw)).toEqual({
      accepted: true,
      at: "2026-07-22T12:00:00.000Z",
    });
  });

  it("treats declined / invalid as not accepted", () => {
    expect(hasAcceptedVoicePrivacy(null)).toBe(false);
    expect(hasAcceptedVoicePrivacy("")).toBe(false);
    expect(hasAcceptedVoicePrivacy("{bad")).toBe(false);
    const declined = serializeVoicePrivacyConsent(
      buildVoicePrivacyConsent(false, new Date("2026-07-22T12:00:00Z"))
    );
    expect(hasAcceptedVoicePrivacy(declined)).toBe(false);
  });
});
