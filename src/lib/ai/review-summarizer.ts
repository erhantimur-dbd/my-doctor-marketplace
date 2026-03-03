import { generateObject } from "ai";
import { aiModel, isAIEnabled } from "@/lib/ai/provider";
import { reviewSummarySchema, type ReviewSummary } from "@/lib/ai/schemas";

interface ReviewInput {
  rating: number;
  title: string | null;
  comment: string | null;
}

/**
 * Generate an AI summary + sentiment tags from a list of reviews.
 * Used by the cron job to batch-generate summaries for doctors.
 */
export async function generateReviewSummary(
  reviews: ReviewInput[]
): Promise<ReviewSummary | null> {
  if (!isAIEnabled() || reviews.length === 0) return null;

  const reviewTexts = reviews
    .map(
      (r, i) =>
        `Review ${i + 1}: Rating ${r.rating}/5${r.title ? ` — "${r.title}"` : ""}${r.comment ? `. ${r.comment}` : ""}`
    )
    .join("\n");

  try {
    const { object } = await generateObject({
      model: aiModel,
      schema: reviewSummarySchema,
      prompt: `You are writing a brief summary for a doctor's profile page on a healthcare booking platform.

Summarize the following ${reviews.length} patient reviews into:
1. A concise 2-3 sentence summary highlighting the most common themes, both positive and negative
2. 3-5 short sentiment tags (2-3 words each) that capture recurring praise or concerns (e.g. "Great Listener", "Thorough Explanations", "Minimal Wait", "Runs On Time", "Gentle Approach")
3. Overall sentiment assessment

Be honest and balanced. If there are consistent negative themes, include them.
Write in third person (e.g. "Patients praise..." not "You will find...").

Reviews:
${reviewTexts}`,
    });

    return object;
  } catch (err) {
    console.error("Review summary generation failed:", err);
    return null;
  }
}
