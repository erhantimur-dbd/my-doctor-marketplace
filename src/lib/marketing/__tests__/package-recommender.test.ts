import { describe, expect, it } from "vitest";
import {
  getPackageRecommendation,
  getPackageRecommendationReason,
  type PackageRecommenderAnswers,
} from "../package-recommender";

const baseSolo: PackageRecommenderAnswers = {
  practiceSize: "solo",
  patientsPerWeek: "under_10",
  needsVideo: "no",
  wantsGrowthTools: "no",
};

describe("getPackageRecommendation (D-simple)", () => {
  it("returns null until all answers are set", () => {
    expect(
      getPackageRecommendation({
        practiceSize: "solo",
        patientsPerWeek: null,
        needsVideo: "yes",
        wantsGrowthTools: "no",
      })
    ).toBeNull();
  });

  it("routes multi-doctor practices to Clinic regardless of other answers", () => {
    expect(
      getPackageRecommendation({
        practiceSize: "multi",
        patientsPerWeek: "under_10",
        needsVideo: "no",
        wantsGrowthTools: "no",
      })
    ).toBe("clinic");
    expect(
      getPackageRecommendation({
        practiceSize: "multi",
        patientsPerWeek: "over_30",
        needsVideo: "yes",
        wantsGrowthTools: "yes",
      })
    ).toBe("clinic");
  });

  it("routes solo + growth tools to Professional", () => {
    expect(
      getPackageRecommendation({
        ...baseSolo,
        wantsGrowthTools: "yes",
      })
    ).toBe("professional");
  });

  it("routes solo + video or high volume to Starter", () => {
    expect(
      getPackageRecommendation({
        ...baseSolo,
        needsVideo: "yes",
      })
    ).toBe("starter");
    expect(
      getPackageRecommendation({
        ...baseSolo,
        patientsPerWeek: "over_30",
      })
    ).toBe("starter");
  });

  it("routes light solo usage to Founding Free", () => {
    expect(getPackageRecommendation(baseSolo)).toBe("free");
  });
});

describe("getPackageRecommendationReason", () => {
  it("Clinic reason mentions 3–15 seats", () => {
    const reason = getPackageRecommendationReason("clinic", {
      practiceSize: "multi",
      patientsPerWeek: "10_to_30",
      needsVideo: "yes",
      wantsGrowthTools: "yes",
    });
    expect(reason).toMatch(/3 doctor seats|3–15|expand to 15/i);
    expect(reason).toMatch(/Clinic/i);
  });

  it("Professional reason is solo and points multi-doctor to Clinic", () => {
    const reason = getPackageRecommendationReason("professional", {
      ...baseSolo,
      wantsGrowthTools: "yes",
    });
    expect(reason).toMatch(/solo/i);
    expect(reason).toMatch(/Clinic/i);
    expect(reason).not.toMatch(/1–4|per-user multi/i);
  });

  it("Starter reason does not claim SMS/WhatsApp as included", () => {
    const reason = getPackageRecommendationReason("starter", {
      ...baseSolo,
      needsVideo: "yes",
    });
    expect(reason).toMatch(/Professional/i);
    expect(reason).toMatch(/SMS|WhatsApp/i);
    expect(reason).toMatch(/come with Professional|upgrade to Professional/i);
  });
});
