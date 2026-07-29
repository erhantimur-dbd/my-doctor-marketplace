import { describe, it, expect } from "vitest";
import { DEFAULT_BLOCKED_KEYWORDS } from "../blocked-keywords";

/**
 * Pure helpers for keyword matching — mirrors checkReviewKeywords logic
 * without hitting the database.
 */
function matchKeywords(
  title: string | null,
  comment: string | null,
  blocked: string[] = DEFAULT_BLOCKED_KEYWORDS
) {
  const text = [title ?? "", comment ?? ""].join(" ").toLowerCase();
  if (!text.trim()) return { passed: true, flaggedKeywords: [] as string[] };
  const flaggedKeywords = blocked.filter((keyword) => text.includes(keyword));
  return {
    passed: flaggedKeywords.length === 0,
    flaggedKeywords,
  };
}

describe("review keyword filter", () => {
  it("passes clean positive reviews", () => {
    const result = matchKeywords(
      "Excellent doctor",
      "Very professional and caring"
    );
    expect(result.passed).toBe(true);
    expect(result.flaggedKeywords).toHaveLength(0);
  });

  it("flags scam / fraud language", () => {
    const result = matchKeywords("Scam", "This is a complete fraud");
    expect(result.passed).toBe(false);
    expect(result.flaggedKeywords).toEqual(
      expect.arrayContaining(["scam", "fraud"])
    );
  });

  it("is case-insensitive", () => {
    const result = matchKeywords(null, "Absolute SCAM of a clinic");
    expect(result.passed).toBe(false);
    expect(result.flaggedKeywords).toContain("scam");
  });

  it("flags legal threat phrases", () => {
    const result = matchKeywords("Going to sue", "I will call my lawyer");
    expect(result.passed).toBe(false);
    expect(result.flaggedKeywords).toEqual(
      expect.arrayContaining(["sue", "lawyer"])
    );
  });

  it("passes empty content", () => {
    expect(matchKeywords(null, null).passed).toBe(true);
    expect(matchKeywords("", "   ").passed).toBe(true);
  });

  it("respects a custom blocklist", () => {
    const result = matchKeywords("Nice", "great visit", ["nice"]);
    expect(result.passed).toBe(false);
    expect(result.flaggedKeywords).toEqual(["nice"]);
  });
});
