/**
 * Review auto-approval pipeline.
 *
 * A review is auto-approved (is_visible = true) when ALL of these pass:
 *  1. Rating >= 3 stars (1-2 star reviews always go to moderation)
 *  2. No blocked keywords found in title or comment
 *  3. The review has a non-empty comment (title-only or blank reviews go to moderation)
 *
 * Reviews that fail any check are inserted with is_visible = false and
 * land in the admin moderation queue.
 */

import { checkReviewKeywords } from "./keyword-filter";

export interface AutoApproveResult {
  autoApproved: boolean;
  reasons: string[];
}

export async function shouldAutoApprove(
  rating: number,
  title: string | null,
  comment: string | null
): Promise<AutoApproveResult> {
  const reasons: string[] = [];

  // Rule 1: Low ratings need human review
  if (rating < 3) {
    reasons.push(`Low rating (${rating}/5)`);
  }

  // Rule 2: Must have a comment
  if (!comment || comment.trim().length === 0) {
    reasons.push("No comment provided");
  }

  // Rule 3: Keyword filter
  const filterResult = await checkReviewKeywords(title, comment);
  if (!filterResult.passed) {
    reasons.push(
      `Flagged keywords: ${filterResult.flaggedKeywords.join(", ")}`
    );
  }

  return {
    autoApproved: reasons.length === 0,
    reasons,
  };
}
