import { describe, it, expect } from "vitest";
import {
  matchKeywordSpecialty,
  KEYWORD_SPECIALTY_MAP,
} from "@/lib/search/keyword-specialty-map";
import {
  resolveSearchIntent,
  defaultMarketplaceSort,
  isUserExplicitSort,
} from "@/lib/search/resolve-intent";
import {
  rankDoctorsByInventory,
  buildEarliestMsFn,
  pinActiveFeaturedFirst,
  isActivelyFeatured,
} from "@/lib/search/rank";
import {
  recoveryStepsFor,
  relatedSpecialtiesForRecovery,
  shouldRunRecovery,
  SOFT_FAIL_REASONS_MUST_RECOVER,
  isSpecialtyPreservingRecovery,
  forbiddenPrimaryForDermatology,
  widenRadiusSteps,
  fullyBookedBanner,
  platformEmptyBanner,
} from "@/lib/search/recover-policy";

describe("resolve intent (keyword → specialty)", () => {
  it("maps acne to dermatology (not GP-first)", () => {
    const m = matchKeywordSpecialty("acne treatment");
    expect(m?.primary).toBe("dermatology");
    expect(m?.specialist).toBe("dermatology");
  });

  it("maps rash with GP primary and dermatology specialist", () => {
    const m = matchKeywordSpecialty("bad rash on arm");
    expect(m?.primary).toBe("general-practice");
    expect(m?.specialist).toBe("dermatology");
  });

  it("resolveSearchIntent prefers explicit specialty over query", () => {
    const intent = resolveSearchIntent({
      specialty: "dermatology",
      query: "teeth",
    });
    expect(intent.primarySpecialty).toBe("dermatology");
    expect(intent.keywordSpecialtySlugs).toEqual([]);
  });

  it("resolveSearchIntent from acne query", () => {
    const intent = resolveSearchIntent({ query: "acne" });
    expect(intent.primarySpecialty).toBe("dermatology");
    expect(intent.matchedSpecialtySlug).toBe("dermatology");
  });

  it("never maps acne keyword to dentistry", () => {
    const m = KEYWORD_SPECIALTY_MAP.acne;
    expect(m.primary).not.toBe("dentistry");
    expect(m.specialist).not.toBe("dentistry");
  });
});

describe("default marketplace sort", () => {
  it("defaults to soonest when specialty set", () => {
    expect(defaultMarketplaceSort({ specialty: "dermatology" })).toBe(
      "soonest"
    );
  });

  it("defaults to featured for open browse", () => {
    expect(defaultMarketplaceSort({})).toBe("featured");
  });

  it("respects explicit user sort", () => {
    expect(
      defaultMarketplaceSort({ specialty: "dermatology", sort: "price_asc" })
    ).toBe("price_asc");
  });

  it("treats price/rating as user-explicit (skip inventory re-rank)", () => {
    expect(isUserExplicitSort("price_asc")).toBe(true);
    expect(isUserExplicitSort("soonest")).toBe(false);
    expect(isUserExplicitSort("featured")).toBe(false);
  });
});

describe("inventory ranking", () => {
  it("pins active featured above non-featured even when featured is fully booked", () => {
    // Paid Featured boost always pins first among filter-matching results;
    // inventory (soonest) is secondary within each featured/organic group.
    const doctors = [
      { id: "a", avg_rating: 5, is_featured: true, featured_until: null },
      { id: "b", avg_rating: 3, is_featured: false },
      { id: "c", avg_rating: 4, is_featured: false },
    ];
    const earliestMs = (id: string) => {
      if (id === "b") return Date.parse("2026-08-01T10:00:00Z");
      if (id === "c") return Date.parse("2026-08-02T10:00:00Z");
      return Infinity; // a fully booked
    };
    const { ranked, doctorIdsFullyBooked } = rankDoctorsByInventory(
      doctors,
      earliestMs
    );
    expect(ranked.map((d) => d.id)).toEqual(["a", "b", "c"]);
    expect(doctorIdsFullyBooked).toEqual(["a"]);
  });

  it("among organic bookable, sorts soonest first then distance", () => {
    const doctors = [
      { id: "far-soon", avg_rating: 5, is_featured: false },
      { id: "near-later", avg_rating: 5, is_featured: false },
    ];
    const earliestMs = (id: string) =>
      id === "far-soon"
        ? Date.parse("2026-08-01T09:00:00Z")
        : Date.parse("2026-08-03T09:00:00Z");
    const distances = new Map([
      ["far-soon", 80],
      ["near-later", 5],
    ]);
    // soonest wins over distance within same featured tier
    const { ranked } = rankDoctorsByInventory(
      doctors,
      earliestMs,
      distances
    );
    expect(ranked[0].id).toBe("far-soon");
  });

  it("pins featured later-slot above non-featured sooner-slot (GP soonest default)", () => {
    const doctors = [
      {
        id: "james",
        avg_rating: 4,
        is_featured: false,
        featured_until: null,
      },
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
      new Date("2026-07-28T12:00:00.000Z")
    );
    expect(ranked.map((d) => d.id)).toEqual(["william", "james"]);
  });

  it("treats expired featured as organic", () => {
    const doctors = [
      {
        id: "expired",
        avg_rating: 5,
        is_featured: true,
        featured_until: "2026-01-01T00:00:00.000Z",
      },
      {
        id: "organic",
        avg_rating: 3,
        is_featured: false,
        featured_until: null,
      },
    ];
    const earliestMs = (id: string) =>
      id === "organic"
        ? Date.parse("2026-07-29T08:00:00Z")
        : Date.parse("2026-08-01T08:00:00Z");
    const { ranked } = rankDoctorsByInventory(
      doctors,
      earliestMs,
      undefined,
      new Date("2026-07-28T12:00:00.000Z")
    );
    expect(ranked.map((d) => d.id)).toEqual(["organic", "expired"]);
  });

  it("buildEarliestMsFn picks min of in-person and video", () => {
    const fn = buildEarliestMsFn(
      {
        d1: { slots: [{ start: "2026-08-10T12:00:00Z" }] },
      },
      {
        d1: { slots: [{ start: "2026-08-05T12:00:00Z" }] },
      }
    );
    expect(fn("d1")).toBe(Date.parse("2026-08-05T12:00:00Z"));
    expect(fn("missing")).toBe(Infinity);
  });

  it("pinActiveFeaturedFirst stable-partitions featured ahead of organic", () => {
    const now = new Date("2026-07-28T12:00:00.000Z");
    const doctors = [
      { id: "j", is_featured: false, featured_until: null },
      {
        id: "w",
        is_featured: true,
        featured_until: "2026-08-27T21:02:43.64555+00",
      },
      {
        id: "expired",
        is_featured: true,
        featured_until: "2026-04-14T16:00:00Z",
      },
    ];
    const pinned = pinActiveFeaturedFirst(doctors, now);
    expect(pinned.map((d) => d.id)).toEqual(["w", "j", "expired"]);
    expect(pinned[0].is_featured).toBe(true);
    expect(pinned[2].is_featured).toBe(false); // expired cleared
    expect(
      isActivelyFeatured(
        { is_featured: true, featured_until: "2026-08-27 21:02:43.64555+00" },
        now
      )
    ).toBe(true);
  });
});

describe("recovery policy (specialty-preserving)", () => {
  it("specialty recovery never includes drop-to-nearby-any", () => {
    const steps = recoveryStepsFor("dermatology");
    expect(steps).not.toContain("nearby_any");
    expect(steps).toContain("widen_radius");
    expect(steps).toContain("platform_empty");
  });

  it("related recovery for dermatology excludes GP and dentistry", () => {
    const related = relatedSpecialtiesForRecovery("dermatology");
    expect(related).not.toContain("general-practice");
    expect(related).not.toContain("dentistry");
    // taxonomy related for derm typically includes aesthetic/allergy/rheum
    expect(related.length).toBeGreaterThan(0);
  });

  it("isSpecialtyPreservingRecovery rejects pure dentistry results for derm", () => {
    expect(
      isSpecialtyPreservingRecovery("dermatology", ["dentistry", "dentistry"])
    ).toBe(false);
    expect(
      isSpecialtyPreservingRecovery("dermatology", ["dermatology"])
    ).toBe(true);
  });

  it("forbidden primary fills for dermatology include dentistry", () => {
    expect(forbiddenPrimaryForDermatology()).toContain("dentistry");
  });

  it("shouldRunRecovery is true for availableToday soft-fail empty", () => {
    expect(
      shouldRunRecovery({
        dataEmpty: true,
        availableToday: true,
        softFailures: ["available_today"],
      })
    ).toBe(true);
  });

  it("shouldRunRecovery is true for soonest empty candidates", () => {
    expect(
      shouldRunRecovery({
        dataEmpty: true,
        sort: "soonest",
        specialty: "dermatology",
        softFailures: ["soonest_empty_candidates"],
      })
    ).toBe(true);
  });

  it("shouldRunRecovery is false when data is non-empty", () => {
    expect(
      shouldRunRecovery({
        dataEmpty: false,
        specialty: "dermatology",
      })
    ).toBe(false);
  });

  it("critical soft-fail reasons are documented for regression", () => {
    expect(SOFT_FAIL_REASONS_MUST_RECOVER).toContain("available_today");
    expect(SOFT_FAIL_REASONS_MUST_RECOVER).toContain("soonest_empty_candidates");
    expect(SOFT_FAIL_REASONS_MUST_RECOVER).toContain("proximity");
  });

  it("widen radius steps expand from base", () => {
    expect(widenRadiusSteps(25)).toEqual([50, 100]);
    expect(widenRadiusSteps(40)).toEqual([80, 160]);
  });

  it("banners never say showing all nearby doctors", () => {
    const a = fullyBookedBanner("Dermatology", 14);
    const b = platformEmptyBanner("dermatology", null);
    expect(a.toLowerCase()).not.toContain("all nearby");
    expect(b.toLowerCase()).not.toContain("all nearby");
    expect(b.toLowerCase()).toContain("waitlist");
  });
});
