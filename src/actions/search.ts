"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import {
  scoreDoctors,
  type MatchContext,
  type DoctorMatchInput,
} from "@/lib/utils/doctor-match-scorer";
import {
  isLaunchRegion,
  LAUNCH_REGION_CODES,
} from "@/lib/constants/launch-regions";
import { specialtySlugToLabel } from "@/lib/constants/related-specialties";
import { log } from "@/lib/utils/logger";
import {
  NO_MATCH_ID,
  KEYWORD_SPECIALTY_MAP,
  rankDoctorsByInventory,
  buildEarliestMsFn,
  pinActiveFeaturedFirst,
  normalizeFeaturedFlag,
  isActivelyFeatured,
  isUserExplicitSort,
  shouldRunRecovery,
  fullyBookedBanner,
  platformEmptyBanner,
  relatedSpecialtiesForRecovery,
  widenRadiusSteps,
  type InventoryRankDoctor,
} from "@/lib/search";
import {
  conditionSpecialtySlugs,
  getConditionHub,
} from "@/lib/constants/condition-hubs";
import { getTopEndorsementsBatch } from "@/actions/reviews";

/** Cap soonest-sort availability RPCs so condition/specialty browse cannot timeout. */
const SOONEST_CANDIDATE_CAP = 100;

/** Build match % map when scoring context is present; does not re-order doctors. */
function buildMatchScoresMap(
  doctors: Record<string, unknown>[],
  filters: SearchFilters
): Record<string, { score: number; reasons: string[] }> | undefined {
  if (!doctors.length) return undefined;
  const context: MatchContext = {
    preferredSpecialty: filters.specialty,
    preferredLanguage: filters.language,
    maxBudget: filters.maxPrice ? filters.maxPrice * 100 : undefined,
    consultationType: filters.consultationType,
  };
  if (
    !context.preferredSpecialty &&
    !context.preferredLanguage &&
    !context.maxBudget
  ) {
    return undefined;
  }
  const doctorInputs: DoctorMatchInput[] = doctors.map((d) => ({
    id: d.id as string,
    avg_rating: d.avg_rating as number | null,
    total_reviews: d.total_reviews as number,
    languages: (d.languages || []) as string[],
    consultation_types: (d.consultation_types || []) as string[],
    consultation_fee_cents: d.consultation_fee_cents as number,
    video_consultation_fee_cents: d.video_consultation_fee_cents as number | null,
    ai_sentiment_tags: (d.ai_sentiment_tags || []) as string[],
    specialties: (d.specialties || []) as DoctorMatchInput["specialties"],
  }));
  const scored = scoreDoctors(doctorInputs, context);
  if (scored.length === 0) return undefined;
  const matchScores: Record<string, { score: number; reasons: string[] }> = {};
  for (const s of scored) {
    matchScores[s.doctorId] = { score: s.matchScore, reasons: s.matchReasons };
  }
  return matchScores;
}

export interface SearchFilters {
  specialty?: string;
  /**
   * Multiple specialty slugs OR'd into the doctor pool (e.g. condition hubs).
   * When set, takes precedence over single `specialty` for inventory matching.
   * Primary specialty for waitlist/UI remains `specialty`.
   */
  specialties?: string[];
  /**
   * Condition hub slug (e.g. "knee-pain"). Resolved to specialty pool +
   * optional soft skill. Preferred over free-text query for browse-by-condition.
   */
  condition?: string;
  location?: string;
  minPrice?: number;
  maxPrice?: number;
  minRating?: number;
  language?: string;
  consultationType?: string;
  query?: string;
  sort?: string;
  page?: number;
  availableToday?: boolean;
  wheelchairAccessible?: boolean;
  userLat?: number;
  userLng?: number;
  providerType?: "doctor" | "testing_service";
  acceptedPayment?: string;
  /** Private medical insurer slug (doctors.accepted_insurers) */
  insurer?: string;
  /** Patient-facing gender filter: female | male | non_binary */
  gender?: string;
  /** Proximity search: latitude of a selected place (borough, street, etc.) */
  placeLat?: number;
  /** Proximity search: longitude of a selected place */
  placeLng?: number;
  /** Proximity search: radius in km (default 25) */
  radius?: number;
  /**
   * Skill slug from the curated taxonomy (src/lib/constants/skills.ts).
   * Filters to doctors who have self-declared this skill in doctor_skills.
   */
  skill?: string;
  /**
   * When true, only doctors with free slots soon
   * (same logic as homepage Available Now chip). Optional specialty /
   * consultationType / liveWindowHours narrow further.
   */
  liveNow?: boolean;
  /** Hours window for liveNow (default 2) */
  liveWindowHours?: number;
  /**
   * Nearby in-person live search: use get_gp_in_person_availability IDs
   * so the doctor list matches the homepage chip counter.
   */
  liveInPersonNearby?: boolean;
  /**
   * Only doctors with at least one free slot in the next N days
   * (for "Next GP Appointment" and similar shortcuts).
   */
  availableWithinDays?: number;
}

export type ConditionSearchMeta = {
  slug: string;
  title: string;
  description: string;
  emoji: string;
  primarySpecialty: string;
  specialtySlugs: string[];
  displayQuery: string;
};

function resolveConditionFilters(filters: SearchFilters): {
  filters: SearchFilters;
  conditionMeta: ConditionSearchMeta | null;
} {
  if (!filters.condition) {
    return { filters, conditionMeta: null };
  }
  const hub = getConditionHub(filters.condition);
  if (!hub) {
    return { filters, conditionMeta: null };
  }
  const specialtySlugs = conditionSpecialtySlugs(hub);
  const next: SearchFilters = {
    ...filters,
    // Primary specialty for waitlist / recovery labels
    specialty: filters.specialty || hub.specialtySlug,
    specialties:
      filters.specialties && filters.specialties.length > 0
        ? filters.specialties
        : specialtySlugs,
    // Soft skill from hub unless caller overrode
    skill: filters.skill || hub.skillSlug,
    // Do not free-text filter on condition browse — specialty pool is the signal
    query: filters.query,
  };
  const conditionMeta: ConditionSearchMeta = {
    slug: hub.slug,
    title: hub.title,
    description: hub.description,
    emoji: hub.emoji,
    primarySpecialty: hub.specialtySlug,
    specialtySlugs,
    displayQuery: hub.displayQuery,
  };
  return { filters: next, conditionMeta };
}

export async function searchDoctors(rawFilters: SearchFilters) {
  const { filters, conditionMeta } = resolveConditionFilters(rawFilters);
  const supabase = createAdminClient();

  // Detect if the location filter is a country-level slug (e.g. "country-gb")
  const isCountryFilter = filters.location?.startsWith("country-");
  const hasLocationFilter = !!filters.location;

  // Use an inner join on locations when a location filter is active so that
  // non-matching doctors are excluded from results (left join only filters the
  // nested resource, leaving the parent row intact with location: null).
  const locationJoin = hasLocationFilter
    ? "location:locations!inner(city, country_code, slug, latitude, longitude)"
    : "location:locations(city, country_code, slug, latitude, longitude)";

  let query = supabase
    .from("doctors")
    .select(
      `
      *,
      profile:profiles!doctors_profile_id_fkey(first_name, last_name, avatar_url),
      ${locationJoin},
      specialties:doctor_specialties(
        specialty:specialties(id, name_key, slug),
        is_primary
      ),
      skills:doctor_skills(skill_slug),
      photos:doctor_photos(storage_path, alt_text, is_primary)
    `,
      { count: "exact" }
    )
    .eq("verification_status", "verified")
    .eq("is_active", true);

  // License filter: only show doctors with active org licenses (or legacy subscriptions)
  // Skip applying to primary query for live shortcut modes so chip counts match results.
  // Still load IDs for fallback queries below.
  const { data: licensedIdsRaw } = await supabase.rpc("get_licensed_doctor_ids");
  const licensedIds = (licensedIdsRaw as string[] | null) || null;
  if (
    !filters.liveNow &&
    !filters.liveInPersonNearby &&
    licensedIds &&
    licensedIds.length > 0
  ) {
    query = query.in("id", licensedIds);
  }

  // Provider type filter (doctor vs testing_service)
  if (filters.providerType) {
    query = query.eq("provider_type", filters.providerType);
  }

  // Soft failures: never hard-empty when recovery can expand time/geo.
  // Recovery ladder runs when primary query is empty.
  const softFailures: string[] = [];
  let timeExpandedBanner: string | null = null;

  // Live "available now" — same IDs as homepage Available Now chip
  if (filters.liveNow && !filters.liveInPersonNearby) {
    const { data: liveIds, error: liveErr } = await supabase.rpc(
      "get_live_available_doctor_ids",
      {
        p_specialty_slug: filters.specialty ?? null,
        p_consultation_type:
          filters.consultationType === "video" ||
          filters.consultationType === "in_person"
            ? filters.consultationType
            : null,
        p_window_hours: filters.liveWindowHours ?? 2,
      }
    );

    if (liveErr) {
      log.error("Live-now availability RPC error:", { err: liveErr });
      softFailures.push("live_now_error");
      timeExpandedBanner =
        "Live availability is temporarily unavailable. Showing doctors by soonest appointment.";
    } else {
      const ids = (Array.isArray(liveIds) ? liveIds : [])
        .map((id) => (id == null ? "" : String(id)))
        .filter((id) => id.length > 0);

      if (ids.length === 0) {
        // Soft-expand: no one live in window — recover with soonest specialty inventory
        softFailures.push("live_now");
        timeExpandedBanner =
          "No appointments in the next few hours. Showing the soonest available doctors instead.";
      } else {
        query = query.in("id", ids);
        // Specialty already applied inside the RPC when provided — avoid double filter
      }
    }
  }

  // Nearby in-person GP live set — same IDs as "In person nearby" chip counter
  if (
    filters.liveInPersonNearby &&
    filters.placeLat != null &&
    filters.placeLng != null
  ) {
    const { data: nearbyRows, error: nearbyErr } = await supabase.rpc(
      "get_gp_in_person_availability",
      {
        p_window_hours: filters.liveWindowHours ?? 2,
        p_country_code: null,
        p_lat: filters.placeLat,
        p_lng: filters.placeLng,
        p_radius_km: filters.radius ?? 10,
      }
    );

    if (nearbyErr) {
      log.error("Live in-person nearby RPC error:", { err: nearbyErr });
      softFailures.push("live_in_person_error");
      timeExpandedBanner =
        "Nearby live availability is temporarily unavailable. Showing GPs with soonest appointments.";
    } else {
      const row = Array.isArray(nearbyRows) ? nearbyRows[0] : nearbyRows;
      const ids = (Array.isArray(row?.doctor_ids) ? row.doctor_ids : [])
        .map((id: unknown) => (id == null ? "" : String(id)))
        .filter((id: string) => id.length > 0);

      if (ids.length === 0) {
        softFailures.push("live_in_person");
        timeExpandedBanner =
          "No GPs available nearby right now. Showing the soonest GP appointments instead.";
      } else {
        query = query.in("id", ids);
      }
    }
  }

  // Same-day availability filter — soft-expand to multi-day when none today
  if (
    filters.availableToday &&
    !filters.liveNow &&
    !filters.liveInPersonNearby &&
    !softFailures.includes("live_now") &&
    !softFailures.includes("live_now_error")
  ) {
    const { data: doctorIds, error: rpcError } = await supabase.rpc(
      "get_doctor_ids_available_today"
    );

    if (rpcError) {
      log.error("Same-day availability RPC error:", { err: rpcError });
      softFailures.push("available_today_error");
      timeExpandedBanner =
        "Same-day availability is temporarily unavailable. Showing doctors by soonest appointment.";
    } else {
      const ids = (doctorIds as string[]) || [];
      if (ids.length === 0) {
        softFailures.push("available_today");
        timeExpandedBanner =
          "No appointments available today. Showing the soonest available doctors this week.";
      } else {
        query = query.in("id", ids);
      }
    }
  }

  // Skill filter — resolve skill slug → matching doctor IDs via doctor_skills.
  // Soft-drop skill (keep specialty) when no one has declared the skill yet.
  if (filters.skill) {
    const { data: skillRows } = await supabase
      .from("doctor_skills")
      .select("doctor_id")
      .eq("skill_slug", filters.skill);

    const ids = (skillRows || []).map(
      (r: { doctor_id: string }) => r.doctor_id
    );
    if (ids.length === 0) {
      softFailures.push("skill");
      // Do not hard-empty — continue with specialty / free-text only
    } else {
      query = query.in("id", ids);
    }
  }

  // Specialty filter — resolve slug(s) → specialty IDs → matching doctor IDs.
  // Multi-specialty OR when filters.specialties is set (condition hubs).
  // Skip only when liveNow/liveInPerson successfully applied specialty-scoped IDs.
  // Soft-fail with NO_MATCH_ID so recovery ladder + waitlist can run.
  const liveIdsApplied =
    (filters.liveNow || filters.liveInPersonNearby) &&
    !softFailures.some((f) =>
      f.startsWith("live_now") || f.startsWith("live_in_person")
    );
  const specialtySlugsToMatch = (
    filters.specialties && filters.specialties.length > 0
      ? filters.specialties
      : filters.specialty
        ? [filters.specialty]
        : []
  ).filter(Boolean);
  if (specialtySlugsToMatch.length > 0 && !liveIdsApplied) {
    const { data: specRows } = await supabase
      .from("specialties")
      .select("id")
      .in("slug", specialtySlugsToMatch);

    if (specRows && specRows.length > 0) {
      const { data: matchRows } = await supabase
        .from("doctor_specialties")
        .select("doctor_id")
        .in(
          "specialty_id",
          specRows.map((s: { id: string }) => s.id)
        );

      const ids = [
        ...new Set(
          (matchRows || []).map((r: { doctor_id: string }) => r.doctor_id)
        ),
      ];
      if (ids.length === 0) {
        softFailures.push("specialty_empty");
        query = query.eq("id", NO_MATCH_ID);
      } else {
        query = query.in("id", ids);
      }
    } else {
      softFailures.push("specialty_empty");
      query = query.eq("id", NO_MATCH_ID);
    }
  }

  // Apply filters
  if (filters.minPrice) {
    query = query.gte("consultation_fee_cents", filters.minPrice * 100);
  }
  if (filters.maxPrice) {
    query = query.lte("consultation_fee_cents", filters.maxPrice * 100);
  }
  if (filters.minRating) {
    query = query.gte("avg_rating", filters.minRating);
  }
  if (filters.language) {
    query = query.contains("languages", [filters.language]);
  }
  // liveNow / liveInPersonNearby already filtered consultation type in the RPC
  if (
    filters.consultationType &&
    !filters.liveNow &&
    !filters.liveInPersonNearby
  ) {
    query = query.contains("consultation_types", [filters.consultationType]);
  }
  // Proximity search: when a Place (borough, street, etc.) is selected,
  // filter doctors within the given radius of those coordinates.
  // This replaces the predefined location filter.
  // Skip when liveInPersonNearby already applied the radius in the RPC.
  let proximityDistances: Map<string, number> | undefined;
  if (
    filters.placeLat != null &&
    filters.placeLng != null &&
    !filters.location &&
    !filters.liveInPersonNearby
  ) {
    const radius = filters.radius || 25;
    const { data: ordered, error: rpcError } = await supabase.rpc(
      "sort_doctors_by_distance",
      { p_lat: filters.placeLat, p_lng: filters.placeLng }
    );

    if (!rpcError && ordered) {
      const withinRadius = (
        ordered as { doctor_id: string; distance_km: number }[]
      ).filter((r) => r.distance_km <= radius);

      if (withinRadius.length === 0) {
        // Soft-fail: recovery will widen radius / country for same specialty
        softFailures.push("proximity");
        query = query.eq("id", NO_MATCH_ID);
      } else {
        const proximityIds = withinRadius.map((r) => r.doctor_id);
        query = query.in("id", proximityIds);

        // Store distances for potential use in sorting / response
        proximityDistances = new Map(
          withinRadius.map((r) => [r.doctor_id, r.distance_km])
        );
      }
    }
  }

  // Location filters use location_id (not nested location.* filters) so that
  // multi-pass sorts (soonest) can safely re-select("id") without dropping embeds.
  if (filters.location) {
    if (isCountryFilter) {
      // Country-level filter (e.g. "country-gb" → country_code "GB")
      const countryCode = filters.location
        .replace("country-", "")
        .toUpperCase();
      const { data: countryLocs } = await supabase
        .from("locations")
        .select("id")
        .eq("country_code", countryCode);
      const locIds = (countryLocs || []).map((l: { id: string }) => l.id);
      if (locIds.length === 0) {
        softFailures.push("location_country");
        query = query.eq("id", NO_MATCH_ID);
      } else {
        query = query.in("location_id", locIds);
      }
    } else if (filters.consultationType === "video") {
      // Video consultations: expand to country-level so patients see all
      // doctors in the same country, not just the selected city.
      const { data: loc } = await supabase
        .from("locations")
        .select("id, country_code")
        .eq("slug", filters.location)
        .single();

      if (loc?.country_code) {
        const { data: countryLocs } = await supabase
          .from("locations")
          .select("id")
          .eq("country_code", loc.country_code);
        const locIds = (countryLocs || []).map((l: { id: string }) => l.id);
        if (locIds.length === 0) {
          softFailures.push("location_video_country");
          query = query.eq("id", NO_MATCH_ID);
        } else {
          query = query.in("location_id", locIds);
        }
      } else if (loc?.id) {
        query = query.eq("location_id", loc.id);
      } else {
        softFailures.push("location_missing");
        query = query.eq("id", NO_MATCH_ID);
      }
    } else {
      // In-person / default: prefer proximity-based matching so that
      // nearby cities (e.g. Islington → London doctors) are included.
      // Falls back to exact location_id match if the location has no coordinates.
      const { data: selectedLoc } = await supabase
        .from("locations")
        .select("id, latitude, longitude, country_code")
        .eq("slug", filters.location)
        .single();

      if (selectedLoc?.latitude != null && selectedLoc?.longitude != null) {
        const CITY_RADIUS_KM = 30; // generous radius to include nearby cities/boroughs
        const { data: nearby, error: nearbyErr } = await supabase.rpc(
          "sort_doctors_by_distance",
          { p_lat: selectedLoc.latitude, p_lng: selectedLoc.longitude }
        );

        if (!nearbyErr && nearby) {
          const withinRadius = (
            nearby as { doctor_id: string; distance_km: number }[]
          ).filter((r) => r.distance_km <= CITY_RADIUS_KM);

          if (withinRadius.length > 0) {
            const nearbyIds = withinRadius.map((r) => r.doctor_id);
            query = query.in("id", nearbyIds);
            // Store distances for sorting/display
            if (!proximityDistances) {
              proximityDistances = new Map(
                withinRadius.map((r) => [r.doctor_id, r.distance_km])
              );
            }
          } else if (selectedLoc.country_code) {
            // No doctors within radius — fall back to same country via location_id
            const { data: countryLocs } = await supabase
              .from("locations")
              .select("id")
              .eq("country_code", selectedLoc.country_code);
            const locIds = (countryLocs || []).map(
              (l: { id: string }) => l.id
            );
            if (locIds.length === 0) {
              softFailures.push("location_country_fallback");
              query = query.eq("id", NO_MATCH_ID);
            } else {
              query = query.in("location_id", locIds);
            }
          }
        } else if (selectedLoc.id) {
          // RPC failed — fall back to exact location_id match
          query = query.eq("location_id", selectedLoc.id);
        }
      } else if (selectedLoc?.id) {
        // No coordinates — fall back to exact location_id match
        query = query.eq("location_id", selectedLoc.id);
      } else {
        softFailures.push("location_missing");
        query = query.eq("id", NO_MATCH_ID);
      }
    }
  }
  // ── Launch region check ──────────────────────────────────────────
  // Detect if the user is searching in a region we haven't launched in yet.
  // For non-launch regions, only video consultations are available.
  let searchCountryCode: string | null = null;
  let outsideLaunchRegion = false;

  if (filters.location) {
    if (isCountryFilter) {
      searchCountryCode = filters.location.replace("country-", "").toUpperCase();
    } else {
      // Look up the country_code from the location slug
      const { data: locRow } = await supabase
        .from("locations")
        .select("country_code")
        .eq("slug", filters.location)
        .single();
      searchCountryCode = locRow?.country_code || null;
    }
  }

  if (searchCountryCode && !isLaunchRegion(searchCountryCode)) {
    outsideLaunchRegion = true;
    // Force video-only results from all launch regions
    if (filters.consultationType !== "video") {
      query = query.contains("consultation_types", ["video"]);
    }
    // Expand to all launch-region location_ids (avoid nested location.* filters)
    const { data: launchLocs } = await supabase
      .from("locations")
      .select("id")
      .in("country_code", [...LAUNCH_REGION_CODES]);
    const launchLocIds = (launchLocs || []).map((l: { id: string }) => l.id);
    if (launchLocIds.length === 0) {
      softFailures.push("launch_regions");
      query = query.eq("id", NO_MATCH_ID);
    } else {
      query = query.in("location_id", launchLocIds);
    }
  }

  // Free-text query: match against specialty names, keywords, doctor names, and bio
  let textFilterApplied = false;
  let matchedSpecialtySlug: string | null = null;
  let specialistSuggestion: string | null = null;

  if (filters.query && !filters.specialty) {
    const term = filters.query.trim().toLowerCase();

    // 1. Exact specialty name match
    const { data: matchingSpecs } = await supabase
      .from("specialties")
      .select("id, slug, name_key")
      .eq("is_active", true);

    const matchedSpec = (matchingSpecs || []).find((s) => {
      const display = s.name_key
        .replace("specialty.", "")
        .replace(/_/g, " ")
        .toLowerCase();
      return display === term || s.slug === term.replace(/\s+/g, "-");
    });

    if (matchedSpec) {
      const { data: matchRows } = await supabase
        .from("doctor_specialties")
        .select("doctor_id")
        .eq("specialty_id", matchedSpec.id);

      const ids = (matchRows || []).map(
        (r: { doctor_id: string }) => r.doctor_id
      );
      if (ids.length > 0) {
        query = query.in("id", ids);
        textFilterApplied = true;
        matchedSpecialtySlug = matchedSpec.slug;
      }
    }

    // 2. Keyword-to-specialty mapping (GP + specialist for natural language queries)
    if (!textFilterApplied) {
      const words = term.split(/\s+/);
      let keywordMatch: { primary: string; specialist: string } | null = null;
      for (const word of words) {
        if (KEYWORD_SPECIALTY_MAP[word]) {
          keywordMatch = KEYWORD_SPECIALTY_MAP[word];
          break;
        }
      }

      if (keywordMatch) {
        // Collect doctor IDs for BOTH primary and specialist specialties
        const slugsToMatch = new Set([keywordMatch.primary, keywordMatch.specialist]);
        const allDoctorIds = new Set<string>();

        for (const slug of slugsToMatch) {
          const { data: specRow } = await supabase
            .from("specialties")
            .select("id")
            .eq("slug", slug)
            .single();

          if (specRow) {
            const { data: matchRows } = await supabase
              .from("doctor_specialties")
              .select("doctor_id")
              .eq("specialty_id", specRow.id);

            for (const r of matchRows || []) {
              allDoctorIds.add(r.doctor_id);
            }
          }
        }

        if (allDoctorIds.size > 0) {
          query = query.in("id", [...allDoctorIds]);
          textFilterApplied = true;
          matchedSpecialtySlug = keywordMatch.primary;
        }

        // Track specialist for the suggestion banner
        if (keywordMatch.specialist !== keywordMatch.primary) {
          specialistSuggestion = keywordMatch.specialist;
        }
      }
    }

    // 3. Bio + name search as last resort (but don't use for symptom-like phrases)
    if (!textFilterApplied && term.split(/\s+/).length <= 3) {
      query = query.ilike("bio", `%${filters.query}%`);
      textFilterApplied = true;
    }
    // For longer phrases (likely symptoms), skip bio search — rely on proximity/fallback
  } else if (filters.query && filters.specialty) {
    // If both query and specialty are set, the specialty filter handles it
    // Don't also search bio — it would eliminate valid specialty matches
  }
  if (filters.wheelchairAccessible) {
    query = query.eq("is_wheelchair_accessible", true);
  }
  if (filters.acceptedPayment) {
    query = query.contains("accepted_payments", [filters.acceptedPayment]);
  }
  if (filters.insurer) {
    query = query.contains("accepted_insurers", [filters.insurer]);
  }
  if (filters.gender && filters.gender !== "prefer_not_to_say") {
    query = query.eq("gender", filters.gender);
  }

  // Pagination
  const page = filters.page || 1;
  const perPage = 12;

  // "Soonest" sort: order by earliest bookable slot (next-available RPC), then page.
  // Doctors with no slots in the window sink to the end.
  // On empty, fall through to specialty-preserving recovery (never hard-empty).
  // Location filters use location_id so select("id") is safe (no nested embeds required).
  let soonestHandled = false;
  if (filters.sort === "soonest") {
    // Replace projection to IDs only (builder already has count:exact from initial select).
    // Do not pass a second options arg — TS builder type after chained filters
    // only accepts 0–1 select arguments and that broke the Phase 3 production build.
    const { data: idRows, error: idError } = await query.select("id");

    if (idError) {
      log.error("Soonest sort ID query error:", { err: idError });
      softFailures.push("soonest_error");
    } else {
      let allIds = (idRows || []).map((r: { id: string }) => r.id);

      // Cap candidates before batch availability RPCs — full specialty pools
      // can exceed serverless time budgets (condition browse always uses soonest).
      if (allIds.length > SOONEST_CANDIDATE_CAP) {
        const { data: rankSeed } = await supabase
          .from("doctors")
          .select("id, is_featured, featured_until, avg_rating")
          .in("id", allIds);
        const seed = (rankSeed || []) as {
          id: string;
          is_featured: boolean | null;
          featured_until: string | null;
          avg_rating: number | null;
        }[];
        seed.sort((a, b) => {
          const aFeat = isActivelyFeatured(a) ? 0 : 1;
          const bFeat = isActivelyFeatured(b) ? 0 : 1;
          if (aFeat !== bFeat) return aFeat - bFeat;
          return Number(b.avg_rating || 0) - Number(a.avg_rating || 0);
        });
        allIds = seed.slice(0, SOONEST_CANDIDATE_CAP).map((r) => r.id);
      }

      if (allIds.length > 0) {
        const ctype =
          filters.consultationType === "video" ||
          filters.consultationType === "in_person"
            ? filters.consultationType
            : "in_person";

        // Next GP / similar: only doctors with a free slot in the next N days
        let withinDays = filters.availableWithinDays ?? 14;
        // Soft time-expand window when primary time filters already failed
        if (
          softFailures.includes("available_today") ||
          softFailures.includes("live_now") ||
          softFailures.includes("live_in_person")
        ) {
          withinDays = Math.max(withinDays, 7);
        }

        // Prefer requested type; if "all", also check video and take the earlier first slot.
        // Guard batch RPCs so a timeout/throw soft-fails to featured recovery.
        let availPrimary: Awaited<
          ReturnType<typeof getNextAvailabilityBatch>
        > = {};
        let availVideo: Awaited<
          ReturnType<typeof getNextAvailabilityBatch>
        > = {};
        try {
          [availPrimary, availVideo] = await Promise.all([
            getNextAvailabilityBatch(allIds, ctype, withinDays),
            filters.consultationType
              ? Promise.resolve(
                  {} as Awaited<ReturnType<typeof getNextAvailabilityBatch>>
                )
              : getNextAvailabilityBatch(allIds, "video", withinDays),
          ]);
        } catch (err) {
          log.error("Soonest availability batch failed:", { err });
          softFailures.push("soonest_error");
          timeExpandedBanner =
            timeExpandedBanner ||
            "Live next-appointment ranking is temporarily unavailable. Showing top specialists by rating.";
          // Fall through to standard sort path by leaving soonestHandled false
          allIds = [];
        }

        // When availableWithinDays is set, drop doctors with no slot in the window
        if (
          filters.availableWithinDays != null &&
          filters.availableWithinDays > 0
        ) {
          const filtered = allIds.filter(
            (id) => !!(availPrimary[id]?.date || availVideo[id]?.date)
          );
          if (filtered.length === 0) {
            // Soft-expand window to 14 days before giving up to recovery
            softFailures.push("available_within_days");
            timeExpandedBanner =
              timeExpandedBanner ||
              `No appointments within ${filters.availableWithinDays} days. Showing the soonest available over the next 2 weeks.`;
            withinDays = 14;
            [availPrimary, availVideo] = await Promise.all([
              getNextAvailabilityBatch(allIds, ctype, withinDays),
              filters.consultationType
                ? Promise.resolve(
                    {} as Awaited<ReturnType<typeof getNextAvailabilityBatch>>
                  )
                : getNextAvailabilityBatch(allIds, "video", withinDays),
            ]);
            allIds = allIds.filter(
              (id) => !!(availPrimary[id]?.date || availVideo[id]?.date)
            );
          } else {
            allIds = filtered;
          }
        }

        if (allIds.length > 0) {
          const earliestMs = (id: string): number => {
            const a = availPrimary[id]?.slots?.[0]?.start;
            const b = availVideo[id]?.slots?.[0]?.start;
            const ta = a ? new Date(a).getTime() : Infinity;
            const tb = b ? new Date(b).getTime() : Infinity;
            return Math.min(ta, tb);
          };

          // Paid Featured boost pins above organic; within each group sort soonest.
          const { data: flagRows } = await supabase
            .from("doctors")
            .select("id, is_featured, featured_until, avg_rating")
            .in("id", allIds);
          const flagById = new Map(
            (flagRows || []).map(
              (r: {
                id: string;
                is_featured: boolean | null;
                featured_until: string | null;
                avg_rating: number | null;
              }) => [r.id, r]
            )
          );
          const { ranked: rankedFlagDocs } = rankDoctorsByInventory(
            allIds.map((id) => {
              const f = flagById.get(id);
              return {
                id,
                is_featured: f?.is_featured ?? false,
                featured_until: f?.featured_until ?? null,
                avg_rating: f?.avg_rating ?? 0,
              };
            }),
            earliestMs,
            proximityDistances
          );
          const orderedIds = rankedFlagDocs.map((d) => d.id);
          const total = orderedIds.length;
          const pageIds = orderedIds.slice(
            (page - 1) * perPage,
            page * perPage
          );

          if (pageIds.length > 0) {
            // Re-fetch full rows for the page
            const { data: pageData, error: pageError } = await supabase
              .from("doctors")
              .select(
                `
                *,
                profile:profiles!doctors_profile_id_fkey(first_name, last_name, avatar_url),
                location:locations(city, country_code, slug, latitude, longitude),
                specialties:doctor_specialties(
                  specialty:specialties(id, name_key, slug),
                  is_primary
                ),
                skills:doctor_skills(skill_slug),
                photos:doctor_photos(storage_path, alt_text, is_primary)
              `
              )
              .in("id", pageIds)
              .eq("is_active", true)
              .eq("verification_status", "verified");

            if (pageError) {
              log.error("Soonest sort page fetch error:", { err: pageError });
              softFailures.push("soonest_page_error");
            } else {
              const idIndexMap = new Map(pageIds.map((id, i) => [id, i]));
              const sorted = pinActiveFeaturedFirst(
                ((pageData || []) as Record<string, unknown>[]).sort(
                  (a, b) =>
                    (idIndexMap.get(a.id as string) ?? Infinity) -
                    (idIndexMap.get(b.id as string) ?? Infinity)
                ) as InventoryRankDoctor[]
              ) as Record<string, unknown>[];

              soonestHandled = true;
              // Track fully booked (no slot in window) for waitlist prompt
              const fullyBooked = orderedIds.filter(
                (id) => earliestMs(id) === Infinity
              );
              const primarySpecForWaitlist =
                filters.specialty || matchedSpecialtySlug || null;
              return {
                doctors: sorted,
                total,
                page,
                perPage,
                matchScores: buildMatchScoresMap(sorted, filters),
                distances: undefined,
                outsideLaunchRegion,
                searchCountryCode,
                fallbackApplied: timeExpandedBanner,
                specialistSuggestion,
                matchMode: timeExpandedBanner
                  ? ("time_expanded" as const)
                  : ("exact" as const),
                waitlistPrompt:
                  primarySpecForWaitlist && fullyBooked.length > 0
                    ? {
                        specialtySlug: primarySpecForWaitlist,
                        doctorIdsFullyBooked: fullyBooked.slice(0, 12),
                      }
                    : primarySpecForWaitlist && sorted.length === 0
                      ? { specialtySlug: primarySpecForWaitlist }
                      : null,
                conditionMeta,
              };
            }
          }
        } else {
          softFailures.push("soonest_no_slots");
        }
      } else {
        softFailures.push("soonest_empty_candidates");
      }
    }
  }

  // When soonest path ran but found nothing, the query builder is already
  // consumed by select("id"). Skip re-using it — go straight to recovery
  // with empty primary results.
  let data: Record<string, unknown>[] | null = null;
  let count: number | null = 0;
  let queryError: { message?: string } | null = null;

  if (filters.sort === "soonest" && !soonestHandled) {
    data = [];
    count = 0;
  } else if (
    filters.sort === "nearest" &&
    filters.userLat != null &&
    filters.userLng != null
  ) {
    const { data: ordered, error: rpcError } = await supabase.rpc(
      "sort_doctors_by_distance",
      { p_lat: filters.userLat, p_lng: filters.userLng }
    );

    if (rpcError) {
      log.error("Distance sort RPC error:", { err: rpcError });
      // Fallback to featured
      query = query
        .order("is_featured", { ascending: false })
        .order("avg_rating", { ascending: false })
        .range((page - 1) * perPage, page * perPage - 1);
      const res = await query;
      data = (res.data || []) as Record<string, unknown>[];
      count = res.count;
      queryError = res.error;
    } else {
      const orderedIds = (
        ordered as { doctor_id: string; distance_km: number }[]
      ).map((r) => r.doctor_id);
      const total = orderedIds.length;
      const pageIds = orderedIds.slice(
        (page - 1) * perPage,
        page * perPage
      );

      if (pageIds.length === 0) {
        data = [];
        count = total;
      } else {
        query = query.in("id", pageIds);
        const res = await query;
        if (res.error) {
          log.error("Search error:", { err: res.error });
          queryError = res.error;
          data = [];
          count = 0;
        } else {
          const idIndexMap = new Map(pageIds.map((id, i) => [id, i]));
          const sorted = (res.data || []).sort(
            (a: Record<string, unknown>, b: Record<string, unknown>) =>
              (idIndexMap.get(a.id as string) ?? Infinity) -
              (idIndexMap.get(b.id as string) ?? Infinity)
          );
          // Nearest with results — return early (no recovery needed)
          return {
            doctors: sorted,
            total,
            page,
            perPage,
            matchScores: undefined,
            distances: undefined,
            outsideLaunchRegion,
            searchCountryCode,
            fallbackApplied: timeExpandedBanner,
            specialistSuggestion,
            matchMode: "exact" as const,
            waitlistPrompt: null,
            conditionMeta,
          };
        }
      }
    }
  } else if (filters.sort === "next_available") {
    // Prefer doctors with same-day availability first, then rating.
    // Uses existing RPC for "available today" IDs; remaining doctors follow.
    const { data: todayIds } = await supabase.rpc("get_doctor_ids_available_today");
    const availableTodayIds = new Set((todayIds as string[]) || []);

    // Fetch a larger candidate set then re-rank
    const { data: candidates, count: candidateCount, error: candErr } = await query
      .order("is_featured", { ascending: false })
      .order("avg_rating", { ascending: false })
      .range(0, Math.min(page * perPage + 48, 200) - 1);

    if (candErr) {
      log.error("Next available sort error:", { err: candErr });
      query = query
        .order("is_featured", { ascending: false })
        .order("avg_rating", { ascending: false })
        .range((page - 1) * perPage, page * perPage - 1);
    } else {
      const ranked = [...(candidates || [])].sort(
        (a: { id: string; avg_rating: number }, b: { id: string; avg_rating: number }) => {
          const aLive = availableTodayIds.has(a.id) ? 0 : 1;
          const bLive = availableTodayIds.has(b.id) ? 0 : 1;
          if (aLive !== bLive) return aLive - bLive;
          return Number(b.avg_rating || 0) - Number(a.avg_rating || 0);
        }
      );
      const total = candidateCount ?? ranked.length;
      const pageSlice = ranked.slice((page - 1) * perPage, page * perPage);
      return {
        doctors: pageSlice,
        total,
        page,
        perPage,
        bookableNowIds: [...availableTodayIds],
      };
    }
  } else {
    // Standard sort
    switch (filters.sort) {
      case "rating":
        query = query.order("avg_rating", { ascending: false });
        break;
      case "price_asc":
        query = query.order("consultation_fee_cents", { ascending: true });
        break;
      case "price_desc":
        query = query.order("consultation_fee_cents", { ascending: false });
        break;
      case "featured":
      default:
        query = query
          .order("is_featured", { ascending: false })
          .order("avg_rating", { ascending: false });
        break;
    }

    query = query.range((page - 1) * perPage, page * perPage - 1);
    const res = await query;
    data = (res.data || []) as Record<string, unknown>[];
    count = res.count;
    queryError = res.error;
  }

  if (queryError) {
    log.error("Search error:", { err: queryError });
    // Still attempt recovery rather than naked empty
    data = data || [];
    count = count ?? 0;
  }

  // ── Zero-result fallback chain (specialty-preserving) ──────────
  // NEVER drop specialty to fill with unrelated doctors (e.g. dentists
  // for a dermatology/acne search). Expand geography and surface the
  // same specialty with upcoming availability instead.
  let fallbackApplied: string | null = timeExpandedBanner;
  let matchMode:
    | "exact"
    | "widened"
    | "country"
    | "related"
    | "empty"
    | "time_expanded"
    | "platform_empty" =
    data && data.length > 0
      ? timeExpandedBanner
        ? "time_expanded"
        : "exact"
      : "empty";
  let fallbackData = data;
  let fallbackCount = count;

  const primarySpecialty =
    filters.specialty || matchedSpecialtySlug || null;
  const specialtyLabel = primarySpecialty
    ? specialtySlugToLabel(primarySpecialty)
    : null;

  const doctorSelectFb = `*,
    profile:profiles!doctors_profile_id_fkey(first_name, last_name, avatar_url),
    location:locations(city, country_code, slug, latitude, longitude),
    specialties:doctor_specialties(specialty:specialties(id, name_key, slug), is_primary),
    photos:doctor_photos(storage_path, alt_text, is_primary)`;

  async function doctorIdsForSpecialtySlugs(
    slugs: string[]
  ): Promise<string[]> {
    if (slugs.length === 0) return [];
    const { data: specRows } = await supabase
      .from("specialties")
      .select("id, slug")
      .in("slug", slugs);
    if (!specRows?.length) return [];
    const { data: matchRows } = await supabase
      .from("doctor_specialties")
      .select("doctor_id")
      .in(
        "specialty_id",
        specRows.map((s: { id: string }) => s.id)
      );
    return [
      ...new Set(
        (matchRows || []).map((r: { doctor_id: string }) => r.doctor_id)
      ),
    ];
  }

  async function locationIdsForCountry(
    countryCode: string
  ): Promise<string[]> {
    const { data: rows } = await supabase
      .from("locations")
      .select("id")
      .eq("country_code", countryCode);
    return (rows || []).map((r: { id: string }) => r.id);
  }

  async function fetchSpecialtyDoctors(opts: {
    specialtySlugs: string[];
    doctorIdPool?: string[];
    locationIds?: string[];
    consultationType?: string;
    orderSoonest?: boolean;
  }): Promise<{ rows: Record<string, unknown>[]; count: number }> {
    let doctorIds = await doctorIdsForSpecialtySlugs(opts.specialtySlugs);
    if (doctorIds.length === 0) return { rows: [], count: 0 };

    if (opts.doctorIdPool && opts.doctorIdPool.length > 0) {
      const pool = new Set(opts.doctorIdPool);
      doctorIds = doctorIds.filter((id) => pool.has(id));
      if (doctorIds.length === 0) return { rows: [], count: 0 };
    }

    if (licensedIds && licensedIds.length > 0) {
      const lic = new Set(licensedIds as string[]);
      doctorIds = doctorIds.filter((id) => lic.has(id));
      if (doctorIds.length === 0) return { rows: [], count: 0 };
    }

    let q = supabase
      .from("doctors")
      .select(doctorSelectFb, { count: "exact" })
      .eq("verification_status", "verified")
      .eq("is_active", true)
      .in("id", doctorIds);

    if (opts.locationIds && opts.locationIds.length > 0) {
      q = q.in("location_id", opts.locationIds);
    }
    if (opts.consultationType) {
      q = q.contains("consultation_types", [opts.consultationType]);
    }
    if (filters.language) {
      q = q.contains("languages", [filters.language]);
    }
    if (filters.providerType) {
      q = q.eq("provider_type", filters.providerType);
    }

    if (opts.orderSoonest) {
      const { data: idRows, error: idErr } = await q.select("id");
      if (idErr || !idRows?.length) return { rows: [], count: 0 };
      const ids = idRows.map((r: { id: string }) => r.id);
      const ctype =
        opts.consultationType === "video" ||
        opts.consultationType === "in_person"
          ? opts.consultationType
          : "in_person";
      // Prefer requested type; when unrestricted, also consider video so
      // future appointments surface even if in-person is further out.
      const [availPrimary, availVideo] = await Promise.all([
        getNextAvailabilityBatch(ids, ctype, 14),
        opts.consultationType
          ? Promise.resolve(
              {} as Awaited<ReturnType<typeof getNextAvailabilityBatch>>
            )
          : getNextAvailabilityBatch(ids, "video", 14),
      ]);
      const earliestMs = (id: string): number => {
        const a = availPrimary[id]?.slots?.[0]?.start;
        const b = availVideo[id]?.slots?.[0]?.start;
        const ta = a ? new Date(a).getTime() : Infinity;
        const tb = b ? new Date(b).getTime() : Infinity;
        return Math.min(ta, tb);
      };
      const { data: flagRows } = await supabase
        .from("doctors")
        .select("id, is_featured, featured_until, avg_rating")
        .in("id", ids);
      const flagById = new Map(
        (flagRows || []).map(
          (r: {
            id: string;
            is_featured: boolean | null;
            featured_until: string | null;
            avg_rating: number | null;
          }) => [r.id, r]
        )
      );
      const { ranked: rankedDocs } = rankDoctorsByInventory(
        ids.map((id) => {
          const f = flagById.get(id);
          return {
            id,
            is_featured: f?.is_featured ?? false,
            featured_until: f?.featured_until ?? null,
            avg_rating: f?.avg_rating ?? 0,
          };
        }),
        earliestMs
      );
      const ordered = rankedDocs.map((d) => d.id);
      const pageIds = ordered.slice(0, perPage);
      if (pageIds.length === 0) return { rows: [], count: 0 };

      const { data: pageData } = await supabase
        .from("doctors")
        .select(doctorSelectFb)
        .in("id", pageIds)
        .eq("verification_status", "verified")
        .eq("is_active", true);

      const idx = new Map(pageIds.map((id, i) => [id, i]));
      const sorted = pinActiveFeaturedFirst(
        ((pageData || []) as Record<string, unknown>[]).sort(
          (a, b) =>
            (idx.get(a.id as string) ?? Infinity) -
            (idx.get(b.id as string) ?? Infinity)
        ) as InventoryRankDoctor[]
      );
      return {
        rows: sorted as Record<string, unknown>[],
        count: ordered.length,
      };
    }

    q = q
      .order("is_featured", { ascending: false })
      .order("avg_rating", { ascending: false })
      .range(0, perPage - 1);

    const res = await q;
    return {
      rows: (res.data || []) as Record<string, unknown>[],
      count: res.count || 0,
    };
  }

  const shouldRunFallback = shouldRunRecovery({
    dataEmpty: !data || data.length === 0,
    specialty: filters.specialty,
    query: filters.query,
    skill: filters.skill,
    availableToday: filters.availableToday,
    liveNow: filters.liveNow,
    liveInPersonNearby: filters.liveInPersonNearby,
    placeLat: filters.placeLat,
    location: filters.location,
    textFilterApplied,
    matchedSpecialtySlug,
    softFailures,
    sort: filters.sort,
  });

  if (shouldRunFallback) {
    const hasGeo = !!(filters.placeLat || filters.location);

    // Resolve country for geographic expansion (never hardcode unless place-only)
    let fbCountry =
      searchCountryCode ||
      (isCountryFilter
        ? filters.location!.replace("country-", "").toUpperCase()
        : null);

    if (!fbCountry && filters.location && !isCountryFilter) {
      const { data: locRow } = await supabase
        .from("locations")
        .select("country_code")
        .eq("slug", filters.location)
        .single();
      fbCountry = locRow?.country_code || null;
    }
    if (!fbCountry && filters.placeLat != null) {
      fbCountry = "GB";
    }

    if (primarySpecialty) {
      // Step 1: Same specialty, widen proximity radius — sort by soonest
      if (
        filters.placeLat != null &&
        filters.placeLng != null &&
        (!fallbackData || fallbackData.length === 0)
      ) {
        const baseRadius = filters.radius || 25;
        for (const wideRadius of widenRadiusSteps(baseRadius)) {
          const { data: ordered } = await supabase.rpc(
            "sort_doctors_by_distance",
            { p_lat: filters.placeLat, p_lng: filters.placeLng }
          );
          if (!ordered) break;
          const within = (
            ordered as { doctor_id: string; distance_km: number }[]
          )
            .filter((r) => r.distance_km <= wideRadius)
            .map((r) => r.doctor_id);
          if (within.length === 0) continue;

          const res = await fetchSpecialtyDoctors({
            specialtySlugs: [primarySpecialty],
            doctorIdPool: within,
            consultationType: filters.consultationType,
            orderSoonest: true,
          });
          if (res.rows.length > 0) {
            fallbackData = res.rows;
            fallbackCount = res.count;
            matchMode = "widened";
            fallbackApplied = `No ${specialtyLabel} specialists within ${baseRadius} km. Expanded search to ${wideRadius} km — showing ${specialtyLabel} with upcoming availability.`;
            proximityDistances = new Map(
              (ordered as { doctor_id: string; distance_km: number }[])
                .filter((r) => r.distance_km <= wideRadius)
                .map((r) => [r.doctor_id, r.distance_km])
            );
            break;
          }
        }
      }

      // Step 2: Same specialty, country-wide, soonest availability
      if ((!fallbackData || fallbackData.length === 0) && fbCountry) {
        const locIds = await locationIdsForCountry(fbCountry);
        const res = await fetchSpecialtyDoctors({
          specialtySlugs: [primarySpecialty],
          locationIds: locIds.length > 0 ? locIds : undefined,
          consultationType: filters.consultationType,
          orderSoonest: true,
        });
        if (res.rows.length > 0) {
          fallbackData = res.rows;
          fallbackCount = res.count;
          matchMode = "country";
          fallbackApplied = hasGeo
            ? `No ${specialtyLabel} specialists nearby. Showing ${specialtyLabel} across ${fbCountry === "GB" ? "the UK" : fbCountry} with upcoming availability.`
            : `Showing ${specialtyLabel} specialists with upcoming availability.`;
        }
      }

      // Step 3: Same specialty, video across launch regions
      if (!fallbackData || fallbackData.length === 0) {
        const { data: launchLocs } = await supabase
          .from("locations")
          .select("id")
          .in("country_code", [...LAUNCH_REGION_CODES]);
        const launchIds = (launchLocs || []).map((l: { id: string }) => l.id);
        const res = await fetchSpecialtyDoctors({
          specialtySlugs: [primarySpecialty],
          locationIds: launchIds.length > 0 ? launchIds : undefined,
          consultationType: "video",
          orderSoonest: true,
        });
        if (res.rows.length > 0) {
          fallbackData = res.rows;
          fallbackCount = res.count;
          matchMode = "country";
          fallbackApplied = `No local ${specialtyLabel} specialists. Showing ${specialtyLabel} available for video consultation.`;
        }
      }

      // Step 4: Related specialties only (explicitly labelled — never random nearby)
      if (!fallbackData || fallbackData.length === 0) {
        // Prefer true related specialties; keep GP out of specialist empty-states
        // so acne ≠ dentist/GP dump. Expansion chips still offer GP separately.
        const related = relatedSpecialtiesForRecovery(primarySpecialty);
        if (related.length > 0) {
          const locIds = fbCountry
            ? await locationIdsForCountry(fbCountry)
            : undefined;
          const res = await fetchSpecialtyDoctors({
            specialtySlugs: related.slice(0, 3),
            locationIds: locIds && locIds.length > 0 ? locIds : undefined,
            consultationType: filters.consultationType,
            orderSoonest: true,
          });
          if (res.rows.length > 0) {
            fallbackData = res.rows;
            fallbackCount = res.count;
            matchMode = "related";
            const labels = related
              .slice(0, 2)
              .map(specialtySlugToLabel)
              .join(", ");
            fallbackApplied = `No ${specialtyLabel} specialists available right now. Showing related care: ${labels}.`;
            if (!specialistSuggestion) {
              specialistSuggestion = related[0];
            }
          }
        }
      }

      // Step 5: still empty — platform empty for this specialty (waitlist UI)
      if (!fallbackData || fallbackData.length === 0) {
        matchMode = "platform_empty";
        fallbackApplied = platformEmptyBanner(
          primarySpecialty,
          timeExpandedBanner
        );
      } else if (timeExpandedBanner && !fallbackApplied) {
        fallbackApplied = timeExpandedBanner;
        matchMode = matchMode === "exact" ? "time_expanded" : matchMode;
      }
    } else {
      // No specialty inferred (generic free text) — nearby any as last resort only
      if (
        (filters.placeLat || filters.location) &&
        proximityDistances &&
        proximityDistances.size > 0
      ) {
        let fbQuery = supabase
          .from("doctors")
          .select(doctorSelectFb, { count: "exact" })
          .eq("verification_status", "verified")
          .eq("is_active", true)
          .in("id", [...proximityDistances.keys()]);
        if (licensedIds && licensedIds.length > 0) {
          fbQuery = fbQuery.in("id", licensedIds as string[]);
        }
        if (filters.providerType) {
          fbQuery = fbQuery.eq("provider_type", filters.providerType);
        }
        fbQuery = fbQuery
          .order("is_featured", { ascending: false })
          .order("avg_rating", { ascending: false })
          .range(0, perPage - 1);
        const fbResult = await fbQuery;
        if (fbResult.data && fbResult.data.length > 0) {
          fallbackData = fbResult.data;
          fallbackCount = fbResult.count;
          matchMode = "widened";
          fallbackApplied =
            "No exact matches found. Showing nearby doctors instead.";
        }
      } else if (fbCountry) {
        // Country-level any for non-specialty empty searches
        const locIds = await locationIdsForCountry(fbCountry);
        if (locIds.length > 0) {
          let fbQuery = supabase
            .from("doctors")
            .select(doctorSelectFb, { count: "exact" })
            .eq("verification_status", "verified")
            .eq("is_active", true)
            .in("location_id", locIds);
          if (licensedIds && licensedIds.length > 0) {
            fbQuery = fbQuery.in("id", licensedIds as string[]);
          }
          fbQuery = fbQuery
            .order("is_featured", { ascending: false })
            .order("avg_rating", { ascending: false })
            .range(0, perPage - 1);
          const fbResult = await fbQuery;
          if (fbResult.data && fbResult.data.length > 0) {
            fallbackData = fbResult.data;
            fallbackCount = fbResult.count;
            matchMode = "country";
            fallbackApplied =
              "No exact matches nearby. Showing doctors across the country.";
          }
        }
      }
    }
  }

  const resultData = fallbackData || data;
  const resultCount = fallbackCount ?? count;

  // Smart Match: compute match scores when best_match sort is active
  if (filters.sort === "best_match" && resultData && resultData.length > 0) {
    const context: MatchContext = {
      preferredSpecialty: filters.specialty,
      preferredLanguage: filters.language,
      maxBudget: filters.maxPrice ? filters.maxPrice * 100 : undefined,
      consultationType: filters.consultationType,
    };

    const doctorInputs: DoctorMatchInput[] = resultData.map((d: Record<string, unknown>) => ({
      id: d.id as string,
      avg_rating: d.avg_rating as number | null,
      total_reviews: d.total_reviews as number,
      languages: (d.languages || []) as string[],
      consultation_types: (d.consultation_types || []) as string[],
      consultation_fee_cents: d.consultation_fee_cents as number,
      video_consultation_fee_cents: d.video_consultation_fee_cents as number | null,
      ai_sentiment_tags: (d.ai_sentiment_tags || []) as string[],
      specialties: (d.specialties || []) as DoctorMatchInput["specialties"],
    }));

    const scored = scoreDoctors(doctorInputs, context);
    const scoreMap = new Map(scored.map((s) => [s.doctorId, s]));

    // Sort by match score, then pin paid Featured boosts to the top
    const sortedByScore = [...resultData].sort(
      (a: Record<string, unknown>, b: Record<string, unknown>) => {
        const scoreA = scoreMap.get(a.id as string)?.matchScore ?? 0;
        const scoreB = scoreMap.get(b.id as string)?.matchScore ?? 0;
        return scoreB - scoreA;
      }
    );
    const sorted = pinActiveFeaturedFirst(
      sortedByScore as InventoryRankDoctor[]
    ) as Record<string, unknown>[];

    // Build match score map for the client
    const matchScores: Record<string, { score: number; reasons: string[] }> = {};
    for (const s of scored) {
      matchScores[s.doctorId] = { score: s.matchScore, reasons: s.matchReasons };
    }

    const waitlistPrompt =
      primarySpecialty &&
      (matchMode === "platform_empty" ||
        matchMode === "empty" ||
        matchMode === "related" ||
        (resultCount || 0) === 0)
        ? { specialtySlug: primarySpecialty }
        : null;

    return {
      doctors: sorted,
      total: resultCount || 0,
      page,
      perPage,
      matchScores,
      fallbackApplied,
      specialistSuggestion,
      matchMode,
      waitlistPrompt,
    };
  }

  // When proximity search is active, sort by distance (nearest first) by default
  // — unless we will re-rank by inventory (marketplace default).
  let finalDoctors = (resultData || []) as Record<string, unknown>[];
  // Skip re-rank when soonest path already ordered by next slot (avoids a second
  // full getNextAvailabilityBatch pair on the critical search path).
  const shouldInventoryRank =
    !isUserExplicitSort(filters.sort) &&
    filters.sort !== "soonest" &&
    finalDoctors.length > 0;

  if (
    proximityDistances &&
    proximityDistances.size > 0 &&
    !shouldInventoryRank &&
    filters.sort !== "soonest"
  ) {
    finalDoctors = [...finalDoctors].sort(
      (a, b) =>
        (proximityDistances!.get(a.id as string) ?? Infinity) -
        (proximityDistances!.get(b.id as string) ?? Infinity)
    );
  }

  // ── Inventory-first ranking (marketplace Phase B/C) ─────────────
  // Pure rank helper + batch availability. Fully booked stay at bottom.
  let doctorIdsFullyBooked: string[] = [];
  if (shouldInventoryRank) {
    const ids = finalDoctors.map((d) => d.id as string);
    const ctype =
      filters.consultationType === "video" ||
      filters.consultationType === "in_person"
        ? filters.consultationType
        : "in_person";
    const withinDays = Math.max(filters.availableWithinDays ?? 14, 14);
    const [availPrimary, availVideo] = await Promise.all([
      getNextAvailabilityBatch(ids, ctype, withinDays),
      filters.consultationType
        ? Promise.resolve(
            {} as Awaited<ReturnType<typeof getNextAvailabilityBatch>>
          )
        : getNextAvailabilityBatch(ids, "video", withinDays),
    ]);

    const earliestMs = buildEarliestMsFn(availPrimary, availVideo);
    const ranked = rankDoctorsByInventory(
      finalDoctors.map((d) => ({
        ...d,
        id: d.id as string,
        avg_rating: d.avg_rating as number | null,
        is_featured: d.is_featured as boolean | null,
        featured_until: d.featured_until as string | null,
      })),
      earliestMs,
      proximityDistances
    );
    finalDoctors = pinActiveFeaturedFirst(
      ranked.ranked as InventoryRankDoctor[]
    ) as Record<string, unknown>[];
    doctorIdsFullyBooked = ranked.doctorIdsFullyBooked;

    if (
      doctorIdsFullyBooked.length === finalDoctors.length &&
      finalDoctors.length > 0 &&
      !fallbackApplied
    ) {
      fallbackApplied = fullyBookedBanner(specialtyLabel, withinDays);
      matchMode = matchMode === "exact" ? "time_expanded" : matchMode;
    }
  }

  // Build distance map for client
  let distances: Record<string, number> | undefined;
  if (proximityDistances && proximityDistances.size > 0) {
    distances = {};
    for (const d of finalDoctors) {
      const id = d.id as string;
      const dist = proximityDistances.get(id);
      if (dist != null) distances[id] = Math.round(dist * 10) / 10;
    }
  }

  // Prefer time-expanded banner when recovery didn't set a geo message
  if (timeExpandedBanner && !fallbackApplied && finalDoctors.length > 0) {
    fallbackApplied = timeExpandedBanner;
    if (matchMode === "exact") matchMode = "time_expanded";
  }
  if (softFailures.includes("skill") && finalDoctors.length > 0 && !fallbackApplied) {
    fallbackApplied =
      "No doctors match that specific procedure yet. Showing specialists in the same field.";
  }

  const waitlistPrompt =
    primarySpecialty &&
    (matchMode === "platform_empty" ||
      matchMode === "empty" ||
      matchMode === "related" ||
      finalDoctors.length === 0 ||
      doctorIdsFullyBooked.length > 0)
      ? {
          specialtySlug: primarySpecialty,
          doctorIdsFullyBooked:
            doctorIdsFullyBooked.length > 0
              ? doctorIdsFullyBooked.slice(0, 12)
              : undefined,
        }
      : null;

  finalDoctors = pinActiveFeaturedFirst(
    finalDoctors as InventoryRankDoctor[]
  ) as Record<string, unknown>[];

  return {
    doctors: finalDoctors,
    total: resultCount || 0,
    page,
    perPage,
    matchScores: buildMatchScoresMap(finalDoctors, filters),
    distances,
    outsideLaunchRegion,
    searchCountryCode,
    fallbackApplied,
    specialistSuggestion,
    matchMode,
    waitlistPrompt,
    conditionMeta,
  };
}

export async function getSpecialties() {
  const supabase = createAdminClient();
  const { data } = await supabase
    .from("specialties")
    .select("*")
    .eq("is_active", true)
    .order("display_order");
  return data || [];
}

export async function getLocations() {
  const supabase = createAdminClient();
  const { data } = await supabase
    .from("locations")
    .select("*")
    .eq("is_active", true)
    .in("country_code", [...LAUNCH_REGION_CODES])
    .order("city");
  return data || [];
}

export interface DoctorSuggestion {
  name: string;
  slug: string;
  specialty: string;
}

export interface FeaturedDoctor extends DoctorSuggestion {
  id: string;
  avatarUrl: string | null;
  avgRating: number;
  totalReviews: number;
  yearsOfExperience: number | null;
  city: string | null;
  countryCode: string | null;
  /** ISO language codes the doctor speaks (e.g. en, tr, de) */
  languages: string[];
  /** Top patient skill endorsements (label + count) */
  endorsements: { label: string; count: number }[];
}

/**
 * Returns top-rated verified doctors for the homepage featured strip
 * and search dropdown "Specialists" column. Ordered by featured flag,
 * then rating, then reviews. Includes location, experience, languages,
 * and top endorsements.
 */
export async function getFeaturedDoctors(
  limit = 5
): Promise<FeaturedDoctor[]> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("doctors")
    .select(
      `
      id,
      slug,
      avg_rating,
      total_reviews,
      years_of_experience,
      languages,
      profile:profiles!doctors_profile_id_fkey(first_name, last_name, avatar_url),
      location:locations(city, country_code),
      specialties:doctor_specialties(
        specialty:specialties(name_key),
        is_primary
      )
    `
    )
    .eq("verification_status", "verified")
    .eq("is_active", true)
    .order("is_featured", { ascending: false })
    .order("avg_rating", { ascending: false })
    .order("total_reviews", { ascending: false })
    .limit(limit);

  if (error || !data) return [];

  const base = data.map((d: Record<string, unknown>) => {
    const profile: Record<string, unknown> = Array.isArray(d.profile)
      ? d.profile[0]
      : (d.profile as Record<string, unknown>);
    const location: Record<string, unknown> | null = Array.isArray(d.location)
      ? (d.location[0] as Record<string, unknown> | undefined) ?? null
      : (d.location as Record<string, unknown> | null);
    const specs = d.specialties as Array<{
      specialty: { name_key: string } | { name_key: string }[];
      is_primary: boolean;
    }>;
    const primarySpec = specs?.find((s) => s.is_primary);
    const spec = primarySpec || specs?.[0];
    const specData = spec?.specialty;
    const nameKey = Array.isArray(specData)
      ? specData[0]?.name_key
      : specData?.name_key;

    return {
      id: d.id as string,
      name: `${profile?.first_name || ""} ${profile?.last_name || ""}`.trim(),
      slug: d.slug as string,
      specialty: nameKey
        ? nameKey
            .replace("specialty.", "")
            .replace(/_/g, " ")
            .replace(/\b\w/g, (l: string) => l.toUpperCase())
        : "",
      avatarUrl: (profile?.avatar_url as string | null) ?? null,
      avgRating: Number(d.avg_rating) || 0,
      totalReviews: Number(d.total_reviews) || 0,
      yearsOfExperience:
        typeof d.years_of_experience === "number" ? d.years_of_experience : null,
      city: (location?.city as string | null) ?? null,
      countryCode: (location?.country_code as string | null) ?? null,
      languages: Array.isArray(d.languages)
        ? (d.languages as string[]).filter(Boolean)
        : [],
      endorsements: [] as { label: string; count: number }[],
    };
  });

  // Attach top patient skill endorsements (batch query)
  try {
    const endorsementMap = await getTopEndorsementsBatch(
      base.map((d) => d.id),
      2
    );
    for (const doctor of base) {
      doctor.endorsements = endorsementMap[doctor.id] ?? [];
    }
  } catch (err) {
    log.error("Featured doctor endorsements batch failed:", { err });
  }

  return base;
}

export async function searchSuggestions(
  query: string
): Promise<DoctorSuggestion[]> {
  if (!query || query.trim().length < 2) return [];

  const supabase = createAdminClient();
  const term = query.trim();

  const { data, error } = await supabase
    .from("doctors")
    .select(
      `
      slug,
      profile:profiles!doctors_profile_id_fkey(first_name, last_name),
      specialties:doctor_specialties(
        specialty:specialties(name_key),
        is_primary
      )
    `
    )
    .eq("verification_status", "verified")
    .eq("is_active", true)
    .or(
      `profile.first_name.ilike.%${term}%,profile.last_name.ilike.%${term}%`
    )
    .limit(5);

  if (error || !data) return [];

  return data.map((d: Record<string, unknown>) => {
    const profile: Record<string, unknown> = Array.isArray(d.profile)
      ? d.profile[0]
      : (d.profile as Record<string, unknown>);
    const specs = d.specialties as Array<{
      specialty: { name_key: string } | { name_key: string }[];
      is_primary: boolean;
    }>;
    const primarySpec = specs?.find((s) => s.is_primary);
    const spec = primarySpec || specs?.[0];
    const specData = spec?.specialty;
    const nameKey = Array.isArray(specData)
      ? specData[0]?.name_key
      : specData?.name_key;

    return {
      name: `${profile?.first_name || ""} ${profile?.last_name || ""}`.trim(),
      slug: d.slug as string,
      specialty: nameKey
        ? nameKey
            .replace("specialty.", "")
            .replace(/_/g, " ")
            .replace(/\b\w/g, (l: string) => l.toUpperCase())
        : "",
    };
  });
}

export async function getSameDayAvailabilityCount(): Promise<number> {
  const supabase = createAdminClient();
  const { data, error } = await supabase.rpc("get_doctor_ids_available_today");
  if (error || !data) return 0;
  return (data as string[]).length;
}

/* ── Batch next-availability for doctor cards ──────────────── */

export interface NextAvailabilitySlot {
  start: string; // TIMESTAMPTZ string
  end: string;   // TIMESTAMPTZ string
}

export interface DoctorNextAvailability {
  date: string; // ISO date e.g. "2026-03-05"
  slots: NextAvailabilitySlot[];
  consultationType: string; // "in_person" or "video" — used to build booking links
}

/**
 * For a list of doctor IDs, returns the next available day + up to 4 slots
 * for each doctor. Single DB round-trip via the batch RPC function.
 * @param maxDays Lookahead window in days (default 14). Use 5 for Next GP shortcuts.
 */
export async function getNextAvailabilityBatch(
  doctorIds: string[],
  consultationType?: string,
  maxDays = 14
): Promise<Record<string, DoctorNextAvailability>> {
  if (doctorIds.length === 0) return {};

  const supabase = createAdminClient();
  const { data, error } = await supabase.rpc(
    "get_next_available_slots_batch",
    {
      p_doctor_ids: doctorIds,
      p_max_days: maxDays,
      p_max_slots: 4,
      p_consultation_type: consultationType || "in_person",
    }
  );

  if (error || !data) {
    log.error("Batch availability RPC error:", { err: error });
    return {};
  }

  // Group flat rows by doctor_id
  const usedType = consultationType || "in_person";
  const result: Record<string, DoctorNextAvailability> = {};
  for (const row of data as {
    doctor_id: string;
    available_date: string;
    slot_start: string;
    slot_end: string;
  }[]) {
    if (!result[row.doctor_id]) {
      result[row.doctor_id] = { date: row.available_date, slots: [], consultationType: usedType };
    }
    result[row.doctor_id].slots.push({
      start: row.slot_start,
      end: row.slot_end,
    });
  }

  return result;
}

/* ── Multi-day batch availability for doctor cards ────────── */

export interface DoctorMultiDayAvailability {
  days: { date: string; slots: NextAvailabilitySlot[] }[];
  consultationType: string;
}

/**
 * For a list of doctor IDs, returns the next N available days + up to 12 slots
 * per day for each doctor. Single DB round-trip via the batch RPC function.
 */
export async function getMultiDayAvailabilityBatch(
  doctorIds: string[],
  consultationType?: string
): Promise<Record<string, DoctorMultiDayAvailability>> {
  if (doctorIds.length === 0) return {};

  const supabase = createAdminClient();
  const { data, error } = await supabase.rpc(
    "get_multi_day_available_slots_batch",
    {
      p_doctor_ids: doctorIds,
      p_lookahead_days: 14,
      p_max_days_per_doctor: 7,
      p_max_slots_per_day: 12,
      p_consultation_type: consultationType || "in_person",
    }
  );

  if (error || !data) {
    log.error("Multi-day batch availability RPC error:", { err: error });
    return {};
  }

  const usedType = consultationType || "in_person";
  const result: Record<string, DoctorMultiDayAvailability> = {};
  for (const row of data as {
    doctor_id: string;
    available_date: string;
    slot_start: string;
    slot_end: string;
  }[]) {
    if (!result[row.doctor_id]) {
      result[row.doctor_id] = { days: [], consultationType: usedType };
    }
    const existingDay = result[row.doctor_id].days.find(
      (d) => d.date === row.available_date
    );
    if (existingDay) {
      existingDay.slots.push({ start: row.slot_start, end: row.slot_end });
    } else {
      result[row.doctor_id].days.push({
        date: row.available_date,
        slots: [{ start: row.slot_start, end: row.slot_end }],
      });
    }
  }

  return result;
}

export async function getSpecialtyBySlug(slug: string) {
  const supabase = createAdminClient();

  // Get the specialty record
  const { data: specialty } = await supabase
    .from("specialties")
    .select("*")
    .eq("slug", slug)
    .eq("is_active", true)
    .single();

  if (!specialty) return null;

  // Get doctor IDs for this specialty
  const { data: junctionRows } = await supabase
    .from("doctor_specialties")
    .select("doctor_id")
    .eq("specialty_id", specialty.id);

  const doctorIds = (junctionRows || []).map(
    (r: { doctor_id: string }) => r.doctor_id
  );

  if (doctorIds.length === 0) {
    return {
      specialty,
      doctorCount: 0,
      doctors: [],
      priceRange: null,
      avgRating: null,
    };
  }

  // Get accurate count of verified doctors in this specialty
  const { count } = await supabase
    .from("doctors")
    .select("id", { count: "exact", head: true })
    .in("id", doctorIds)
    .eq("verification_status", "verified")
    .eq("is_active", true);

  // Get top-rated verified doctors (limit 6 for the landing page)
  const { data: doctors } = await supabase
    .from("doctors")
    .select(
      `
      *,
      profile:profiles!doctors_profile_id_fkey(first_name, last_name, avatar_url),
      location:locations(city, country_code, slug),
      specialties:doctor_specialties(
        specialty:specialties(id, name_key, slug),
        is_primary
      ),
      photos:doctor_photos(storage_path, alt_text, is_primary)
    `
    )
    .in("id", doctorIds)
    .eq("verification_status", "verified")
    .eq("is_active", true)
    .order("is_featured", { ascending: false })
    .order("avg_rating", { ascending: false })
    .limit(6);

  const verifiedDoctors = doctors || [];

  // Calculate price range and avg rating from fetched doctors
  const fees = verifiedDoctors
    .map((d: Record<string, unknown>) => d.consultation_fee_cents as number)
    .filter(Boolean);
  const ratings = verifiedDoctors
    .map((d: Record<string, unknown>) => d.avg_rating as number)
    .filter(Boolean);

  return {
    specialty,
    doctorCount: count || 0,
    doctors: verifiedDoctors,
    priceRange: fees.length
      ? { min: Math.min(...fees), max: Math.max(...fees) }
      : null,
    avgRating: ratings.length
      ? ratings.reduce((a, b) => a + b, 0) / ratings.length
      : null,
  };
}

// ── Search Expansion Suggestions ──────────────────────────────────────
// When AI-parsed search returns ≤2 results, compute alternative counts
// by relaxing one filter at a time so we can suggest broader searches.

export interface SearchExpansion {
  type: "remove_location" | "try_video" | "remove_consultation_type" | "broaden_specialty";
  label: string;
  count: number;
  url: string;
}

export async function getSearchExpansionSuggestions(
  filters: Record<string, string | undefined>
): Promise<SearchExpansion[]> {
  const supabase = createAdminClient();
  const suggestions: SearchExpansion[] = [];

  // Helper: count verified active doctors matching given filters
  async function countDoctors(opts: {
    specialtySlug?: string;
    consultationType?: string;
    locationSlug?: string;
    placeLat?: number;
    placeLng?: number;
    radius?: number;
    language?: string;
  }): Promise<number> {
    let q = supabase
      .from("doctors")
      .select("id", { count: "exact", head: true })
      .eq("verification_status", "verified")
      .eq("is_active", true);

    if (opts.specialtySlug) {
      const { data: specRow } = await supabase
        .from("specialties")
        .select("id")
        .eq("slug", opts.specialtySlug)
        .single();
      if (specRow) {
        const { data: matchRows } = await supabase
          .from("doctor_specialties")
          .select("doctor_id")
          .eq("specialty_id", specRow.id);
        const ids = (matchRows || []).map((r: { doctor_id: string }) => r.doctor_id);
        if (ids.length === 0) return 0;
        q = q.in("id", ids);
      }
    }

    if (opts.consultationType) {
      q = q.contains("consultation_types", [opts.consultationType]);
    }

    if (opts.language) {
      q = q.contains("languages", [opts.language]);
    }

    if (opts.locationSlug) {
      // Join on location to filter by slug
      const isCountry = opts.locationSlug.startsWith("country-");
      if (isCountry) {
        const code = opts.locationSlug.replace("country-", "").toUpperCase();
        const { data } = await supabase
          .from("locations")
          .select("id")
          .eq("country_code", code);
        if (data && data.length > 0) {
          const locIds = data.map((l: { id: string }) => l.id);
          q = q.in("location_id", locIds);
        }
      } else {
        const { data: loc } = await supabase
          .from("locations")
          .select("id")
          .eq("slug", opts.locationSlug)
          .single();
        if (loc) {
          q = q.eq("location_id", loc.id);
        }
      }
    }

    if (opts.placeLat != null && opts.placeLng != null) {
      const r = opts.radius || 10;
      const { data: nearby } = await supabase.rpc("sort_doctors_by_distance", {
        p_lat: opts.placeLat,
        p_lng: opts.placeLng,
      });
      if (nearby) {
        const nearbyIds = (nearby as { doctor_id: string; distance_km: number }[])
          .filter((row) => row.distance_km <= r)
          .map((row) => row.doctor_id);
        if (nearbyIds.length === 0) return 0;
        q = q.in("id", nearbyIds);
      }
    }

    const { count } = await q;
    return count || 0;
  }

  const specialty = filters.specialty;
  const location = filters.location;
  const consultationType = filters.consultationType;
  const language = filters.language;
  const placeLat = filters.placeLat ? Number(filters.placeLat) : undefined;
  const placeLng = filters.placeLng ? Number(filters.placeLng) : undefined;
  const radius = filters.radius ? Number(filters.radius) : undefined;
  const hasLocation = !!location || (placeLat != null && placeLng != null);

  // Build the base params (preserving existing params) for generating URLs
  function buildUrl(overrides: Record<string, string | undefined>): string {
    const params = new URLSearchParams();
    // Start with current filters
    for (const [k, v] of Object.entries(filters)) {
      if (v != null && v !== "" && k !== "page") params.set(k, v);
    }
    // Apply overrides (undefined = remove param)
    for (const [k, v] of Object.entries(overrides)) {
      if (v === undefined) {
        params.delete(k);
      } else {
        params.set(k, v);
      }
    }
    return `/doctors?${params.toString()}`;
  }

  // Run expansion checks in parallel
  const checks: Promise<void>[] = [];

  // 1. Try video consultation (if currently filtering in_person)
  if (consultationType === "in_person" && specialty) {
    checks.push(
      countDoctors({
        specialtySlug: specialty,
        consultationType: "video",
        locationSlug: location,
        placeLat,
        placeLng,
        radius,
        language,
      }).then((count) => {
        if (count > 0) {
          suggestions.push({
            type: "try_video",
            label: "Try video consultation",
            count,
            url: buildUrl({ consultationType: "video" }),
          });
        }
      })
    );
  }

  // 2. Remove location filter
  if (hasLocation && specialty) {
    checks.push(
      countDoctors({
        specialtySlug: specialty,
        consultationType,
        language,
      }).then((count) => {
        if (count > 2) {
          suggestions.push({
            type: "remove_location",
            label: "Search all locations",
            count,
            url: buildUrl({
              location: undefined,
              placeLat: undefined,
              placeLng: undefined,
              placeName: undefined,
              radius: undefined,
            }),
          });
        }
      })
    );
  }

  // 3. Remove consultation type filter
  if (consultationType && specialty) {
    checks.push(
      countDoctors({
        specialtySlug: specialty,
        locationSlug: location,
        placeLat,
        placeLng,
        radius,
        language,
      }).then((count) => {
        if (count > 2) {
          suggestions.push({
            type: "remove_consultation_type",
            label: "Any consultation type",
            count,
            url: buildUrl({ consultationType: undefined }),
          });
        }
      })
    );
  }

  // 4. Broaden to General Practice (if searching a specialist)
  if (specialty && specialty !== "general-practice") {
    checks.push(
      countDoctors({
        specialtySlug: "general-practice",
        consultationType,
        locationSlug: location,
        placeLat,
        placeLng,
        radius,
        language,
      }).then((count) => {
        if (count > 0) {
          suggestions.push({
            type: "broaden_specialty",
            label: "Also try General Practice",
            count,
            url: buildUrl({ specialty: "general-practice" }),
          });
        }
      })
    );
  }

  await Promise.all(checks);

  // Sort: video first, then location, then consultation type, then specialty
  const order: Record<string, number> = {
    try_video: 0,
    remove_location: 1,
    remove_consultation_type: 2,
    broaden_specialty: 3,
  };
  suggestions.sort((a, b) => (order[a.type] ?? 99) - (order[b.type] ?? 99));

  return suggestions;
}
