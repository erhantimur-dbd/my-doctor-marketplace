import { SPECIALTIES } from "@/lib/constants/specialties";
import { SYMPTOMS } from "@/lib/constants/symptoms";
import type { NLSearchFilters } from "@/lib/ai/schemas";
import {
  matchLocationFromSearchText,
  type LocationMatchInput,
} from "@/lib/location/match-location";
import { matchSymptoms } from "@/lib/utils/search-matcher";

/**
 * Role phrases the NL prompt already routes, which are not symptom
 * keywords. Longer phrases are tried first.
 */
const ROLE_ALIASES: readonly { phrase: string; slug: string }[] = [
  { phrase: "general practitioner", slug: "general-practice" },
  { phrase: "family doctor", slug: "general-practice" },
  { phrase: "heart doctor", slug: "cardiology" },
  { phrase: "skin doctor", slug: "dermatology" },
  { phrase: "dentist", slug: "dentistry" },
  { phrase: "dental", slug: "dentistry" },
  { phrase: "gp", slug: "general-practice" },
];

const FILLER = new Set([
  "a",
  "an",
  "the",
  "in",
  "near",
  "nearby",
  "around",
  "at",
  "for",
  "me",
  "my",
  "im",
  "am",
  "looking",
  "find",
  "need",
  "want",
  "please",
  "doctor",
  "doctors",
  "dr",
  "specialist",
  "some",
  "of",
  "and",
  "to",
  "with",
  "who",
  "that",
  "is",
  "are",
  "have",
  "has",
  "get",
  "see",
  "book",
  "appointment",
  "today",
  "now",
  "just",
  "can",
  "you",
  "your",
  "we",
  "our",
  "would",
  "like",
  "any",
  "from",
  "on",
  "by",
  "or",
  "it",
  "this",
  "there",
  "here",
]);

/**
 * Price, rating, language, and consultation format are not in the
 * keyword catalogs. Those queries still need the model.
 */
const MODEL_ONLY =
  /\b(?:video|online|in[-\s]?person|face[-\s]?to[-\s]?face|rated|rating|stars?|speaking|speaks|language)\b|[£€$]|\b\d+\s*(?:euros?|pounds?|dollars?|gbp|eur|usd)\b|\b(?:under|below|less than|cheaper than)\b/i;

const VALID_SLUGS = new Set(SPECIALTIES.map((s) => s.slug));

type PhraseHit = { slug: string; phrase: string };

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function phraseInText(text: string, phrase: string): boolean {
  const re = new RegExp(
    `(?:^|[^a-z0-9])${escapeRegExp(phrase)}(?:[^a-z0-9]|$)`,
    "i"
  );
  return re.test(text);
}

function considerSymptom(
  phrase: string,
  lower: string,
  best: { slug: string; phrase: string; score: number } | null
): { slug: string; phrase: string; score: number } | null {
  if (phrase.length < 3 || !phraseInText(lower, phrase)) return best;
  const hit = matchSymptoms(phrase, SYMPTOMS, 1)[0];
  if (!hit || !VALID_SLUGS.has(hit.specialtySlug)) return best;
  const strong = hit.score === 100 || (hit.score >= 80 && phrase.length >= 4);
  if (!strong) return best;
  if (
    !best ||
    hit.score > best.score ||
    (hit.score === best.score && phrase.length > best.phrase.length)
  ) {
    return { slug: hit.specialtySlug, phrase, score: hit.score };
  }
  return best;
}

function symptomHit(text: string): PhraseHit | null {
  const lower = text.toLowerCase();
  const words = lower.split(/[^a-z0-9+]+/).filter((w) => w.length >= 3);
  let best: { slug: string; phrase: string; score: number } | null = null;

  const capped = words.slice(0, 40);
  for (let i = 0; i < capped.length; i++) {
    const max = Math.min(5, capped.length - i);
    for (let len = 1; len <= max; len++) {
      best = considerSymptom(capped.slice(i, i + len).join(" "), lower, best);
    }
  }

  if (!best) return null;
  return { slug: best.slug, phrase: best.phrase };
}

function nameHit(text: string): PhraseHit | null {
  const candidates: PhraseHit[] = [];
  for (const specialty of SPECIALTIES) {
    candidates.push({ phrase: specialty.slug, slug: specialty.slug });
    const spaced = specialty.slug.replace(/-/g, " ");
    if (spaced !== specialty.slug) {
      candidates.push({ phrase: spaced, slug: specialty.slug });
    }
    const fromKey = specialty.nameKey
      .replace(/^specialty\./, "")
      .replace(/_/g, " ");
    if (fromKey !== spaced) {
      candidates.push({ phrase: fromKey, slug: specialty.slug });
    }
  }
  for (const alias of ROLE_ALIASES) {
    if (VALID_SLUGS.has(alias.slug)) candidates.push(alias);
  }

  candidates.sort((a, b) => b.phrase.length - a.phrase.length);
  const lower = text.toLowerCase();
  for (const candidate of candidates) {
    if (candidate.phrase.length < 2) continue;
    if (candidate.phrase.length < 3 && candidate.phrase !== "gp") continue;
    if (phraseInText(lower, candidate.phrase)) return candidate;
  }
  return null;
}

function bestSpecialty(text: string): PhraseHit | null {
  const symptom = symptomHit(text);
  const name = nameHit(text);
  if (symptom && name) {
    return symptom.phrase.length >= name.phrase.length ? symptom : name;
  }
  return symptom ?? name;
}

function hasUnexplainedRemainder(
  text: string,
  phrases: string[]
): boolean {
  let rest = ` ${text.toLowerCase()} `;
  const sorted = phrases
    .map((p) => p.toLowerCase().trim())
    .filter((p) => p.length >= 2)
    .sort((a, b) => b.length - a.length);

  for (const phrase of sorted) {
    const re = new RegExp(
      `(?:^|[^a-z0-9])${escapeRegExp(phrase)}(?=[^a-z0-9]|$)`,
      "gi"
    );
    rest = rest.replace(re, " ");
  }

  const tokens = rest
    .split(/[^a-z0-9]+/)
    .filter((token) => token.length >= 2 && !FILLER.has(token));
  return tokens.length > 0;
}

/**
 * Keyword + location parse. Returns filters only when the query is fully
 * explained without price, rating, language, or consultation signals.
 * Returns null when the model still has to look. Does not handle
 * emergencies — the action must run `detectEmergency` first (chest pain
 * is both an emergency and a cardiology keyword).
 */
export function tryLocalNlSearch(
  text: string,
  locations: readonly LocationMatchInput[]
): NLSearchFilters | null {
  const trimmed = text.trim();
  if (trimmed.length < 3 || MODEL_ONLY.test(trimmed)) return null;

  const locationSlug = matchLocationFromSearchText(trimmed, [
    ...locations,
  ]);
  const location = locations.find((l) => l.slug === locationSlug) ?? null;
  const specialty = bestSpecialty(trimmed);

  if (!specialty && !location) return null;

  const phrases = [
    specialty?.phrase ?? "",
    location?.city ?? "",
    location?.slug ?? "",
  ];
  if (hasUnexplainedRemainder(trimmed, phrases)) return null;

  return {
    specialty:
      specialty && VALID_SLUGS.has(specialty.slug) ? specialty.slug : null,
    location: locationSlug,
    language: null,
    maxPrice: null,
    minRating: null,
    consultationType: null,
    query: null,
  };
}
