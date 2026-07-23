/**
 * Pure NPS analytics aggregation for admin dashboards.
 * Uses standard Net Promoter Score buckets on 0–10 scores.
 */

export type SurveyScoreRow = {
  nps_score: number | null;
  would_recommend?: boolean | null;
  feedback_text?: string | null;
  submitted_at?: string | null;
  token?: string | null;
  id?: string;
};

export type NpsBreakdown = {
  /** Classic NPS: %promoters − %detractors, rounded integer; null if no scores */
  npsScore: number | null;
  responseCount: number;
  promoters: number;
  passives: number;
  detractors: number;
  promoterRate: number;
  passiveRate: number;
  detractorRate: number;
  averageScore: number | null;
  recommendYes: number;
  recommendNo: number;
};

function rate(part: number, total: number): number {
  if (total <= 0) return 0;
  return Math.round((part / total) * 1000) / 10;
}

/**
 * Aggregate submitted survey rows (rows without a numeric score are ignored
 * for score buckets but may still appear in recent lists separately).
 */
export function aggregateNpsMetrics(rows: SurveyScoreRow[]): NpsBreakdown {
  const scored = rows.filter(
    (r) =>
      r.nps_score != null &&
      Number.isFinite(r.nps_score) &&
      r.nps_score >= 0 &&
      r.nps_score <= 10
  );

  const responseCount = scored.length;
  if (responseCount === 0) {
    return {
      npsScore: null,
      responseCount: 0,
      promoters: 0,
      passives: 0,
      detractors: 0,
      promoterRate: 0,
      passiveRate: 0,
      detractorRate: 0,
      averageScore: null,
      recommendYes: 0,
      recommendNo: 0,
    };
  }

  let promoters = 0;
  let passives = 0;
  let detractors = 0;
  let sum = 0;
  let recommendYes = 0;
  let recommendNo = 0;

  for (const r of scored) {
    const s = r.nps_score as number;
    sum += s;
    if (s >= 9) promoters++;
    else if (s >= 7) passives++;
    else detractors++;
    if (r.would_recommend === true) recommendYes++;
    if (r.would_recommend === false) recommendNo++;
  }

  const npsScore = Math.round(
    ((promoters - detractors) / responseCount) * 100
  );

  return {
    npsScore,
    responseCount,
    promoters,
    passives,
    detractors,
    promoterRate: rate(promoters, responseCount),
    passiveRate: rate(passives, responseCount),
    detractorRate: rate(detractors, responseCount),
    averageScore: Math.round((sum / responseCount) * 10) / 10,
    recommendYes,
    recommendNo,
  };
}

/**
 * Recent submitted responses sorted by submitted_at desc (nulls last).
 */
export function sortRecentSurveyResponses<T extends SurveyScoreRow>(
  rows: T[],
  limit = 25
): T[] {
  return [...rows]
    .filter((r) => r.submitted_at)
    .sort((a, b) => {
      const ta = a.submitted_at ? Date.parse(a.submitted_at) : 0;
      const tb = b.submitted_at ? Date.parse(b.submitted_at) : 0;
      return tb - ta;
    })
    .slice(0, limit);
}
