import { describe, expect, it } from "vitest";
import {
  aggregateNpsMetrics,
  sortRecentSurveyResponses,
} from "@/lib/analytics/nps";

describe("aggregateNpsMetrics", () => {
  it("returns empty metrics when no scores", () => {
    const m = aggregateNpsMetrics([]);
    expect(m.npsScore).toBeNull();
    expect(m.responseCount).toBe(0);
    expect(m.promoters).toBe(0);
  });

  it("computes classic NPS from promoter/passive/detractor rows", () => {
    // 2 promoters (10,9), 1 passive (8), 1 detractor (3)
    // NPS = (50% - 25%) * 100 = 25
    const m = aggregateNpsMetrics([
      { nps_score: 10, would_recommend: true },
      { nps_score: 9, would_recommend: true },
      { nps_score: 8, would_recommend: true },
      { nps_score: 3, would_recommend: false },
    ]);
    expect(m.responseCount).toBe(4);
    expect(m.promoters).toBe(2);
    expect(m.passives).toBe(1);
    expect(m.detractors).toBe(1);
    expect(m.npsScore).toBe(25);
    expect(m.promoterRate).toBe(50);
    expect(m.detractorRate).toBe(25);
    expect(m.passiveRate).toBe(25);
    expect(m.averageScore).toBe(7.5);
    expect(m.recommendYes).toBe(3);
    expect(m.recommendNo).toBe(1);
  });

  it("ignores null/out-of-range scores", () => {
    const m = aggregateNpsMetrics([
      { nps_score: null },
      { nps_score: 11 },
      { nps_score: 10 },
    ]);
    expect(m.responseCount).toBe(1);
    expect(m.npsScore).toBe(100);
  });
});

describe("sortRecentSurveyResponses", () => {
  it("orders by submitted_at desc and respects limit", () => {
    const rows = sortRecentSurveyResponses(
      [
        { nps_score: 5, submitted_at: "2026-01-01T00:00:00Z", feedback_text: "a" },
        { nps_score: 9, submitted_at: "2026-06-01T00:00:00Z", feedback_text: "b" },
        { nps_score: 7, submitted_at: null, feedback_text: "skip" },
        { nps_score: 8, submitted_at: "2026-03-01T00:00:00Z", feedback_text: "c" },
      ],
      2
    );
    expect(rows).toHaveLength(2);
    expect(rows[0].feedback_text).toBe("b");
    expect(rows[1].feedback_text).toBe("c");
  });
});
