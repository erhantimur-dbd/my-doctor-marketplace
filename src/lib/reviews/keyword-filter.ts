/**
 * Review keyword filter — checks review content against a configurable
 * blocklist. Reviews containing blocked keywords are flagged for manual
 * moderation instead of being auto-approved.
 *
 * The blocklist is stored in the `platform_settings` table (key:
 * "review_blocked_keywords") so admins can update it without a deploy.
 * Falls back to a hardcoded default list when the DB row doesn't exist.
 */

import { createAdminClient } from "@/lib/supabase/admin";

const DEFAULT_BLOCKED_KEYWORDS = [
  // Profanity / abuse
  "scam",
  "fraud",
  "fake",
  "quack",
  "incompetent",
  "malpractice",
  "negligent",
  "disgusting",
  "horrible",
  "worst",
  "useless",
  "awful",
  "terrible",
  "rubbish",
  "pathetic",
  // Threats / legal
  "sue",
  "lawyer",
  "lawsuit",
  "solicitor",
  "court",
  "police",
  "report you",
  // Spam signals
  "buy now",
  "click here",
  "free trial",
  "discount code",
  "promo code",
  "http://",
  "https://",
  "www.",
];

export interface KeywordFilterResult {
  passed: boolean;
  flaggedKeywords: string[];
}

/**
 * Load the blocked keyword list from the database, falling back to defaults.
 */
async function getBlockedKeywords(): Promise<string[]> {
  try {
    const supabase = createAdminClient();
    const { data } = await supabase
      .from("platform_settings")
      .select("value")
      .eq("key", "review_blocked_keywords")
      .single();

    if (data?.value) {
      const parsed = JSON.parse(data.value);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed.map((k: string) => k.toLowerCase().trim());
      }
    }
  } catch {
    // DB table may not exist yet — use defaults
  }

  return DEFAULT_BLOCKED_KEYWORDS;
}

/**
 * Check review text (title + comment) against the blocked keyword list.
 * Matching is case-insensitive and checks for substring presence.
 */
export async function checkReviewKeywords(
  title: string | null,
  comment: string | null
): Promise<KeywordFilterResult> {
  const blockedKeywords = await getBlockedKeywords();
  const text = [title ?? "", comment ?? ""].join(" ").toLowerCase();

  if (!text.trim()) {
    return { passed: true, flaggedKeywords: [] };
  }

  const flaggedKeywords = blockedKeywords.filter((keyword) =>
    text.includes(keyword)
  );

  return {
    passed: flaggedKeywords.length === 0,
    flaggedKeywords,
  };
}
