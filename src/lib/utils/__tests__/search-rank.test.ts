import { describe, it, expect } from "vitest";
import {
  isActivelyFeatured,
  normalizeFeaturedFlag,
  rankSearchResults,
  rankDoctorIds,
} from "../search-rank";
import { rankDoctorsByInventory } from "@/lib/search/rank";

const now = new Date("2026-07-28T12:00:00.000Z");

describe("isActivelyFeatured", () => {
  it("returns false when not featured", () => {
    expect(isActivelyFeatured({ is_featured: false }, now)).toBe(false);
  });

  it("returns true when featured with no expiry", () => {
    expect(
      isActivelyFeatured({ is_featured: true, featured_until: null }, now)
    ).toBe(true);
  });

  it("returns true when featured_until is in the future", () => {
    expect(
      isActivelyFeatured(
        { is_featured: true, featured_until: "2026-08-28T00:00:00.000Z" },
        now
      )
    ).toBe(true);
  });

  it("returns false when featured_until is past", () => {
    expect(
      isActivelyFeatured(
        { is_featured: true, featured_until: "2026-06-01T00:00:00.000Z" },
        now
      )
    ).toBe(false);
  });
});

describe("normalizeFeaturedFlag", () => {
  it("clears is_featured when expired", () => {
    const result = normalizeFeaturedFlag(
      {
        id: "1",
        is_featured: true,
        featured_until: "2026-01-01T00:00:00.000Z",
      },
      now
    );
    expect(result.is_featured).toBe(false);
  });

  it("keeps is_featured when active", () => {
    const result = normalizeFeaturedFlag(
      {
        id: "1",
        is_featured: true,
        featured_until: "2026-08-01T00:00:00.000Z",
      },
      now
    );
    expect(result.is_featured).toBe(true);
  });
});

describe("rankSearchResults — screenshot regression", () => {
  // James (London, not featured) nearer Islington; William (Birmingham, featured) farther
  const james = {
    id: "james",
    is_featured: false,
    featured_until: null,
    avg_rating: 4.0,
    consultation_fee_cents: 12000,
  };
  const william = {
    id: "william",
    is_featured: true,
    featured_until: "2026-08-28T00:00:00.000Z",
    avg_rating: 4.3,
    consultation_fee_cents: 18000,
  };

  it("pins featured above nearer non-featured when sorting by nearest", () => {
    const distances = new Map([
      ["james", 5],
      ["william", 160],
    ]);
    const ranked = rankSearchResults([james, william], {
      sort: "nearest",
      distances,
      now,
    });
    expect(ranked.map((d) => d.id)).toEqual(["william", "james"]);
  });

  it("pins featured first on default/featured sort with distances", () => {
    const distances = new Map([
      ["james", 5],
      ["william", 160],
    ]);
    const ranked = rankSearchResults([james, william], {
      sort: "featured",
      distances,
      now,
    });
    expect(ranked.map((d) => d.id)).toEqual(["william", "james"]);
  });

  it("pins featured first even on price_asc", () => {
    const ranked = rankSearchResults([james, william], {
      sort: "price_asc",
      now,
    });
    expect(ranked.map((d) => d.id)).toEqual(["william", "james"]);
  });
});

describe("rankSearchResults — multi featured secondary order", () => {
  it("orders multiple featured by nearest among themselves", () => {
    const a = {
      id: "feat-near",
      is_featured: true,
      featured_until: null,
      avg_rating: 4.0,
      consultation_fee_cents: 10000,
    };
    const b = {
      id: "feat-far",
      is_featured: true,
      featured_until: null,
      avg_rating: 5.0,
      consultation_fee_cents: 10000,
    };
    const organic = {
      id: "organic",
      is_featured: false,
      featured_until: null,
      avg_rating: 5.0,
      consultation_fee_cents: 5000,
    };
    const distances = new Map([
      ["feat-near", 3],
      ["feat-far", 40],
      ["organic", 1],
    ]);
    const ranked = rankSearchResults([organic, b, a], {
      sort: "nearest",
      distances,
      now,
    });
    expect(ranked.map((d) => d.id)).toEqual([
      "feat-near",
      "feat-far",
      "organic",
    ]);
  });

  it("orders multiple featured by rating when no distances", () => {
    const low = {
      id: "low",
      is_featured: true,
      featured_until: null,
      avg_rating: 4.0,
      consultation_fee_cents: 10000,
    };
    const high = {
      id: "high",
      is_featured: true,
      featured_until: null,
      avg_rating: 4.9,
      consultation_fee_cents: 10000,
    };
    const ranked = rankSearchResults([low, high], {
      sort: "featured",
      now,
    });
    expect(ranked.map((d) => d.id)).toEqual(["high", "low"]);
  });
});

describe("rankSearchResults — expired featured", () => {
  it("treats expired featured as organic", () => {
    const expired = {
      id: "expired",
      is_featured: true,
      featured_until: "2026-01-01T00:00:00.000Z",
      avg_rating: 5.0,
      consultation_fee_cents: 20000,
    };
    const organicNear = {
      id: "near",
      is_featured: false,
      featured_until: null,
      avg_rating: 3.0,
      consultation_fee_cents: 10000,
    };
    const distances = new Map([
      ["expired", 100],
      ["near", 2],
    ]);
    const ranked = rankSearchResults([expired, organicNear], {
      sort: "nearest",
      distances,
      now,
    });
    expect(ranked.map((d) => d.id)).toEqual(["near", "expired"]);
  });
});

describe("rankDoctorIds", () => {
  it("reorders full ID list featured-first then by distance", () => {
    const ids = ["near-organic", "far-featured", "mid-organic"];
    const flags = [
      { id: "near-organic", is_featured: false, avg_rating: 4 },
      {
        id: "far-featured",
        is_featured: true,
        featured_until: "2026-09-01T00:00:00.000Z",
        avg_rating: 4,
      },
      { id: "mid-organic", is_featured: false, avg_rating: 4 },
    ];
    const distances = new Map([
      ["near-organic", 1],
      ["far-featured", 50],
      ["mid-organic", 10],
    ]);
    expect(
      rankDoctorIds(ids, flags, { sort: "nearest", distances, now })
    ).toEqual(["far-featured", "near-organic", "mid-organic"]);
  });
});

describe("rankDoctorsByInventory (shipped marketplace path)", () => {
  it("GP soonest default: featured later slot still before organic sooner", () => {
    const doctors = [
      { id: "james", avg_rating: 4, is_featured: false, featured_until: null },
      {
        id: "william",
        avg_rating: 4.3,
        is_featured: true,
        featured_until: "2026-08-28T00:00:00.000Z",
      },
    ];
    const earliestMs = (id: string) =>
      id === "james"
        ? Date.parse("2026-07-29T08:00:00Z")
        : Date.parse("2026-07-30T10:00:00Z");
    const { ranked } = rankDoctorsByInventory(
      doctors,
      earliestMs,
      undefined,
      now
    );
    expect(ranked.map((d) => d.id)).toEqual(["william", "james"]);
  });
});
