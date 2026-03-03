"use server";

import { generateObject } from "ai";
import { aiModel, isAIEnabled } from "@/lib/ai/provider";
import {
  symptomAnalysisSchema,
  nlSearchSchema,
  type SymptomAnalysis,
  type NLSearchFilters,
} from "@/lib/ai/schemas";
import { createAdminClient } from "@/lib/supabase/admin";
import { SPECIALTIES } from "@/lib/constants/specialties";
import crypto from "crypto";

const AI_TIMEOUT_MS = 8000;

function hashInput(text: string, locale: string): string {
  return crypto
    .createHash("sha256")
    .update(text.toLowerCase().trim() + "|" + locale)
    .digest("hex");
}

// ── Feature 1: AI Symptom Analysis ──────────────────────────

export async function analyzeSymptoms(
  input: string,
  locale: string
): Promise<{ data: SymptomAnalysis | null; error: string | null }> {
  if (!isAIEnabled()) {
    console.warn("[AI] analyzeSymptoms: OPENAI_API_KEY not found in env");
    return { data: null, error: "AI not configured" };
  }
  console.log("[AI] analyzeSymptoms: starting for input:", input.substring(0, 50));

  const trimmed = input.trim();
  if (trimmed.length < 3) {
    return { data: null, error: "Input too short" };
  }

  const supabase = createAdminClient();
  const hash = hashInput(trimmed, locale);

  // 1. Check cache
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

  // 2. AI call with timeout
  const specialtySlugs = SPECIALTIES.map((s) => s.slug).join(", ");

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), AI_TIMEOUT_MS);

    const { object } = await generateObject({
      model: aiModel,
      schema: symptomAnalysisSchema,
      prompt: `You are a medical triage assistant for a healthcare booking platform.
Given the patient's symptoms, determine:
1. The most appropriate medical specialty (MUST be one of: ${specialtySlugs})
2. Up to 2 related specialties (from the same list)
3. Urgency level: "emergency" if symptoms suggest immediate danger (chest pain + breathing difficulty, stroke signs, severe bleeding, loss of consciousness), "urgent" if should be seen within days, "routine" for standard appointments
4. Whether in-person or video consultation is appropriate

Patient symptoms: "${trimmed}"
Patient locale: ${locale}

CRITICAL: If symptoms suggest a medical emergency, you MUST set urgency to "emergency". Patient safety is the top priority.
Return ONLY specialty slugs from the allowed list above.`,
      abortSignal: controller.signal,
    });

    clearTimeout(timeout);
    console.log("[AI] analyzeSymptoms: AI returned:", JSON.stringify(object));

    // Validate the specialty slug
    const validSlugs = new Set(SPECIALTIES.map((s) => s.slug));
    const result: SymptomAnalysis = {
      ...object,
      primarySpecialty: validSlugs.has(object.primarySpecialty)
        ? object.primarySpecialty
        : "general-practice",
      relatedSpecialties: object.relatedSpecialties.filter((s) =>
        validSlugs.has(s)
      ),
    };

    // 3. Cache the result
    try {
      await supabase.from("ai_symptom_cache").upsert(
        {
          input_hash: hash,
          input_text: trimmed,
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
    console.error("AI symptom analysis error:", err);
    return { data: null, error: "AI analysis failed" };
  }
}

// ── Feature 4: Natural Language Search ──────────────────────

export async function parseNaturalLanguageSearch(
  input: string,
  locale: string
): Promise<{ data: NLSearchFilters | null; error: string | null }> {
  if (!isAIEnabled()) {
    console.warn("[AI] parseNaturalLanguageSearch: OPENAI_API_KEY not found in env");
    return { data: null, error: "AI not configured" };
  }
  console.log("[AI] parseNaturalLanguageSearch: starting for input:", input.substring(0, 50));

  const trimmed = input.trim();
  if (trimmed.length < 5) {
    return { data: null, error: "Input too short" };
  }

  const supabase = createAdminClient();
  const hash = hashInput(trimmed, locale);

  // 1. Check cache
  try {
    const { data: cached } = await supabase
      .from("ai_search_cache")
      .select("parsed_filters")
      .eq("input_hash", hash)
      .gt("expires_at", new Date().toISOString())
      .single();

    if (cached?.parsed_filters) {
      console.log("[AI] parseNaturalLanguageSearch: cache hit");
      return {
        data: cached.parsed_filters as NLSearchFilters,
        error: null,
      };
    }
  } catch (e) {
    // Cache miss
    console.log("[AI] parseNaturalLanguageSearch: cache miss or table error:", (e as Error)?.message);
  }

  // 2. Build context
  const specialtyList = SPECIALTIES.map(
    (s) => `${s.slug} (${s.nameKey.replace("specialty.", "").replace(/_/g, " ")})`
  ).join(", ");

  const { data: locations } = await supabase
    .from("locations")
    .select("slug, city, country_code")
    .eq("is_active", true);

  const locationList =
    locations
      ?.map((l) => `${l.slug} (${l.city}, ${l.country_code})`)
      .join(", ") || "";

  // 3. AI call
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), AI_TIMEOUT_MS);

    const { object } = await generateObject({
      model: aiModel,
      schema: nlSearchSchema,
      prompt: `Parse this natural language healthcare search query into structured filters.

Available specialties: ${specialtyList}
Available locations: ${locationList}
Common languages: English, German, Turkish, French, Italian, Spanish, Portuguese, Arabic, Russian, Chinese, Japanese

User query: "${trimmed}"
User locale: ${locale}

Rules:
- Map specialty references to the exact slug (e.g. "heart doctor" → "cardiology", "skin doctor" → "dermatology")
- Map prices to CENTS (e.g. "100 euros" → 10000, "50 dollars" → 5000)
- Map location references to the closest location slug
- Extract language preferences (e.g. "Turkish-speaking" → "Turkish")
- Extract rating preferences (e.g. "highly rated" → 4.0, "best rated" → 4.5)
- Set consultationType only if explicitly mentioned (e.g. "video call", "online", "in person")
- Put any remaining text that doesn't map to a filter in the "query" field
- Only include filters that are clearly specified in the query`,
      abortSignal: controller.signal,
    });

    clearTimeout(timeout);
    console.log("[AI] parseNaturalLanguageSearch: AI returned:", JSON.stringify(object));

    // Validate specialty slug if present
    const validSlugs = new Set(SPECIALTIES.map((s) => s.slug));

    // Validate / normalize location slug if present
    let resolvedLocation: string | null = null;
    if (object.location && locations) {
      const locSlugs = new Set(locations.map((l) => l.slug));
      if (locSlugs.has(object.location)) {
        resolvedLocation = object.location;
      } else {
        // Fuzzy-match: AI may return city name instead of slug
        const lower = object.location.toLowerCase();
        const match = locations.find(
          (l) =>
            l.city.toLowerCase() === lower ||
            l.slug.toLowerCase().startsWith(lower)
        );
        if (match) resolvedLocation = match.slug;
      }
    }

    const result: NLSearchFilters = {
      ...object,
      specialty:
        object.specialty && validSlugs.has(object.specialty)
          ? object.specialty
          : null,
      location: resolvedLocation,
    };

    // 4. Cache result
    try {
      await supabase.from("ai_search_cache").upsert(
        {
          input_hash: hash,
          input_text: trimmed,
          locale,
          parsed_filters: result as unknown as Record<string, unknown>,
          expires_at: new Date(
            Date.now() + 60 * 60 * 1000
          ).toISOString(),
        },
        { onConflict: "input_hash" }
      );
    } catch {
      // Cache write failure is non-critical
    }

    return { data: result, error: null };
  } catch (err) {
    console.error("NL search parse error:", err);
    return { data: null, error: "AI search parsing failed" };
  }
}
