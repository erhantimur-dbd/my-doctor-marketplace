import { describe, expect, it } from "vitest";
import { DEFAULT_BCP47, localeToBcp47 } from "@/lib/voice/locale";

describe("localeToBcp47", () => {
  it("maps known app locales", () => {
    expect(localeToBcp47("en")).toBe("en-GB");
    expect(localeToBcp47("de")).toBe("de-DE");
    expect(localeToBcp47("tr")).toBe("tr-TR");
    expect(localeToBcp47("fr")).toBe("fr-FR");
  });

  it("passes through en-GB / en-IE", () => {
    expect(localeToBcp47("en-GB")).toBe("en-GB");
    expect(localeToBcp47("en-IE")).toBe("en-IE");
  });

  it("falls back for unknown locales", () => {
    expect(localeToBcp47(undefined)).toBe(DEFAULT_BCP47);
    expect(localeToBcp47(null)).toBe(DEFAULT_BCP47);
    expect(localeToBcp47("xx")).toBe(DEFAULT_BCP47);
  });

  it("uses base language for unlisted region variants", () => {
    expect(localeToBcp47("de-AT")).toBe("de-DE");
  });
});
