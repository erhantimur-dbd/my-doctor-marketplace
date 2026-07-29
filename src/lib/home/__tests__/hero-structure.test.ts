import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Structural contract for Doctify Image #1 layout:
 * single-line H1 (prefix + inline rotating role) + secondary Book Instantly line.
 * Reads the real shipped component source.
 */
describe("HeroRotatingTitle structure (Doctify single-line)", () => {
  const componentPath = path.resolve(
    __dirname,
    "../../../components/home/hero-rotating-title.tsx"
  );
  const source = readFileSync(componentPath, "utf8");

  it("declares lead-in, role, and second-line parts", () => {
    expect(source).toContain('data-hero-part="lead-in"');
    expect(source).toContain('data-hero-part="role"');
    expect(source).toContain('data-hero-part="second-line"');
  });

  it("uses single-line Doctify-inline layout (not stacked lead-in above role)", () => {
    expect(source).toContain('data-hero-layout="doctify-inline"');
    // Phrase joining: lead-in and role live inside the same h1 / inline-flex
    expect(source).toMatch(
      /<h1[^>]*data-hero-layout="doctify-inline"|data-hero-layout="doctify-inline"[\s\S]{0,80}className=/
    );
    expect(source).toMatch(/inline-flex[\s\S]*data-hero-part="lead-in"/);
    expect(source).toMatch(
      /data-hero-part="lead-in"[\s\S]*data-hero-part="role"/
    );
    // Second line is a sibling after </h1>, not a third equal-weight stack title
    expect(source).toMatch(/<\/h1>[\s\S]*data-hero-part="second-line"/);
    // Must not use flex-col stacking for lead-in above role inside h1
    expect(source).not.toMatch(
      /data-hero-layout="doctify-stack"|flex-col[\s\S]{0,120}data-hero-part="lead-in"[\s\S]{0,80}data-hero-part="role"/
    );
  });

  it("emphasizes the rotating role with accent color (not only underline)", () => {
    // Accent color class on the role word (amber / contrast on blue hero)
    expect(source).toMatch(/text-amber-200|text-yellow|text-fuchsia|text-violet|text-purple/);
    // Must not be white-only underline emphasis as sole treatment for role
    expect(source).not.toMatch(
      /roleClass\s*=\s*["'][^"']*text-white[^"']*underline/
    );
  });

  it("uses cycle helpers and a11y", () => {
    expect(source).toContain("@/lib/home/hero-rotating-words");
    expect(source).toMatch(/nextHeroWordIndex/);
    expect(source).toMatch(/longestHeroWord/);
    expect(source).toMatch(/useReducedMotion|reduceMotion/);
    expect(source).toContain('aria-live="polite"');
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
    const specialty = en.home.hero_rotating_words.some(
      (w) => w !== "Doctor" && w !== "GP"
    );
    expect(specialty).toBe(true);
  });
});
