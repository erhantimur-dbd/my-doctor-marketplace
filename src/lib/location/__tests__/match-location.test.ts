import { describe, expect, it } from "vitest";
import {
  matchLocationFromSearchText,
  resolveLocationSlug,
} from "@/lib/location/match-location";

const LOCATIONS = [
  { slug: "london-uk", city: "London", country_code: "GB" },
  { slug: "birmingham-uk", city: "Birmingham", country_code: "GB" },
  { slug: "manchester-uk", city: "Manchester", country_code: "GB" },
  { slug: "newcastle-upon-tyne-uk", city: "Newcastle upon Tyne", country_code: "GB" },
];

describe("resolveLocationSlug", () => {
  it("resolves Birmingham city name to slug", () => {
    expect(resolveLocationSlug("Birmingham", LOCATIONS)).toBe("birmingham-uk");
    expect(resolveLocationSlug("birmingham", LOCATIONS)).toBe("birmingham-uk");
  });

  it("resolves exact slug", () => {
    expect(resolveLocationSlug("birmingham-uk", LOCATIONS)).toBe(
      "birmingham-uk"
    );
  });
});

describe("matchLocationFromSearchText", () => {
  it("finds Birmingham in a spoken GP query", () => {
    expect(
      matchLocationFromSearchText(
        "I'm looking for a general practitioner in Birmingham",
        LOCATIONS
      )
    ).toBe("birmingham-uk");
  });

  it("prefers longer city names", () => {
    expect(
      matchLocationFromSearchText("dentist in Newcastle upon Tyne", LOCATIONS)
    ).toBe("newcastle-upon-tyne-uk");
  });

  it("returns null when no city mentioned", () => {
    expect(
      matchLocationFromSearchText("general practitioner near me", LOCATIONS)
    ).toBeNull();
  });
});
