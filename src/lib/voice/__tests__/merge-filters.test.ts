import { describe, expect, it } from "vitest";
import {
  buildSearchResultsSpokenSummary,
  mergeSearchFilters,
} from "@/lib/voice/merge-filters";

describe("mergeSearchFilters", () => {
  it("merges refine on top of current listing filters", () => {
    const current = {
      specialty: "general-practice",
      location: "birmingham-uk",
      consultationType: "in_person",
    };
    const merged = mergeSearchFilters(current, {
      consultationType: "video",
      sort: "soonest",
    });
    expect(merged.specialty).toBe("general-practice");
    expect(merged.location).toBe("birmingham-uk");
    expect(merged.consultationType).toBe("video");
    expect(merged.sort).toBe("soonest");
  });

  it("clears a field when patch is null", () => {
    const merged = mergeSearchFilters(
      { specialty: "cardiology", language: "Turkish" },
      { language: null }
    );
    expect(merged.specialty).toBe("cardiology");
    expect(merged.language).toBeUndefined();
  });
});

describe("buildSearchResultsSpokenSummary", () => {
  it("explains zero results", () => {
    const s = buildSearchResultsSpokenSummary({ total: 0 });
    expect(s.toLowerCase()).toMatch(/could not find|no matching|0/);
  });

  it("mentions count, specialty, location, and refine hint", () => {
    const s = buildSearchResultsSpokenSummary({
      total: 5,
      specialtyLabel: "General Practice",
      locationLabel: "Birmingham",
      consultationType: "video",
      sampleNames: ["Dr. Smith"],
    });
    expect(s).toMatch(/5/);
    expect(s).toMatch(/General Practice/);
    expect(s).toMatch(/Birmingham/);
    expect(s.toLowerCase()).toMatch(/video/);
    expect(s.toLowerCase()).toMatch(/refine|language|soonest|price/);
  });
});
