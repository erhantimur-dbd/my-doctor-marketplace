"use server";

import { generateObject } from "ai";
import { headers } from "next/headers";
import { aiModel, isAIEnabled } from "@/lib/ai/provider";
import {
  symptomAnalysisSchema,
  nlSearchSchema,
  type SymptomAnalysis,
  type NLSearchFilters,
} from "@/lib/ai/schemas";
import { detectEmergency } from "@/lib/ai/emergency-classifier";
import { tryLocalNlSearch } from "@/lib/ai/nl-search-local";
import { createAdminClient } from "@/lib/supabase/admin";
import { SPECIALTIES } from "@/lib/constants/specialties";
import {
  matchLocationFromSearchText,
  resolveLocationSlug,
} from "@/lib/location/match-location";
import crypto from "crypto";
import { log } from "@/lib/utils/logger";
import { rateLimit } from "@/lib/rate-limit";
import {
  isNaturalLanguageSearchEnabled,
  isSymptomAnalysisEnabled,
  NL_SEARCH_DISABLED_MESSAGE,
  SYMPTOM_ANALYSIS_DISABLED_MESSAGE,
} from "@/lib/launch/soft-launch";

const AI_TIMEOUT_MS = 5000;
const LOCATION_CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

let cachedLocations: { slug: string; city: string; country_code: string }[] | null = null;
let locationsCachedAt = 0;

async function getActiveLocations() {
  if (cachedLocations && Date.now() - locationsCachedAt < LOCATION_CACHE_TTL_MS) {
    return cachedLocations;
  }
  const supabase = createAdminClient();
  const { data } = await supabase
    .from("locations")
    .select("slug, city, country_code")
    .eq("is_active", true);
  cachedLocations = data ?? [];
  locationsCachedAt = Date.now();
  return cachedLocations;
}

function hashInput(text: string, locale: string): string {
  return crypto
    .createHash("sha256")
    .update(text.toLowerCase().trim() + "|" + locale)
    .digest("hex");
}

// ── Feature 1: Specialty Finder ─────────────────────────────
//
// This action is a specialty finder, not a symptom checker or triage
// tool. It helps users work out *which type of doctor* they should
// book — never diagnoses, never triages severity, never prescribes.
//
// The 999-emergency check runs FIRST, deterministically, via
// `detectEmergency()` in src/lib/ai/emergency-classifier.ts. The LLM is
// only invoked after that check passes, and its only job is to map the
// input to a specialty slug + suggested consultation type. Urgency is
// set by the classifier, never by the LLM.
//
// Note on data handling: we do NOT store the raw input text. The cache
// key is a sha256 hash of the lowercased input; the response row holds
// only the specialty output. This keeps requests ephemeral — there's
// no medical record being built up behind the scenes.

export async function analyzeSymptoms(
  input: string,
  locale: string
): Promise<{ data: SymptomAnalysis | null; error: string | null }> {
  if (!isSymptomAnalysisEnabled()) {
    return { data: null, error: SYMPTOM_ANALYSIS_DISABLED_MESSAGE };
  }

  const trimmed = input.trim();
  if (trimmed.length < 3) {
    return { data: null, error: "Input too short" };
  }

  // 1. Deterministic emergency check. Runs BEFORE the LLM and BEFORE
  //    the cache. If the input matches any 999 hazard pattern, we
  //    short-circuit with a general-practice + emergency response and
  //    persist nothing. An LLM is never consulted for emergencies.
  const emergency = detectEmergency(trimmed);
  if (emergency.isEmergency) {
    return {
      data: {
        primarySpecialty: "general-practice",
        relatedSpecialties: [],
        suggestedConsultationType: "in_person",
        confidence: 1,
        urgency: "emergency",
        urgencyReason: emergency.reason,
      },
      error: null,
    };
  }

  if (!isAIEnabled()) {
    log.warn("[AI] analyzeSymptoms: OPENAI_API_KEY not found in env");
    return { data: null, error: "AI not configured" };
  }
  console.log("[AI] analyzeSymptoms: starting for input:", input.substring(0, 50));

  const supabase = createAdminClient();
  const hash = hashInput(trimmed, locale);

  // 2. Check cache by hash only. No plaintext lookup; the cache cannot
  //    reveal what the user typed.
  try {
    const { data: cached } = await supabase
      .from("ai_symptom_cache")
      .select("result")
      .eq("input_hash", hash)
      .gt("expires_at", new Date().toISOString())
      .single();

    if (cached?.result) {
      console.log("[AI] analyzeSymptoms: cache hit");
      return { data: cached.result as SymptomAnalysis, error: null };
    }
  } catch (e) {
    // Cache miss — proceed to AI
    console.log("[AI] analyzeSymptoms: cache miss or table error:", (e as Error)?.message);
  }

  // 3. AI call with timeout. The prompt is deliberately scoped to
  //    "specialty finder": it must never return diagnoses, severity, or
  //    treatment advice. Urgency is not part of the schema.
  const specialtySlugs = SPECIALTIES.map((s) => s.slug).join(", ");

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), AI_TIMEOUT_MS);

    const { object } = await generateObject({
      model: aiModel,
      schema: symptomAnalysisSchema,
      prompt: `You are a SPECIALTY FINDER for a healthcare booking platform.
Your only job is to map the user's description of what they are looking for
to the most appropriate medical specialty category on the platform, so they
can book the right type of doctor. You must NOT diagnose, assess severity,
recommend treatment, or reassure the user about their condition.

Given the user's input, return:
1. The most appropriate medical specialty (MUST be one of: ${specialtySlugs})
2. Up to 2 related specialties (from the same list)
3. Whether in-person or video consultation is typically suitable for that
   specialty (purely a format hint, not clinical advice)

SPECIALTY ROUTING RULES:
- For vague, non-specific descriptions (general pain, fatigue, fever, cold, flu-like symptoms, dizziness, nausea, general malaise), the primarySpecialty MUST be "general-practice" (GP). Put the relevant specialist in relatedSpecialties.
- When the input clearly points to a specific body part or organ system, route to the appropriate specialist as primarySpecialty:
  • Teeth/gums/toothache/dental pain → "dentistry"
  • Skin rash/acne/mole/eczema → "dermatology"
  • Heart palpitations/chest pain/blood pressure → "cardiology"
  • Broken bone/joint pain/knee pain/back pain/sports injury → "orthopedics"
  • Eye exam/blurry vision/eye pain → "ophthalmology"
  • Ear pain/hearing loss/sinus/tonsils → "ent"
  • Headaches/migraines/numbness/seizures → "neurology"
  • Anxiety/depression/therapy/stress → "psychology"
  • Breathing difficulty/asthma/chronic cough → "pulmonology"
  • Stomach pain/acid reflux/digestive issues → "gastroenterology"
  • Allergies/hay fever/allergic reactions → "allergy"
  • Child health/baby/pediatric → "pediatrics"
  • Women's health/pregnancy/gynecological → "gynecology"
  • Diabetes/thyroid/hormones → "endocrinology"
  • Kidney pain/urinary issues → "nephrology" or "urology"
  • Cosmetic/botox/aesthetic → "aesthetic-medicine"
- Only default to "general-practice" when the input is truly vague and does not point to any specific specialist.
- Always include "general-practice" in relatedSpecialties if it's not the primarySpecialty.

User input: "${trimmed}"
User locale: ${locale}

Return ONLY specialty slugs from the allowed list above. Do not return
urgency, diagnosis, severity, or treatment suggestions — those are not
fields in the response schema.`,
      abortSignal: controller.signal,
    });

    clearTimeout(timeout);
    console.log("[AI] analyzeSymptoms: AI returned:", JSON.stringify(object));

    // Validate the specialty slug. Compose the final UI-facing shape by
    // adding a routine urgency — emergencies never get here, they were
    // short-circuited at step 1 by the deterministic classifier.
    const validSlugs = new Set(SPECIALTIES.map((s) => s.slug));
    const result: SymptomAnalysis = {
      ...object,
      primarySpecialty: validSlugs.has(object.primarySpecialty)
        ? object.primarySpecialty
        : "general-practice",
      relatedSpecialties: object.relatedSpecialties.filter((s) =>
        validSlugs.has(s)
      ),
      urgency: "routine",
      urgencyReason: null,
    };

    // 4. Cache the result by hash only. We do NOT store the raw input;
    //    see the module header comment for the rationale.
    try {
      await supabase.from("ai_symptom_cache").upsert(
        {
          input_hash: hash,
          locale,
          result: result as unknown as Record<string, unknown>,
          expires_at: new Date(
            Date.now() + 30 * 24 * 60 * 60 * 1000
          ).toISOString(),
        },
        { onConflict: "input_hash" }
      );
    } catch {
      // Cache write failure is non-critical
    }

    return { data: result, error: null };
  } catch (err) {
    log.error("AI symptom analysis error:", { err: err });
    return { data: null, error: "AI analysis failed" };
  }
}

// ── Feature 4: Natural Language Search ──────────────────────
//
// Spend fuse: `isNaturalLanguageSearchEnabled()` is hard-off. The
// coming-soon page hides the search bar; this action is what bills.
// A direct server-action call hits the same fuse.
//
// While the helper returns false, nothing below it runs. If it is
// later switched on, the order is: emergency classifier (no model,
// nothing stored), IP rate limit, keyword/location match, hash cache,
// then one model call. The prompt does not include the location
// catalog — city names are resolved locally afterwards.

const NL_SEARCH_MAX_INPUT = 500;
const NL_SEARCH_RATE_LIMIT = 20;
const NL_SEARCH_RATE_WINDOW_MS = 60 * 60 * 1000;

const EMPTY_NL_FILTERS: NLSearchFilters = {
  specialty: null,
  location: null,
  language: null,
  maxPrice: null,
  minRating: null,
  consultationType: null,
  query: null,
};

type NlSearchUsage = {
  inputTokens?: number;
  outputTokens?: number;
  totalTokens?: number;
};

/** JSON usage line for this path only. No query text. */
function meterNlSearch(
  outcome: "model" | "model_error" | "local" | "cache" | "emergency",
  usage?: NlSearchUsage
) {
  log.info("ai_usage", {
    feature: "nl_search",
    outcome,
    billed: outcome === "model" || outcome === "model_error",
    inputTokens: usage?.inputTokens ?? 0,
    outputTokens: usage?.outputTokens ?? 0,
    totalTokens: usage?.totalTokens ?? 0,
  });
}

async function getClientIp(): Promise<string> {
  const h = await headers();
  return (
    h.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    h.get("x-real-ip") ||
    "unknown"
  );
}

export async function parseNaturalLanguageSearch(
  input: string,
  locale: string
): Promise<{ data: NLSearchFilters | null; error: string | null }> {
  if (!isNaturalLanguageSearchEnabled()) {
    return { data: null, error: NL_SEARCH_DISABLED_MESSAGE };
  }

  const trimmed = input.trim();
  if (trimmed.length < 5) {
    return { data: null, error: "Input too short" };
  }

  // Emergencies never bill and are not cached. Chest pain is also a
  // cardiology keyword, so this has to run before the local matcher.
  // Empty filters (not an error) keep the search bar from putting the
  // raw phrase into a doctor query. This action does not render 999 copy.
  const emergency = detectEmergency(trimmed);
  if (emergency.isEmergency) {
    meterNlSearch("emergency");
    return { data: EMPTY_NL_FILTERS, error: null };
  }

  const ip = await getClientIp();
  const { limited } = await rateLimit(
    `nl-search:${ip}`,
    NL_SEARCH_RATE_LIMIT,
    NL_SEARCH_RATE_WINDOW_MS
  );
  if (limited) {
    return {
      data: null,
      error: "Too many searches. Please try again later.",
    };
  }

  const locations = await getActiveLocations();
  const local = tryLocalNlSearch(trimmed, locations);
  if (local) {
    meterNlSearch("local");
    return { data: local, error: null };
  }

  const supabase = createAdminClient();
  const hash = hashInput(trimmed, locale);

  try {
    const { data: cached } = await supabase
      .from("ai_search_cache")
      .select("parsed_filters")
      .eq("input_hash", hash)
      .gt("expires_at", new Date().toISOString())
      .single();

    if (cached?.parsed_filters) {
      meterNlSearch("cache");
      return {
        data: cached.parsed_filters as NLSearchFilters,
        error: null,
      };
    }
  } catch {
    // Cache miss or table unavailable — fall through.
  }

  if (trimmed.length > NL_SEARCH_MAX_INPUT) {
    return { data: null, error: "Input too long" };
  }

  if (!isAIEnabled()) {
    log.warn("[AI] parseNaturalLanguageSearch: OPENAI_API_KEY not found in env");
    return { data: null, error: "AI not configured" };
  }

  const specialtyList = SPECIALTIES.map(
    (s) => `${s.slug} (${s.nameKey.replace("specialty.", "").replace(/_/g, " ")})`
  ).join(", ");

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), AI_TIMEOUT_MS);

  try {
    const { object, usage } = await generateObject({
      model: aiModel,
      schema: nlSearchSchema,
      maxRetries: 0,
      prompt: `Parse this natural language healthcare search query into structured filters.

Available specialties: ${specialtyList}
Common languages: English, German, Turkish, French, Italian, Spanish, Portuguese, Arabic, Russian, Chinese, Japanese

User query: "${trimmed}"
User locale: ${locale}

IMPORTANT TRIAGE RULES:
- For vague, non-specific symptoms (general pain, fatigue, fever, cold, flu-like symptoms, dizziness, nausea, general malaise), the specialty MUST be "general-practice" (GP).
- When a symptom clearly points to a specific body part or organ system, route to the appropriate specialist:
  • Teeth/gums/toothache/dental pain → "dentistry"
  • Skin rash/acne/mole/eczema → "dermatology"
  • Heart palpitations/chest pain/blood pressure → "cardiology"
  • Broken bone/joint pain/knee pain/back pain/sports injury → "orthopedics"
  • Eye exam/blurry vision/eye pain → "ophthalmology"
  • Ear pain/hearing loss/sinus/tonsils → "ent"
  • Headaches/migraines/numbness/seizures → "neurology"
  • Anxiety/depression/therapy/stress → "psychology"
  • Breathing difficulty/asthma/chronic cough → "pulmonology"
  • Stomach pain/acid reflux/digestive issues → "gastroenterology"
  • Allergies/hay fever/allergic reactions → "allergy"
  • Child health/baby/pediatric → "pediatrics"
  • Women's health/pregnancy/gynecological → "gynecology"
  • Diabetes/thyroid/hormones → "endocrinology"
  • Kidney pain/urinary issues → "nephrology" or "urology"
  • Weight management/diet/nutrition → "nutrition"
  • Cosmetic/botox/aesthetic → "aesthetic-medicine"
  • Physical rehab/mobility/physiotherapy → "physiotherapy"
- Only default to "general-practice" when the symptom is truly vague and does not point to any specific specialist.

Rules:
- Map specialty references to the exact slug (e.g. "heart doctor" → "cardiology", "skin doctor" → "dermatology")
- Map prices to CENTS (e.g. "100 euros" → 10000, "50 dollars" → 5000)
- If the user explicitly names a city or place, set location to that place name as written (e.g. "Birmingham"). Do not invent a slug and do not pick a city they did not name. Otherwise null.
- Extract rating preferences (e.g. "highly rated" → 4.0, "best rated" → 4.5)
- Set consultationType only if explicitly mentioned (e.g. "video call", "online", "in person")
- Put any remaining text that doesn't map to a filter in the "query" field

CRITICAL FILTER RULES:
- ONLY include filters that the user EXPLICITLY states in their query text.
- Do NOT infer language from the user's locale or the language the query is written in. Only set language if the user explicitly says something like "Turkish-speaking doctor" or "doctor who speaks German".
- Do NOT infer a location. Only set location when the user names a city or place.
- When in doubt, leave a filter as null rather than guessing.
- The "query" field should ONLY contain text that does NOT map to any filter. If the entire input maps to a specialty (e.g. "I have a headache" → general-practice), set query to null. Do NOT echo the user's input back in the query field.`,
      abortSignal: controller.signal,
    });

    meterNlSearch("model", usage);

    const validSlugs = new Set(SPECIALTIES.map((s) => s.slug));

    let resolvedLocation: string | null = null;
    if (object.location && locations) {
      resolvedLocation = resolveLocationSlug(object.location, locations);
    }
    if (!resolvedLocation && locations) {
      resolvedLocation = matchLocationFromSearchText(trimmed, locations);
    }

    const result: NLSearchFilters = {
      ...object,
      specialty:
        object.specialty && validSlugs.has(object.specialty)
          ? object.specialty
          : null,
      location: resolvedLocation,
    };

    // Hash and parsed filters only. The plaintext query column is not
    // written; a leftover NOT NULL column fails the upsert, which is ignored.
    try {
      await supabase.from("ai_search_cache").upsert(
        {
          input_hash: hash,
          locale,
          parsed_filters: result as unknown as Record<string, unknown>,
          expires_at: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
        },
        { onConflict: "input_hash" }
      );
    } catch {
      // Cache write failure is non-critical
    }

    return { data: result, error: null };
  } catch (err) {
    meterNlSearch("model_error");
    log.error("NL search parse error", {
      name: err instanceof Error ? err.name : "unknown",
    });
    return { data: null, error: "AI search parsing failed" };
  } finally {
    clearTimeout(timeout);
  }
}
