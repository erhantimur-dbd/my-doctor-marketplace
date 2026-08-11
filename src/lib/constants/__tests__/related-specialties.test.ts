import { describe, it, expect } from "vitest";
import {
  getRelatedSpecialtySlugs,
  specialtySlugToLabel,
} from "../related-specialties";

describe("getRelatedSpecialtySlugs", () => {
  it("returns related specialists without auto-injecting general-practice", () => {
    // Product: do not dilute specialist search with GP for every specialty
    const related = getRelatedSpecialtySlugs("neurology");
    expect(related).not.toContain("neurology");
    expect(Array.isArray(related)).toBe(true);
    // GP only when taxonomy relatedSlugs includes it — not forced globally
  });

  it("does not force-add general-practice when searching GP", () => {
    const related = getRelatedSpecialtySlugs("general-practice");
    expect(related).not.toContain("general-practice");
  });

  it("returns related slugs from specialty taxonomy", () => {
    const related = getRelatedSpecialtySlugs("orthopedics");
    expect(related).toContain("physiotherapy");
  });
});

describe("specialtySlugToLabel", () => {
  it("formats slug to title case", () => {
    expect(specialtySlugToLabel("general-practice")).toBe("General Practice");
  });
});
