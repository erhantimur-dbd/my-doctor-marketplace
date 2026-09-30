import { describe, expect, it } from "vitest";
import { tryLocalNlSearch } from "../nl-search-local";

const LOCATIONS = [
  { slug: "london-uk", city: "London", country_code: "GB" },
  { slug: "birmingham-uk", city: "Birmingham", country_code: "GB" },
  { slug: "newcastle-upon-tyne-uk", city: "Newcastle upon Tyne", country_code: "GB" },
];

describe("tryLocalNlSearch", () => {
  it("maps a symptom plus city without the model", () => {
    expect(tryLocalNlSearch("toothache in Birmingham", LOCATIONS)).toEqual({
      specialty: "dentistry",
      location: "birmingham-uk",
      language: null,
      maxPrice: null,
      minRating: null,
      consultationType: null,
      query: null,
    });
  });

  it("maps role phrases the symptom list does not contain", () => {
    expect(
      tryLocalNlSearch(
        "I'm looking for a general practitioner in Birmingham",
        LOCATIONS
      )
    ).toMatchObject({
      specialty: "general-practice",
      location: "birmingham-uk",
    });
    expect(tryLocalNlSearch("heart doctor in London", LOCATIONS)).toMatchObject(
      {
        specialty: "cardiology",
        location: "london-uk",
      }
    );
  });

  it("prefers the longer city name", () => {
    expect(
      tryLocalNlSearch("dentist in Newcastle upon Tyne", LOCATIONS)
    ).toMatchObject({
      specialty: "dentistry",
      location: "newcastle-upon-tyne-uk",
    });
  });

  it("returns a specialty or a city alone when nothing else is left", () => {
    expect(tryLocalNlSearch("skin rash", LOCATIONS)).toMatchObject({
      specialty: "dermatology",
      location: null,
    });
    expect(tryLocalNlSearch("cardiology", LOCATIONS)).toMatchObject({
      specialty: "cardiology",
      location: null,
    });
    expect(tryLocalNlSearch("Newcastle upon Tyne", LOCATIONS)).toEqual({
      specialty: null,
      location: "newcastle-upon-tyne-uk",
      language: null,
      maxPrice: null,
      minRating: null,
      consultationType: null,
      query: null,
    });
  });

  it("leaves price, rating, language, and video queries to the model", () => {
    expect(
      tryLocalNlSearch("highly rated dentist in Birmingham", LOCATIONS)
    ).toBeNull();
    expect(tryLocalNlSearch("dentist under 100 euros", LOCATIONS)).toBeNull();
    expect(
      tryLocalNlSearch("Turkish speaking dentist in London", LOCATIONS)
    ).toBeNull();
    expect(tryLocalNlSearch("video dentist in London", LOCATIONS)).toBeNull();
  });

  it("does not guess a specialty when extra clinical words remain", () => {
    expect(
      tryLocalNlSearch("I have a weird rash on my elbow", LOCATIONS)
    ).toBeNull();
  });

  it("does not invent filters for an unexplained query", () => {
    expect(tryLocalNlSearch("find a doctor", LOCATIONS)).toBeNull();
    expect(tryLocalNlSearch("passport help in London", LOCATIONS)).toBeNull();
  });
});
