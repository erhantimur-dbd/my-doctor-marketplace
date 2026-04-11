import { z } from "zod/v4";

/**
 * Specialty Finder — maps patient input to a medical specialty slug.
 *
 * This schema is intentionally narrow. The AI's only job is to suggest
 * which *type* of doctor the user should look for. Urgency triage is NOT
 * done by the LLM — it is handled deterministically by
 * `src/lib/ai/emergency-classifier.ts`, which runs BEFORE any LLM call.
 *
 * Do not add `urgency`, `severity`, or diagnosis fields to this schema.
 * Letting an LLM decide whether something is a medical emergency is
 * unsafe and regulatorily unacceptable (UK CQC compliance, Workstream
 * 3.4). If you need a new clinical field, stop and escalate instead.
 */
export const symptomAnalysisSchema = z.object({
  primarySpecialty: z
    .string()
    .describe("Specialty slug from the allowed list (e.g. 'cardiology', 'neurology')"),
  relatedSpecialties: z
    .array(z.string())
    .describe("Up to 2 related specialty slugs"),
  suggestedConsultationType: z
    .enum(["in_person", "video", "either"])
    .describe("Whether in-person visit is needed or video call suffices"),
  confidence: z
    .number()
    .min(0)
    .max(1)
    .describe("Confidence in the specialty match, 0-1"),
});

/**
 * The shape the UI consumes. Combines the LLM-produced specialty fields
 * with urgency, which is set by the deterministic emergency classifier
 * — never by the LLM. Only two levels exist: `emergency` (routed from
 * the 999 classifier) or `routine` (everything else).
 */
export type SymptomAnalysis = z.infer<typeof symptomAnalysisSchema> & {
  urgency: "emergency" | "routine";
  urgencyReason: string | null;
};

/**
 * Natural Language Search — parses free-text query into structured filters
 */
export const nlSearchSchema = z.object({
  specialty: z
    .string()
    .nullable()
    .describe("Specialty slug if mentioned (e.g. 'cardiology', 'dermatology')"),
  location: z
    .string()
    .nullable()
    .describe("Location slug from the available locations list (e.g. 'istanbul-turkey', 'berlin-germany')"),
  language: z
    .string()
    .nullable()
    .describe("Language name if mentioned (e.g. 'Turkish', 'German', 'English')"),
  maxPrice: z
    .number()
    .nullable()
    .describe("Maximum price in cents if mentioned (e.g. '100 euros' = 10000)"),
  minRating: z
    .number()
    .nullable()
    .describe("Minimum rating if mentioned (e.g. 'highly rated' = 4.0)"),
  consultationType: z
    .enum(["in_person", "video"])
    .nullable()
    .describe("Consultation type if mentioned"),
  query: z
    .string()
    .nullable()
    .describe("Remaining free-text query that doesn't map to a filter"),
});

export type NLSearchFilters = z.infer<typeof nlSearchSchema>;

/**
 * AI Review Summary — generated summary + sentiment tags for a doctor
 */
export const reviewSummarySchema = z.object({
  summary: z
    .string()
    .describe("2-3 sentence summary highlighting the most common themes from patient reviews"),
  sentimentTags: z
    .array(z.string())
    .describe("3-5 short tags (2-3 words each) capturing recurring praise or concerns, e.g. 'Great Listener', 'Thorough', 'Runs On Time'"),
  overallSentiment: z
    .enum(["very_positive", "positive", "mixed", "negative"])
    .describe("Overall sentiment across all reviews"),
});

export type ReviewSummary = z.infer<typeof reviewSummarySchema>;
