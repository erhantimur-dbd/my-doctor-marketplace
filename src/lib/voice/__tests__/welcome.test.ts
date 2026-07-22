import { describe, expect, it } from "vitest";
import {
  buildVoiceWelcomeBrief,
  shouldSpeakVoiceWelcome,
  VOICE_WELCOME_PRODUCT_NAME,
  VOICE_WELCOME_SESSION_KEY,
} from "@/lib/voice/welcome";

describe("buildVoiceWelcomeBrief", () => {
  it("includes product name and search-help intent in default English", () => {
    const text = buildVoiceWelcomeBrief();
    expect(text).toContain(VOICE_WELCOME_PRODUCT_NAME);
    expect(text.toLowerCase()).toMatch(/welcome/);
    // Search-help capabilities
    expect(text.toLowerCase()).toMatch(/specialty|doctor|search|find/);
    expect(text.toLowerCase()).toMatch(/location|language|video|in-person|in person/);
  });

  it("uses provided i18n copy when present", () => {
    const text = buildVoiceWelcomeBrief({
      greeting: "Welcome to MyDoctors360.",
      brief: "I help you find doctors by specialty and location.",
    });
    expect(text).toContain("MyDoctors360");
    expect(text).toContain("specialty");
    expect(text).toContain("location");
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
