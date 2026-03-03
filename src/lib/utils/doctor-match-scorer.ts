/**
 * Smart Doctor Match scoring engine.
 * Pure deterministic scoring — no AI calls per-request.
 * Uses pre-computed ai_sentiment_tags from the review summary cron job.
 */

export interface MatchContext {
  /** Preferred specialty slug (from AI symptom analysis or user filter) */
  preferredSpecialty?: string;
  /** Related specialty slugs (from AI analysis) */
  relatedSpecialties?: string[];
  /** Preferred language */
  preferredLanguage?: string;
  /** Maximum budget in cents */
  maxBudget?: number;
  /** Preferred consultation type */
  consultationType?: string;
}

export interface DoctorMatchInput {
  id: string;
  avg_rating: number | null;
  total_reviews: number;
  languages: string[];
  consultation_types: string[];
  consultation_fee_cents: number;
  video_consultation_fee_cents: number | null;
  ai_sentiment_tags: string[] | null;
  specialties: {
    specialty: { slug: string } | { slug: string }[];
    is_primary: boolean;
  }[];
}

export interface ScoredDoctor {
  doctorId: string;
  matchScore: number; // 0-100
  matchReasons: string[];
}

// Scoring weights (total: 100)
const WEIGHTS = {
  specialty: 30,
  language: 20,
  rating: 15,
  reviews: 10,
  budget: 15,
  sentiment: 10,
};

/**
 * Score a list of doctors against the given context.
 * Returns scored doctors sorted by matchScore descending.
 */
export function scoreDoctors(
  doctors: DoctorMatchInput[],
  context: MatchContext
): ScoredDoctor[] {
  // If no context provided, don't compute match scores
  if (
    !context.preferredSpecialty &&
    !context.preferredLanguage &&
    !context.maxBudget
  ) {
    return [];
  }

  return doctors
    .map((doctor) => {
      let score = 0;
      const reasons: string[] = [];

      // 1. Specialty match (30 pts)
      if (context.preferredSpecialty) {
        const doctorSlugs = getDoctorSpecialtySlugs(doctor);
        const primarySlugs = getDoctorPrimarySpecialtySlugs(doctor);

        if (primarySlugs.has(context.preferredSpecialty)) {
          score += WEIGHTS.specialty;
          reasons.push("match_reason_specialty");
        } else if (doctorSlugs.has(context.preferredSpecialty)) {
          score += WEIGHTS.specialty * 0.7;
          reasons.push("match_reason_specialty");
        } else if (
          context.relatedSpecialties?.some((rs) => doctorSlugs.has(rs))
        ) {
          score += WEIGHTS.specialty * 0.5;
          reasons.push("match_reason_specialty");
        }
      } else {
        // No specialty preference — give base points
        score += WEIGHTS.specialty * 0.5;
      }

      // 2. Language match (20 pts)
      if (context.preferredLanguage) {
        const hasLanguage = doctor.languages.some(
          (l) => l.toLowerCase() === context.preferredLanguage!.toLowerCase()
        );
        if (hasLanguage) {
          score += WEIGHTS.language;
          reasons.push("match_reason_language");
        }
      } else {
        score += WEIGHTS.language * 0.5;
      }

      // 3. Rating quality (15 pts) — scaled from avg_rating
      if (doctor.avg_rating) {
        const ratingScore = (doctor.avg_rating / 5) * WEIGHTS.rating;
        score += ratingScore;
        if (doctor.avg_rating >= 4.0) {
          reasons.push("match_reason_rating");
        }
      }

      // 4. Review volume (10 pts) — log scale
      if (doctor.total_reviews > 0) {
        // log2(reviews+1) capped at 10
        const volumeScore = Math.min(
          Math.log2(doctor.total_reviews + 1) * 2,
          WEIGHTS.reviews
        );
        score += volumeScore;
        if (doctor.total_reviews >= 10) {
          reasons.push("match_reason_reviews");
        }
      }

      // 5. Budget fit (15 pts)
      if (context.maxBudget) {
        const fee =
          context.consultationType === "video" &&
          doctor.video_consultation_fee_cents
            ? doctor.video_consultation_fee_cents
            : doctor.consultation_fee_cents;

        if (fee <= context.maxBudget) {
          score += WEIGHTS.budget;
          reasons.push("match_reason_budget");
        } else {
          // Partial score for being close to budget (within 20% over)
          const overRatio = fee / context.maxBudget;
          if (overRatio <= 1.2) {
            score += WEIGHTS.budget * 0.5;
          }
        }
      } else {
        score += WEIGHTS.budget * 0.5;
      }

      // 6. Sentiment quality (10 pts) — from AI tags
      if (doctor.ai_sentiment_tags && doctor.ai_sentiment_tags.length > 0) {
        // More tags = better data, max out at 5 tags
        const tagScore =
          Math.min(doctor.ai_sentiment_tags.length, 5) *
          (WEIGHTS.sentiment / 5);
        score += tagScore;
      }

      return {
        doctorId: doctor.id,
        matchScore: Math.round(Math.min(score, 100)),
        matchReasons: reasons,
      };
    })
    .sort((a, b) => b.matchScore - a.matchScore);
}

function getDoctorSpecialtySlugs(doctor: DoctorMatchInput): Set<string> {
  const slugs = new Set<string>();
  for (const ds of doctor.specialties || []) {
    const spec = Array.isArray(ds.specialty)
      ? ds.specialty[0]
      : ds.specialty;
    if (spec?.slug) slugs.add(spec.slug);
  }
  return slugs;
}

function getDoctorPrimarySpecialtySlugs(doctor: DoctorMatchInput): Set<string> {
  const slugs = new Set<string>();
  for (const ds of doctor.specialties || []) {
    if (!ds.is_primary) continue;
    const spec = Array.isArray(ds.specialty)
      ? ds.specialty[0]
      : ds.specialty;
    if (spec?.slug) slugs.add(spec.slug);
  }
  return slugs;
}
