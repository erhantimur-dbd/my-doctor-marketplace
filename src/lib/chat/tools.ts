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
import { getSkill } from "@/lib/constants/skills";
import {
  buildDoctorsSearchPath,
  type DoctorsSearchFilters,
} from "@/lib/voice/search-url";
import {
  buildSearchResultsSpokenSummary,
  mergeSearchFilters,
} from "@/lib/voice/merge-filters";

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
  /** Full list of the doctor's specialties, primary first, deduped. */
  allSpecialties: string[];
  /** Doctor-declared skills (labels, not slugs). Empty if none declared. */
  allSkills: string[];
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

export type ChatToolsContext = {
  /** Current Find a Doctor filters (from client intent store / URL) */
  currentFilters?: DoctorsSearchFilters;
};

export function buildChatTools(locale: string, context: ChatToolsContext = {}) {
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
        "Search MyDoctors360 for verified private doctors. Supports full Find a Doctor filters: specialty, free-text query, location, language, in-person/video, skill, price range, rating, available today, sort (featured|soonest|price_asc|price_desc|rating). Returns up to 5 doctors as rich cards. Also returns a searchPath the client applies to the Find a Doctor page. Call after analyzeSymptoms or when the user names care needs. If urgency was emergency, do NOT call this tool.",
      inputSchema: z.object({
        specialty: z
          .string()
          .nullable()
          .describe(
            "Specialty slug such as 'dermatology', 'cardiology', 'general-practice'. Use the slug returned by analyzeSymptoms when available."
          ),
        query: z
          .string()
          .nullable()
          .describe(
            "Free-text search (symptoms, doctor name, or condition words) when no clean specialty slug is known."
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
        skill: z
          .string()
          .nullable()
          .describe(
            "A specific procedure or condition slug from the skills taxonomy (e.g. 'mole-check', 'botox', 'knee-surgery', 'ibs-treatment', 'migraine-management', 'fertility-care'). Use this when the user asks about a specific procedure or condition, not just a broad specialty. Null if the user only named a broad specialty."
          ),
        minPrice: z
          .number()
          .nullable()
          .describe("Minimum consultation fee in major currency units (e.g. 50 for £50). Null if not specified."),
        maxPrice: z
          .number()
          .nullable()
          .describe("Maximum consultation fee in major currency units. Null if not specified."),
        minRating: z
          .number()
          .nullable()
          .describe("Minimum average rating 1-5. Null if not specified."),
        availableToday: z
          .boolean()
          .nullable()
          .describe("True if user wants someone available today."),
        sort: z
          .enum(["featured", "soonest", "price_asc", "price_desc", "rating"])
          .nullable()
          .describe("Result sort order. Prefer soonest when user wants earliest appointment."),
        providerType: z
          .enum(["doctor", "testing_service"])
          .nullable()
          .describe("Filter provider type. Null for all."),
      }),
      execute: async ({
        specialty,
        query,
        locationSlug,
        language,
        consultationType,
        skill,
        minPrice,
        maxPrice,
        minRating,
        availableToday,
        sort,
        providerType,
      }) => {
        // minPrice/maxPrice are major currency units; searchDoctors multiplies by 100.
        const filters = {
          specialty: specialty || undefined,
          query: query || undefined,
          location: locationSlug || undefined,
          language: language || undefined,
          consultationType: consultationType || undefined,
          skill: skill || undefined,
          minPrice: minPrice ?? undefined,
          maxPrice: maxPrice ?? undefined,
          minRating: minRating ?? undefined,
          availableToday: availableToday === true ? true : undefined,
          sort: sort || (availableToday ? "soonest" : "featured"),
          providerType: providerType || undefined,
          page: 1,
        };
        const result = await searchDoctorsAction(filters);
        const searchPath = buildDoctorsSearchPath({
          specialty,
          query,
          locationSlug,
          language,
          consultationType,
          skill,
          minPrice: minPrice ?? null,
          maxPrice: maxPrice ?? null,
          minRating: minRating ?? null,
          availableToday: availableToday === true,
          sort: filters.sort,
          providerType,
        });

        const rawDoctors = (result.doctors || []).slice(0, 5);

        const doctorIds = rawDoctors
          .map((d) => (d as { id?: string }).id)
          .filter((id): id is string => !!id);
        const [inPersonAvail, videoAvail, skillsByDoctor] = doctorIds.length
          ? await Promise.all([
              getNextAvailabilityBatch(doctorIds, "in_person"),
              getNextAvailabilityBatch(doctorIds, "video"),
              fetchDoctorSkills(doctorIds),
            ])
          : [
              {} as Awaited<ReturnType<typeof getNextAvailabilityBatch>>,
              {} as Awaited<ReturnType<typeof getNextAvailabilityBatch>>,
              {} as Record<string, string[]>,
            ];

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
            // Primary first, then the rest, deduped by slug.
            const seen = new Set<string>();
            const allSpecialties: string[] = [];
            if (primary) {
              seen.add(primary.slug);
              allSpecialties.push(formatSpecialtyName(primary.name_key));
            }
            for (const s of d.specialties || []) {
              if (seen.has(s.specialty.slug)) continue;
              seen.add(s.specialty.slug);
              allSpecialties.push(formatSpecialtyName(s.specialty.name_key));
            }

            const inPerson = inPersonAvail[d.id];
            const video = videoAvail[d.id];
            const allSkills = (skillsByDoctor as Record<string, string[]>)[d.id] || [];
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
              allSpecialties,
              allSkills,
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

        const total = result.total ?? doctors.length;
        const soonestNote = buildSoonestNote(doctors);
        const spokenSummary = buildSearchResultsSpokenSummary({
          total,
          specialtyLabel: specialty
            ? formatSpecialtyName(`specialty.${specialty.replace(/-/g, "_")}`)
            : null,
          locationLabel: locationSlug || null,
          consultationType,
          availableToday: availableToday === true,
          sort: filters.sort,
          language,
          sampleNames: doctors.slice(0, 2).map((d) => d.name),
          soonestNote,
        });

        return {
          ok: true as const,
          doctors,
          total,
          searchPath,
          spokenSummary,
          filters: {
            specialty,
            query,
            location: locationSlug,
            language,
            consultationType,
            skill,
            minPrice,
            maxPrice,
            minRating,
            availableToday: availableToday === true,
            sort: filters.sort,
            providerType,
          },
          fallbackApplied: ("fallbackApplied" in result
            ? (result as { fallbackApplied?: string | null }).fallbackApplied
            : null) || null,
        };
      },
    }),

    /**
     * Refine current listing filters (voice: "only video", "sooner", "under £150").
     * Merges with context.currentFilters so the user does not restate specialty/city.
     */
    refineSearch: tool({
      description:
        "Refine the CURRENT search while the user is browsing results. Use when they say things like 'only video', 'sooner', 'under 200', 'speaks Turkish', 'available today'. Merges with existing filters. Returns updated cards, searchPath, and spokenSummary. Prefer this over searchDoctors when a search is already in progress.",
      inputSchema: z.object({
        consultationType: z.enum(["in_person", "video"]).nullable(),
        language: z.string().nullable(),
        minPrice: z.number().nullable(),
        maxPrice: z.number().nullable(),
        minRating: z.number().nullable(),
        availableToday: z.boolean().nullable(),
        sort: z
          .enum(["featured", "soonest", "price_asc", "price_desc", "rating"])
          .nullable(),
        locationSlug: z.string().nullable(),
        specialty: z.string().nullable(),
        skill: z.string().nullable(),
        query: z.string().nullable(),
        clearConsultationType: z
          .boolean()
          .nullable()
          .describe("True to remove video/in-person filter."),
      }),
      execute: async (patch) => {
        const base = context.currentFilters || {};
        const mergePatch: DoctorsSearchFilters = {};
        if (patch.consultationType)
          mergePatch.consultationType = patch.consultationType;
        if (patch.clearConsultationType) mergePatch.consultationType = null;
        if (patch.language) mergePatch.language = patch.language;
        if (patch.minPrice != null) mergePatch.minPrice = patch.minPrice;
        if (patch.maxPrice != null) mergePatch.maxPrice = patch.maxPrice;
        if (patch.minRating != null) mergePatch.minRating = patch.minRating;
        if (patch.availableToday === true) {
          mergePatch.availableToday = true;
          mergePatch.sort = patch.sort || "soonest";
        }
        if (patch.sort) mergePatch.sort = patch.sort;
        if (patch.locationSlug) mergePatch.location = patch.locationSlug;
        if (patch.specialty) mergePatch.specialty = patch.specialty;
        if (patch.skill) mergePatch.skill = patch.skill;
        if (patch.query) mergePatch.query = patch.query;

        const merged = mergeSearchFilters(base, mergePatch);
        const searchPath = buildDoctorsSearchPath(merged);
        const result = await searchDoctorsAction({
          specialty: merged.specialty || undefined,
          query: merged.query || undefined,
          location: merged.location || undefined,
          language: merged.language || undefined,
          consultationType: merged.consultationType || undefined,
          skill: merged.skill || undefined,
          minPrice: merged.minPrice ?? undefined,
          maxPrice: merged.maxPrice ?? undefined,
          minRating: merged.minRating ?? undefined,
          availableToday: merged.availableToday === true ? true : undefined,
          sort: merged.sort || "featured",
          page: 1,
        });
        const rawDoctors = (result.doctors || []).slice(0, 5);
        const doctorIds = rawDoctors
          .map((d) => (d as { id?: string }).id)
          .filter((id): id is string => !!id);
        const ctype =
          merged.consultationType === "video" ? "video" : "in_person";
        const avail = doctorIds.length
          ? await getNextAvailabilityBatch(doctorIds, ctype)
          : {};

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
          const next = avail[d.id];
          const slots = next
            ? next.slots.slice(0, 3).map((s) => ({
                date: next.date,
                start: s.start,
                end: s.end,
                consultationType: next.consultationType,
              }))
            : [];
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
            allSpecialties: primary
              ? [formatSpecialtyName(primary.name_key)]
              : [],
            allSkills: [],
            city: d.location?.city || null,
            countryCode: d.location?.country_code || null,
            rating: Number(d.avg_rating) || 0,
            reviewCount: d.total_reviews || 0,
            consultationFeeCents: d.consultation_fee_cents,
            currency: d.base_currency,
            consultationTypes: d.consultation_types || [],
            languages: d.languages || [],
            isVerified: d.verification_status === "verified",
            slotsByType: {
              in_person: ctype === "in_person" ? slots : [],
              video: ctype === "video" ? slots : [],
            },
          };
        });

        const total = result.total ?? doctors.length;
        const spokenSummary = buildSearchResultsSpokenSummary({
          total,
          specialtyLabel: merged.specialty || null,
          locationLabel: merged.location || null,
          consultationType: merged.consultationType,
          availableToday: merged.availableToday === true,
          sort: merged.sort,
          language: merged.language,
          sampleNames: doctors.slice(0, 2).map((d) => d.name),
          soonestNote: buildSoonestNote(doctors),
        });

        return {
          ok: true as const,
          doctors,
          total,
          searchPath,
          spokenSummary,
          filters: merged,
          autoApplyListing: true,
        };
      },
    }),

    /**
     * Slot-aware: who among current matches (or a fresh search) has the soonest slots.
     */
    findSoonestAvailability: tool({
      description:
        "Answer 'who is free this week / soonest available' for the current specialty/location filters. Uses live availability slots. Does not book.",
      inputSchema: z.object({
        consultationType: z.enum(["in_person", "video"]).nullable(),
        specialty: z.string().nullable(),
        locationSlug: z.string().nullable(),
      }),
      execute: async ({ consultationType, specialty, locationSlug }) => {
        const base = context.currentFilters || {};
        const merged = mergeSearchFilters(base, {
          specialty: specialty || undefined,
          location: locationSlug || undefined,
          consultationType: consultationType || undefined,
          sort: "soonest",
          availableToday: null,
        });
        const ctype =
          merged.consultationType === "video" ? "video" : "in_person";
        const result = await searchDoctorsAction({
          specialty: merged.specialty || undefined,
          location: merged.location || undefined,
          language: merged.language || undefined,
          consultationType: ctype,
          skill: merged.skill || undefined,
          sort: "soonest",
          page: 1,
        });
        const rawDoctors = (result.doctors || []).slice(0, 8);
        const doctorIds = rawDoctors
          .map((d) => (d as { id?: string }).id)
          .filter((id): id is string => !!id);
        const avail = await getNextAvailabilityBatch(doctorIds, ctype);

        type Row = {
          name: string;
          slug: string;
          date: string | null;
          firstSlot: string | null;
        };
        const rows: Row[] = [];
        for (const raw of rawDoctors) {
          const d = raw as {
            id: string;
            slug: string;
            title?: string | null;
            profile?: { first_name?: string; last_name?: string };
          };
          const a = avail[d.id];
          const name = `${d.title || "Dr."} ${d.profile?.first_name || ""} ${
            d.profile?.last_name || ""
          }`
            .replace(/\s+/g, " ")
            .trim();
          rows.push({
            name,
            slug: d.slug,
            date: a?.date || null,
            firstSlot: a?.slots?.[0]?.start || null,
          });
        }
        rows.sort((a, b) => {
          if (!a.date && !b.date) return 0;
          if (!a.date) return 1;
          if (!b.date) return -1;
          return a.date.localeCompare(b.date);
        });

        const withSlots = rows.filter((r) => r.date);
        const top = withSlots.slice(0, 3);
        const spokenSummary =
          top.length === 0
            ? "I could not find open slots for these doctors in the next two weeks. Try video visits or a wider area."
            : `Soonest openings: ${top
                .map(
                  (r) =>
                    `${r.name} on ${r.date}${
                      r.firstSlot ? ` around ${r.firstSlot.slice(0, 5)}` : ""
                    }`
                )
                .join("; ")}.`;

        const searchPath = buildDoctorsSearchPath({
          ...merged,
          sort: "soonest",
          consultationType: ctype,
        });

        return {
          ok: true as const,
          soonest: top,
          spokenSummary,
          searchPath,
          filters: { ...merged, sort: "soonest", consultationType: ctype },
          autoApplyListing: true,
        };
      },
    }),

    applySearchFilters: tool({
      description:
        "Build a Find a Doctor URL from full filters (does not book). Prefer refineSearch when refining an existing search.",
      inputSchema: z.object({
        query: z.string().nullable(),
        specialty: z.string().nullable(),
        locationSlug: z.string().nullable(),
        language: z.string().nullable(),
        consultationType: z.enum(["in_person", "video"]).nullable(),
        skill: z.string().nullable(),
        minPrice: z.number().nullable(),
        maxPrice: z.number().nullable(),
        minRating: z.number().nullable(),
        availableToday: z.boolean().nullable(),
        sort: z
          .enum(["featured", "soonest", "price_asc", "price_desc", "rating"])
          .nullable(),
        providerType: z.enum(["doctor", "testing_service"]).nullable(),
        spokenSummary: z
          .string()
          .describe(
            "One short sentence describing filters applied, for voice readback."
          ),
      }),
      execute: async (input) => {
        const path = buildDoctorsSearchPath({
          query: input.query,
          specialty: input.specialty,
          locationSlug: input.locationSlug,
          language: input.language,
          consultationType: input.consultationType,
          skill: input.skill,
          minPrice: input.minPrice,
          maxPrice: input.maxPrice,
          minRating: input.minRating,
          availableToday: input.availableToday === true,
          sort: input.sort,
          providerType: input.providerType,
        });
        return {
          ok: true as const,
          path,
          searchPath: path,
          spokenSummary: input.spokenSummary,
          autoApplyListing: true,
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

function buildSoonestNote(doctors: ChatDoctor[]): string | null {
  for (const d of doctors) {
    const slot =
      d.slotsByType.video[0] || d.slotsByType.in_person[0] || null;
    if (slot?.date) {
      const time = slot.start?.slice(0, 5) || "";
      return `Earliest opening among these is ${d.name} on ${slot.date}${
        time ? ` around ${time}` : ""
      }.`;
    }
  }
  return null;
}

/**
 * Batch-fetch doctor-declared skills for a set of doctor IDs. Returns a map
 * from doctor_id to an array of skill display labels (resolved via the
 * curated taxonomy). Unknown slugs are dropped so stale rows don't leak.
 */
async function fetchDoctorSkills(
  doctorIds: string[]
): Promise<Record<string, string[]>> {
  if (doctorIds.length === 0) return {};
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("doctor_skills")
    .select("doctor_id, skill_slug")
    .in("doctor_id", doctorIds);
  if (error || !data) return {};
  const result: Record<string, string[]> = {};
  for (const row of data as { doctor_id: string; skill_slug: string }[]) {
    const meta = getSkill(row.skill_slug);
    if (!meta) continue;
    if (!result[row.doctor_id]) result[row.doctor_id] = [];
    result[row.doctor_id].push(meta.label);
  }
  return result;
}
