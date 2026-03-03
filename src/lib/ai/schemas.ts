import { z } from "zod/v4";

/**
 * AI Symptom Analysis — maps patient symptoms to specialty + urgency
 */
export const symptomAnalysisSchema = z.object({
  primarySpecialty: z
    .string()
    .describe("Specialty slug from the allowed list (e.g. 'cardiology', 'neurology')"),
  relatedSpecialties: z
    .array(z.string())
    .describe("Up to 2 related specialty slugs"),
  urgency: z
    .enum(["emergency", "urgent", "routine"])
    .describe("emergency = seek ER immediately, urgent = book within days, routine = standard appointment"),
  urgencyReason: z
    .string()
    .optional()
    .describe("Brief explanation of urgency assessment"),
  suggestedConsultationType: z
    .enum(["in_person", "video", "either"])
    .describe("Whether in-person visit is needed or video call suffices"),
  confidence: z
    .number()
    .min(0)
    .max(1)
    .describe("Confidence in the analysis, 0-1"),
});

export type SymptomAnalysis = z.infer<typeof symptomAnalysisSchema>;

/**
 * Natural Language Search — parses free-text query into structured filters
 */
export const nlSearchSchema = z.object({
  specialty: z
    .string()
    .optional()
    .describe("Specialty slug if mentioned (e.g. 'cardiology', 'dermatology')"),
  location: z
    .string()
    .optional()
    .describe("Location slug or city name if mentioned"),
  language: z
    .string()
    .optional()
    .describe("Language name if mentioned (e.g. 'Turkish', 'German', 'English')"),
  maxPrice: z
    .number()
    .optional()
    .describe("Maximum price in cents if mentioned (e.g. '100 euros' = 10000)"),
  minRating: z
    .number()
    .optional()
    .describe("Minimum rating if mentioned (e.g. 'highly rated' = 4.0)"),
  consultationType: z
    .enum(["in_person", "video"])
    .optional()
    .describe("Consultation type if mentioned"),
  query: z
    .string()
    .optional()
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
