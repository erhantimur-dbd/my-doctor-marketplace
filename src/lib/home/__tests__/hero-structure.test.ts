import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Structural contract: the shipped hero component must expose Doctify-style
 * stacked regions (lead-in, role, second-line) with distinct typography roles.
 * Reads the real component source — not a reimplementation.
 */
describe("HeroRotatingTitle structure (Doctify stack)", () => {
  const componentPath = path.resolve(
    __dirname,
    "../../../components/home/hero-rotating-title.tsx"
  );
  const source = readFileSync(componentPath, "utf8");

  it("declares three explicit hero parts", () => {
    expect(source).toContain('data-hero-part="lead-in"');
    expect(source).toContain('data-hero-part="role"');
    expect(source).toContain('data-hero-part="second-line"');
  });

  it("uses cycle helpers from the pure module", () => {
    expect(source).toContain("@/lib/home/hero-rotating-words");
    expect(source).toMatch(/nextHeroWordIndex/);
    expect(source).toMatch(/longestHeroWord/);
  });

  it("keeps reduced-motion and aria-live on the role", () => {
    expect(source).toMatch(/useReducedMotion|reduceMotion/);
    expect(source).toContain('aria-live="polite"');
  });

  it("sizes the role larger than the lead-in (centerpiece)", () => {
    // Lead-in uses smaller type (text-2xl / md:text-4xl)
    expect(source).toMatch(/data-hero-part="lead-in"[\s\S]*?text-2xl/);
    // Role is the large centerpiece (text-5xl / md:text-7xl)
    expect(source).toMatch(/data-hero-part="role"[\s\S]*?text-5xl/);
    // Second line is secondary (text-xl / md:text-3xl)
    expect(source).toMatch(/data-hero-part="second-line"[\s\S]*?text-xl/);
  });
});

describe("EN home hero message keys", () => {
  const enPath = path.resolve(__dirname, "../../../../messages/en.json");
  const en = JSON.parse(readFileSync(enPath, "utf8")) as {
    home: {
      hero_title_prefix: string;
      hero_title_second_line: string;
      hero_rotating_words: string[];
    };
  };

  it("supplies prefix, ≥5 roles including Doctor, and Book Instantly", () => {
    expect(en.home.hero_title_prefix.toLowerCase()).toContain("trusted");
    expect(en.home.hero_title_second_line).toBe("Book Instantly");
    expect(en.home.hero_rotating_words.length).toBeGreaterThanOrEqual(5);
    expect(en.home.hero_rotating_words).toContain("Doctor");
    // At least one specialty-style role beyond generic Doctor/GP
    const specialty = en.home.hero_rotating_words.some(
      (w) => w !== "Doctor" && w !== "GP"
    );
    expect(specialty).toBe(true);
  });
});
