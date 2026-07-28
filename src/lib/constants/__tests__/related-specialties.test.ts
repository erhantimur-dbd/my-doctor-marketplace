import { describe, it, expect } from "vitest";
import {
  getRelatedSpecialtySlugs,
  specialtySlugToLabel,
} from "../related-specialties";

describe("getRelatedSpecialtySlugs", () => {
  it("includes general-practice for specialist searches", () => {
    const related = getRelatedSpecialtySlugs("neurology");
    expect(related).toContain("general-practice");
    expect(related).not.toContain("neurology");
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
