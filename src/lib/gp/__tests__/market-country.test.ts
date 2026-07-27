import { describe, expect, it } from "vitest";
import { resolveGpMarketCountry } from "../market-country";

const locations = [
  {
    slug: "london-uk",
    city: "London",
    country_code: "GB",
    latitude: 51.5074,
    longitude: -0.1278,
  },
  {
    slug: "manchester-uk",
    city: "Manchester",
    country_code: "GB",
    latitude: 53.4808,
    longitude: -2.2426,
  },
  {
    slug: "dublin-ie",
    city: "Dublin",
    country_code: "IE",
    latitude: 53.3498,
    longitude: -6.2603,
  },
  {
    slug: "rome-it",
    city: "Rome",
    country_code: "IT",
    latitude: 41.9028,
    longitude: 12.4964,
  },
  {
    slug: "istanbul-tr",
    city: "Istanbul",
    country_code: "TR",
    latitude: 41.0082,
    longitude: 28.9784,
  },
];

describe("resolveGpMarketCountry", () => {
  it("uses country-xx search selection", () => {
    expect(
      resolveGpMarketCountry({
        locale: "it",
        locations,
        locationSlug: "country-gb",
      })
    ).toBe("GB");
  });

  it("maps city slug to country (UK-wide, not city-only)", () => {
    expect(
      resolveGpMarketCountry({
        locale: "en-GB",
        locations,
        locationSlug: "manchester-uk",
      })
    ).toBe("GB");
  });

  it("uses GPS nearest city country", () => {
    expect(
      resolveGpMarketCountry({
        locale: "en-GB",
        locations,
        geo: { latitude: 53.35, longitude: -6.26 },
      })
    ).toBe("IE");
  });

  it("falls back to locale when no geo/location", () => {
    expect(resolveGpMarketCountry({ locale: "tr", locations: [] })).toBe("TR");
    expect(resolveGpMarketCountry({ locale: "it", locations: [] })).toBe("IT");
    expect(resolveGpMarketCountry({ locale: "en-GB", locations: [] })).toBe(
      "GB"
    );
  });

  it("prefers explicit city over locale", () => {
    expect(
      resolveGpMarketCountry({
        locale: "en-GB",
        locations,
        locationSlug: "rome-it",
      })
    ).toBe("IT");
  });
});
