/**
 * JSON Schema tool definitions for Grok Realtime session.update,
 * plus server-side execution via existing chat tools.
 */

import { buildChatTools } from "@/lib/chat/tools";
import type { DoctorsSearchFilters } from "@/lib/voice/search-url";

/** xAI Realtime custom function tool shape */
export type RealtimeFunctionTool = {
  type: "function";
  name: string;
  description: string;
  parameters: Record<string, unknown>;
};

const nullableString = { type: ["string", "null"] as const };
const nullableNumber = { type: ["number", "null"] as const };
const nullableBoolean = { type: ["boolean", "null"] as const };

/**
 * Tools registered on the realtime session.
 * Keep in sync with buildChatTools names / params.
 */
export function buildRealtimeFunctionTools(): RealtimeFunctionTool[] {
  return [
    {
      type: "function",
      name: "analyzeSymptoms",
      description:
        "Map how the user feels to a specialty slug. Quiet fallback only. If urgency is emergency, do not search doctors.",
      parameters: {
        type: "object",
        properties: {
          description: {
            type: "string",
            description: "User description in their own words",
          },
        },
        required: ["description"],
      },
    },
    {
      type: "function",
      name: "searchDoctors",
      description:
        "Search verified private doctors. Returns cards shown in the UI — do not list them in speech.",
      parameters: {
        type: "object",
        properties: {
          specialty: { ...nullableString, description: "Specialty slug e.g. dermatology" },
          query: { ...nullableString, description: "Free-text query" },
          locationSlug: { ...nullableString, description: "Location slug e.g. london-uk" },
          language: { ...nullableString },
          consultationType: {
            type: ["string", "null"],
            enum: ["in_person", "video", null],
          },
          skill: { ...nullableString },
          minPrice: nullableNumber,
          maxPrice: nullableNumber,
          minRating: nullableNumber,
          availableToday: nullableBoolean,
          sort: {
            type: ["string", "null"],
            enum: ["featured", "soonest", "price_asc", "price_desc", "rating", null],
          },
          providerType: {
            type: ["string", "null"],
            enum: ["doctor", "testing_service", null],
          },
        },
        required: [],
      },
    },
    {
      type: "function",
      name: "refineSearch",
      description:
        "Refine current results (video only, sooner, language, price). Prefer over a brand-new search when browsing.",
      parameters: {
        type: "object",
        properties: {
          consultationType: {
            type: ["string", "null"],
            enum: ["in_person", "video", null],
          },
          language: nullableString,
          minPrice: nullableNumber,
          maxPrice: nullableNumber,
          minRating: nullableNumber,
          availableToday: nullableBoolean,
          sort: {
            type: ["string", "null"],
            enum: ["featured", "soonest", "price_asc", "price_desc", "rating", null],
          },
          locationSlug: nullableString,
          specialty: nullableString,
          skill: nullableString,
          query: nullableString,
          clearConsultationType: nullableBoolean,
        },
        required: [],
      },
    },
    {
      type: "function",
      name: "findSoonestAvailability",
      description: "Find doctors with the soonest open slots.",
      parameters: {
        type: "object",
        properties: {
          specialty: nullableString,
          locationSlug: nullableString,
          consultationType: {
            type: ["string", "null"],
            enum: ["in_person", "video", null],
          },
          language: nullableString,
        },
        required: [],
      },
    },
    {
      type: "function",
      name: "answerFaq",
      description: "Answer how the MyDoctors360 platform works (pricing, booking, video, etc.).",
      parameters: {
        type: "object",
        properties: {
          question: { type: "string" },
        },
        required: ["question"],
      },
    },
    {
      type: "function",
      name: "proposeBooking",
      description:
        "Prepare a booking draft when user clearly picks doctor + date/time from tool results. Never invent slots. UI must confirm.",
      parameters: {
        type: "object",
        properties: {
          doctorSlug: { type: "string" },
          doctorName: { type: "string" },
          date: { type: "string", description: "YYYY-MM-DD" },
          time: { type: "string", description: "HH:MM start time from availability" },
          consultationType: {
            type: "string",
            enum: ["in_person", "video"],
          },
        },
        required: [
          "doctorSlug",
          "doctorName",
          "date",
          "time",
          "consultationType",
        ],
      },
    },
  ];
}

export type RealtimeToolName =
  | "analyzeSymptoms"
  | "searchDoctors"
  | "refineSearch"
  | "findSoonestAvailability"
  | "answerFaq"
  | "proposeBooking"
  | "applySearchFilters";

/**
 * Execute a realtime function tool using the same logic as text chat tools.
 */
export async function executeRealtimeTool(
  name: string,
  args: Record<string, unknown>,
  locale: string,
  currentFilters?: DoctorsSearchFilters
): Promise<unknown> {
  const tools = buildChatTools(locale, { currentFilters });
  const toolMap = tools as Record<
    string,
    { execute?: (input: Record<string, unknown>) => Promise<unknown> }
  >;
  const tool = toolMap[name];
  if (!tool?.execute) {
    return { ok: false, error: `Unknown tool: ${name}` };
  }
  try {
    // Normalize nullish optional fields — models often omit keys
    return await tool.execute(args as never);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Tool failed";
    return { ok: false, error: message };
  }
}

/** Map app locale → xAI transcription language_hint (regional where required). */
export function languageHintForLocale(locale: string): string {
  const base = locale.split("-")[0]?.toLowerCase() || "en";
  const map: Record<string, string> = {
    en: "en",
    de: "de",
    tr: "tr",
    fr: "fr",
    it: "it",
    es: "es-ES",
    pt: "pt-PT",
    ja: "ja",
    zh: "zh",
  };
  return map[base] || "en";
}
