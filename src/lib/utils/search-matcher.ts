import type { SymptomEntry } from "@/lib/constants/symptoms";
import type { MedicalTestEntry } from "@/lib/constants/medical-tests";

export interface SearchMatch {
  type: "symptom" | "test";
  id: string;
  labelKey: string;
  specialtySlug: string;
  score: number;
}

/**
 * Score a query against a list of keywords.
 * - Exact match: 100
 * - Keyword starts with query: 80
 * - Query starts with keyword: 70
 * - Keyword contains query: 60
 * - Any word in the keyword starts with query: 40
 * Returns 0 if no match.
 */
function scoreKeywords(query: string, keywords: string[]): number {
  let best = 0;
  for (const kw of keywords) {
    if (kw === query) return 100;
    if (kw.startsWith(query)) best = Math.max(best, 80);
    else if (query.startsWith(kw)) best = Math.max(best, 70);
    else if (kw.includes(query)) best = Math.max(best, 60);
    else {
      const words = kw.split(/\s+/);
      for (const word of words) {
        if (word.startsWith(query)) {
          best = Math.max(best, 40);
          break;
        }
      }
    }
  }
  return best;
}

/**
 * Match symptoms against a user query.
 * Returns top results sorted by score (descending), limited to `limit`.
 */
export function matchSymptoms(
  query: string,
  symptoms: readonly SymptomEntry[],
  limit = 3
): SearchMatch[] {
  const q = query.toLowerCase().trim();
  if (q.length < 2) return [];

  const results: SearchMatch[] = [];
  for (const entry of symptoms) {
    const score = scoreKeywords(q, entry.keywords);
    if (score > 0) {
      results.push({
        type: "symptom",
        id: entry.id,
        labelKey: entry.labelKey,
        specialtySlug: entry.primarySpecialty,
        score,
      });
    }
  }

  results.sort((a, b) => b.score - a.score);
  return results.slice(0, limit);
}

/**
 * Match medical tests against a user query.
 * Returns top results sorted by score (descending), limited to `limit`.
 */
export function matchTests(
  query: string,
  tests: readonly MedicalTestEntry[],
  limit = 3
): SearchMatch[] {
  const q = query.toLowerCase().trim();
  if (q.length < 2) return [];

  const results: SearchMatch[] = [];
  for (const entry of tests) {
    const score = scoreKeywords(q, entry.keywords);
    if (score > 0) {
      results.push({
        type: "test",
        id: entry.id,
        labelKey: entry.labelKey,
        specialtySlug: entry.primarySpecialty,
        score,
      });
    }
  }

  results.sort((a, b) => b.score - a.score);
  return results.slice(0, limit);
}
