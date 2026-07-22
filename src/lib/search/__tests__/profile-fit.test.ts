import { describe, expect, it } from "vitest";
import { buildProfileFitBlurb } from "@/lib/search/profile-fit";

describe("buildProfileFitBlurb", () => {
  const doctor = {
    specialtySlugs: ["general-practice"],
    specialtyLabels: ["General Practice"],
    city: "Birmingham",
    languages: ["English", "Turkish"],
    consultationTypes: ["in_person", "video"],
    consultationFeeCents: 12000,
    avgRating: 4.8,
  };

  it("returns empty when no search intent", () => {
    const r = buildProfileFitBlurb({}, doctor);
    expect(r.hasIntent).toBe(false);
    expect(r.blurb).toBe("");
  });

  it("mentions specialty, city, video, and language when they match", () => {
    const r = buildProfileFitBlurb(
      {
        specialty: "general-practice",
        location: "birmingham-uk",
        consultationType: "video",
        language: "Turkish",
      },
      doctor,
      { specialtyDisplay: "General Practice" }
    );
    expect(r.hasIntent).toBe(true);
    expect(r.blurb.toLowerCase()).toMatch(/fit/);
    expect(r.reasons.length).toBeGreaterThanOrEqual(2);
    expect(r.blurb.toLowerCase()).toMatch(/video|birmingham|turkish|general/);
  });
});
