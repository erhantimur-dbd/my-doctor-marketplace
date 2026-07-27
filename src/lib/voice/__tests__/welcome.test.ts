import { describe, expect, it } from "vitest";
import {
  buildVoiceWelcomeBrief,
  DEFAULT_VOICE_REPLY_HINT,
  shouldSpeakVoiceWelcome,
  VOICE_WELCOME_PRODUCT_NAME,
  VOICE_WELCOME_SESSION_KEY,
} from "@/lib/voice/welcome";

describe("buildVoiceWelcomeBrief", () => {
  it("includes product name, search-help intent, and mic/chat reply cue", () => {
    const text = buildVoiceWelcomeBrief();
    expect(text).toContain(VOICE_WELCOME_PRODUCT_NAME);
    expect(text.toLowerCase()).toMatch(/welcome/);
    expect(text.toLowerCase()).toMatch(/specialty|doctor|search|find/);
    expect(text.toLowerCase()).toMatch(
      /location|language|video|in-person|in person/
    );
    // Reply affordance — verbal instruction to press mic or type
    expect(text.toLowerCase()).toMatch(/microphone|mic/);
    expect(text.toLowerCase()).toMatch(/type|chat/);
    expect(text).toContain(
      DEFAULT_VOICE_REPLY_HINT.slice(0, 20)
    );
  });

  it("uses provided i18n copy when present", () => {
    const text = buildVoiceWelcomeBrief({
      greeting: "Welcome to MyDoctors360.",
      brief: "I help you find doctors by specialty and location.",
      replyHint:
        "Press the microphone to reply by voice, or type in the chat.",
    });
    expect(text).toContain("MyDoctors360");
    expect(text).toContain("specialty");
    expect(text).toContain("location");
    expect(text.toLowerCase()).toMatch(/microphone/);
    expect(text.toLowerCase()).toMatch(/type/);
  });
});

describe("shouldSpeakVoiceWelcome", () => {
  it("speaks when not yet played", () => {
    expect(shouldSpeakVoiceWelcome(null)).toBe(true);
    expect(shouldSpeakVoiceWelcome(undefined)).toBe(true);
    expect(shouldSpeakVoiceWelcome("")).toBe(true);
  });

  it("does not re-speak after session flag", () => {
    expect(shouldSpeakVoiceWelcome("1")).toBe(false);
    expect(shouldSpeakVoiceWelcome("true")).toBe(false);
  });

  it("exports a stable session key", () => {
    expect(VOICE_WELCOME_SESSION_KEY).toBe("md360_voice_welcome_played_v1");
  });
});
