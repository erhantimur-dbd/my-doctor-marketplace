import { describe, expect, it } from "vitest";
import {
  buildEmptyStateSuggestions,
  emptyStateSuggestionsFromSearchParams,
} from "@/lib/search/empty-state-suggestions";

describe("buildEmptyStateSuggestions", () => {
  it("suggests dropping location and video-only for a tight search", () => {
    const suggestions = buildEmptyStateSuggestions({
      specialty: "general-practice",
      location: "birmingham-uk",
      consultationType: "video",
      availableToday: true,
    });
    const ids = suggestions.map((s) => s.id);
    expect(ids).toContain("drop-today");
    expect(ids).toContain("any-type");
    expect(ids).toContain("wider-area");
    expect(suggestions.every((s) => s.href.startsWith("/doctors"))).toBe(true);
  });

  it("parses from query string", () => {
    const s = emptyStateSuggestionsFromSearchParams(
      "/doctors?specialty=cardiology&location=london-uk&maxPrice=100"
    );
    expect(s.length).toBeGreaterThan(0);
    expect(s.some((x) => x.href.includes("cardiology") || x.id === "wider-area")).toBe(
      true
    );
  });

  it("returns empty when no filters", () => {
    expect(buildEmptyStateSuggestions({})).toEqual([]);
  });
});
