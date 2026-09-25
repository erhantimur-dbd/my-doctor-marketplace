import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  isNaturalLanguageSearchEnabled,
  NL_SEARCH_DISABLED_MESSAGE,
} from "@/lib/launch/soft-launch";

function aiActionSource(): { src: string; fn: string } {
  const src = readFileSync(join(process.cwd(), "src/actions/ai.ts"), "utf8");
  const start = src.indexOf("export async function parseNaturalLanguageSearch");
  expect(start).toBeGreaterThan(-1);
  return { src, fn: src.slice(start) };
}

describe("parseNaturalLanguageSearch spend fuse", () => {
  it("is hard-off, independent of the search-bar coming-soon hide", () => {
    expect(isNaturalLanguageSearchEnabled()).toBe(false);
    expect(NL_SEARCH_DISABLED_MESSAGE).toMatch(/unavailable/i);
    expect(NL_SEARCH_DISABLED_MESSAGE).not.toMatch(/upgrade|unlock/i);
  });

  it("gates, classifies emergencies, and rate-limits before the metered model call", () => {
    const { fn } = aiActionSource();
    const gate = fn.indexOf("isNaturalLanguageSearchEnabled");
    const emergency = fn.indexOf("detectEmergency(");
    const limit = fn.indexOf("rateLimit(");
    const local = fn.indexOf("tryLocalNlSearch(");
    const model = fn.indexOf('generateMeteredObject("nl_search"');
    expect(gate).toBeGreaterThan(-1);
    expect(emergency).toBeGreaterThan(gate);
    expect(limit).toBeGreaterThan(emergency);
    expect(local).toBeGreaterThan(limit);
    expect(model).toBeGreaterThan(local);
    expect(fn.indexOf("getActiveLocations(")).toBeGreaterThan(emergency);
    expect(fn).toContain('meterNlSearch("emergency")');
    expect(fn).toContain('meterNlSearch("local")');
    expect(fn).toContain('meterNlSearch("cache")');
    // model / model_error are recorded inside generateMeteredObject,
    // which also forces maxRetries to 0. A second meter line double-counts.
    expect(fn).not.toContain('meterNlSearch("model"');
    expect(fn).not.toContain("maxRetries");
    expect(fn).not.toContain("generateObject(");
    expect(fn).not.toContain("Available locations");
    expect(fn).not.toContain("input_text");
    expect(fn).not.toContain("console.log");
    expect(fn).not.toContain("substring(");
  });
});
