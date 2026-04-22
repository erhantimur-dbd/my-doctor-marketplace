/**
 * AI SDK tool definitions for the MyDoctors360 chat assistant.
 *
 * Two tools for Phase 1:
 *   1. analyzeSymptoms — wraps the specialty-finder action. Maps the
 *      user's description to the right specialty slug, with a 999
 *      emergency short-circuit handled deterministically upstream
 *      (src/lib/ai/emergency-classifier.ts). The LLM never decides
 *      urgency — `urgency` comes back as "emergency" only when the
 *      deterministic classifier fires.
 *   2. searchDoctors   — wraps the existing search action, shaped down
 *      to the slim chat card format.
 *
 * The tools intentionally return only the fields the chat doctor card needs.
 * The full DoctorCard component is NOT reused in chat — the chat uses a
 * purpose-built compact card that matches the competitor's visual density.
 */

import { tool } from "ai";
import { z } from "zod/v4";
import { analyzeSymptoms as analyzeSymptomsAction } from "@/actions/ai";
import {
  searchDoctors as searchDoctorsAction,
  getNextAvailabilityBatch,
} from "@/actions/search";
import { formatSpecialtyName } from "@/lib/utils";
import { createAdminClient } from "@/lib/supabase/admin";
import { searchArticlesByTags } from "@/components/help-center/help-center-data";

export interface ChatDoctorSlot {
  date: string;
  start: string;
  end: string;
  consultationType: string;
}

export interface ChatDoctor {
  id: string;
  slug: string;
  name: string;
  avatarUrl: string | null;
  specialtyDisplay: string | null;
  relatedSpecialties: string[];
  city: string | null;
  countryCode: string | null;
  rating: number;
  reviewCount: number;
  consultationFeeCents: number;
  currency: string;
  consultationTypes: string[];
  languages: string[];
  isVerified: boolean;
  slotsByType: {
    in_person: ChatDoctorSlot[];
    video: ChatDoctorSlot[];
  };
}

export function buildChatTools(locale: string) {
  return {
    analyzeSymptoms: tool({
      description:
        "Map the user's description of what they need to the right medical specialty on the platform. This is a SPECIALTY FINDER — it does not diagnose, triage, or assess severity. Call this FIRST whenever the user describes how they feel, what hurts, or asks what kind of doctor they should see. Do not call if the user already named a specialty directly. If the tool returns urgency='emergency', that was decided by a deterministic 999 classifier (not by you) and you must follow the safety rule in the system prompt.",
      inputSchema: z.object({
        description: z
          .string()
          .min(3)
          .describe(
            "The user's description of what they are looking for or how they feel, in their own words"
          ),
      }),
      execute: async ({ description }) => {
        const { data, error } = await analyzeSymptomsAction(description, locale);
        if (error || !data) {
          return {
            ok: false as const,
            error: error || "Analysis unavailable",
          };
        }
        return {
          ok: true as const,
          primarySpecialty: data.primarySpecialty,
          relatedSpecialties: data.relatedSpecialties,
          urgency: data.urgency,
          urgencyReason: data.urgencyReason,
          suggestedConsultationType: data.suggestedConsultationType,
        };
      },
    }),

    searchDoctors: tool({
      description:
        "Search MyDoctors360 for verified private doctors matching the given specialty, location, language, or consultation type. Returns up to 5 doctors as rich cards that the client renders inline in the chat. Call this once you know what specialty the user needs — either after analyzeSymptoms or when the user asked directly (e.g. 'dermatologist in London'). If the result urgency was 'emergency', do NOT call this tool.",
      inputSchema: z.object({
        specialty: z
          .string()
          .nullable()
          .describe(
            "Specialty slug such as 'dermatology', 'cardiology', 'general-practice'. Use the slug returned by analyzeSymptoms when available."
          ),
        locationSlug: z
          .string()
          .nullable()
          .describe(
            "Location slug such as 'london-uk' or 'berlin-germany'. Omit (null) if the user did not mention a location."
          ),
        language: z
          .string()
          .nullable()
          .describe(
            "Language name if the user explicitly wants a doctor who speaks a specific language (e.g. 'Turkish', 'German'). Null otherwise."
          ),
        consultationType: z
          .enum(["in_person", "video"])
          .nullable()
          .describe(
            "Set only if the user explicitly asked for in-person or video. Null otherwise."
          ),
      }),
      execute: async ({ specialty, locationSlug, language, consultationType }) => {
        const result = await searchDoctorsAction({
          specialty: specialty || undefined,
          location: locationSlug || undefined,
          language: language || undefined,
          consultationType: consultationType || undefined,
          sort: "featured",
          page: 1,
        });

        const rawDoctors = (result.doctors || []).slice(0, 5);

        const doctorIds = rawDoctors
          .map((d) => (d as { id?: string }).id)
          .filter((id): id is string => !!id);
        const [inPersonAvail, videoAvail] = doctorIds.length
          ? await Promise.all([
              getNextAvailabilityBatch(doctorIds, "in_person"),
              getNextAvailabilityBatch(doctorIds, "video"),
            ])
          : [{}, {}];

        const doctors: ChatDoctor[] = rawDoctors.map((raw: Record<string, unknown>) => {
            const d = raw as {
              id: string;
              slug: string;
              title: string | null;
              avg_rating: number | null;
              total_reviews: number | null;
              consultation_fee_cents: number;
              base_currency: string;
              consultation_types: string[] | null;
              languages: string[] | null;
              verification_status: string;
              profile?: {
                first_name?: string;
                last_name?: string;
                avatar_url?: string | null;
              };
              location?: { city?: string; country_code?: string } | null;
              specialties?: {
                is_primary: boolean;
                specialty: { name_key: string; slug: string };
              }[];
            };

            const primary =
              d.specialties?.find((s) => s.is_primary)?.specialty ||
              d.specialties?.[0]?.specialty ||
              null;
            const others = (d.specialties || [])
              .filter(
                (s) => !s.is_primary && s.specialty.slug !== primary?.slug
              )
              .map((s) => formatSpecialtyName(s.specialty.name_key));

            const inPerson = inPersonAvail[d.id];
            const video = videoAvail[d.id];
            const toSlots = (
              a: { date: string; slots: { start: string; end: string }[]; consultationType: string } | undefined
            ): ChatDoctorSlot[] =>
              a
                ? a.slots.slice(0, 3).map((s) => ({
                    date: a.date,
                    start: s.start,
                    end: s.end,
                    consultationType: a.consultationType,
                  }))
                : [];
            const supportsInPerson = (d.consultation_types || []).includes(
              "in_person"
            );
            const supportsVideo = (d.consultation_types || []).includes(
              "video"
            );
            const slotsByType = {
              in_person: supportsInPerson ? toSlots(inPerson) : [],
              video: supportsVideo ? toSlots(video) : [],
            };

            return {
              id: d.id,
              slug: d.slug,
              name: `${d.title || "Dr."} ${d.profile?.first_name || ""} ${
                d.profile?.last_name || ""
              }`
                .replace(/\s+/g, " ")
                .trim(),
              avatarUrl: d.profile?.avatar_url || null,
              specialtyDisplay: primary
                ? formatSpecialtyName(primary.name_key)
                : null,
              relatedSpecialties: others,
              city: d.location?.city || null,
              countryCode: d.location?.country_code || null,
              rating: Number(d.avg_rating) || 0,
              reviewCount: d.total_reviews || 0,
              consultationFeeCents: d.consultation_fee_cents,
              currency: d.base_currency,
              consultationTypes: d.consultation_types || [],
              languages: d.languages || [],
              isVerified: d.verification_status === "verified",
              slotsByType,
            };
          });

        // Fire-and-forget: log search intent for analytics
        createAdminClient()
          .from("chat_search_intents")
          .insert({
            specialty,
            location: locationSlug,
            language,
            consultation_type: consultationType,
            doctors_returned: doctors.length,
          })
          .then(() => {}, () => {});

        return {
          ok: true as const,
          doctors,
          total: result.total ?? doctors.length,
          fallbackApplied: ("fallbackApplied" in result
            ? (result as { fallbackApplied?: string | null }).fallbackApplied
            : null) || null,
        };
      },
    }),

    answerFaq: tool({
      description:
        "Answer a question about how the MyDoctors360 platform works — pricing, payments, cancellation, refunds, video consultations, account setup, supported languages, booking process, etc. Call this when the user asks a non-medical question about the platform. Do NOT call analyzeSymptoms or searchDoctors for platform questions.",
      inputSchema: z.object({
        question: z
          .string()
          .min(3)
          .describe("The user's question about the platform, in their own words"),
      }),
      execute: async ({ question }) => {
        const matches = searchArticlesByTags(question);
        if (matches.length === 0) {
          return {
            ok: false as const,
            error: "No matching help article found",
          };
        }
        const top = matches[0];
        return {
          ok: true as const,
          articleId: top.id,
          categoryId: top.categoryId,
          // i18n keys — the client resolves these with next-intl
          questionKey: `${top.id}.question`,
          answerKey: `${top.id}.answer`,
          relatedArticles: matches.slice(1).map((m) => ({
            articleId: m.id,
            categoryId: m.categoryId,
            questionKey: `${m.id}.question`,
          })),
        };
      },
    }),
  };
}
