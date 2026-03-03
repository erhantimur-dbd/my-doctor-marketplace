/**
 * Detect whether a search query is a natural language query that should
 * be parsed by AI, rather than a simple keyword/specialty search.
 *
 * Returns true when the query:
 * - Has 4+ words, OR
 * - Contains price/budget indicators, OR
 * - Contains location indicators (near, in, around), OR
 * - Contains language references (speaks, speaking)
 */
export function shouldUseNLSearch(query: string): boolean {
  const trimmed = query.trim();
  if (trimmed.length < 10) return false;

  // Multi-word natural language input
  const wordCount = trimmed.split(/\s+/).length;
  if (wordCount >= 4) return true;

  // Price indicators
  const pricePattern =
    /\b(under|less than|cheaper|cheap|affordable|budget|max|maximum|bis|unter|altında|moins de)\b|[$€£¥₺]\d|\d\s*(euro|eur|usd|gbp|try|dollar|pound|lira)/i;
  if (pricePattern.test(trimmed)) return true;

  // Location indicators
  const locationPattern =
    /\b(near|nearby|around|close to|in\s+\w{2,}|nahe|nähe|yakın|près de|vicino)\b/i;
  if (locationPattern.test(trimmed)) return true;

  // Language indicators
  const languagePattern =
    /\b(speaks?|speaking|\w+-speaking|spricht|konuşan|parle|parla)\b/i;
  if (languagePattern.test(trimmed)) return true;

  return false;
}
