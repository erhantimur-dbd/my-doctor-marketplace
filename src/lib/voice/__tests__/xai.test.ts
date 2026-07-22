import { describe, expect, it } from "vitest";
import {
  GROK_DEFAULT_VOICE_ID,
  localeToGrokLanguage,
  XAI_API_BASE,
} from "@/lib/voice/xai";

describe("Grok Voice xAI helpers", () => {
  it("points at the xAI API base", () => {
    expect(XAI_API_BASE).toBe("https://api.x.ai/v1");
  });

  it("defaults TTS voice to eve", () => {
    expect(GROK_DEFAULT_VOICE_ID).toBe("eve");
  });

  it("maps app locales to Grok language codes", () => {
    expect(localeToGrokLanguage("en")).toBe("en");
    expect(localeToGrokLanguage("en-GB")).toBe("en");
    expect(localeToGrokLanguage("de")).toBe("de");
    expect(localeToGrokLanguage("tr")).toBe("tr");
    expect(localeToGrokLanguage(undefined)).toBe("en");
    expect(localeToGrokLanguage("xx")).toBe("en");
  });
});
