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
import { log } from "@/lib/utils/logger";

// Common symptom/keyword → [primary GP, specialist] mapping for free-text search.
// GP is always included as the first port of call; specialist is shown as an option.
const KEYWORD_SPECIALTY_MAP: Record<string, { primary: string; specialist: string }> = {
  // General symptoms → GP first, specialist secondary
  headache: { primary: "general-practice", specialist: "neurology" },
  migraine: { primary: "general-practice", specialist: "neurology" },
  dizzy: { primary: "general-practice", specialist: "neurology" },
  seizure: { primary: "general-practice", specialist: "neurology" },
  sick: { primary: "general-practice", specialist: "gastroenterology" },
  nausea: { primary: "general-practice", specialist: "gastroenterology" },
  tired: { primary: "general-practice", specialist: "endocrinology" },
  fatigue: { primary: "general-practice", specialist: "endocrinology" },
  fever: { primary: "general-practice", specialist: "general-practice" },
  pain: { primary: "general-practice", specialist: "general-practice" },
  // Skin
  skin: { primary: "general-practice", specialist: "dermatology" },
  rash: { primary: "general-practice", specialist: "dermatology" },
  acne: { primary: "dermatology", specialist: "dermatology" },
  eczema: { primary: "dermatology", specialist: "dermatology" },
  // Heart
  heart: { primary: "general-practice", specialist: "cardiology" },
  chest: { primary: "general-practice", specialist: "cardiology" },
  palpitations: { primary: "general-practice", specialist: "cardiology" },
  // Musculoskeletal
  bone: { primary: "general-practice", specialist: "orthopedics" },
  joint: { primary: "general-practice", specialist: "orthopedics" },
  knee: { primary: "general-practice", specialist: "orthopedics" },
  back: { primary: "general-practice", specialist: "orthopedics" },
  fracture: { primary: "general-practice", specialist: "orthopedics" },
  // Eye
  eye: { primary: "general-practice", specialist: "ophthalmology" },
  vision: { primary: "general-practice", specialist: "ophthalmology" },
  sight: { primary: "general-practice", specialist: "ophthalmology" },
  // Ear/Nose/Throat
  ear: { primary: "general-practice", specialist: "ent" },
  nose: { primary: "general-practice", specialist: "ent" },
  throat: { primary: "general-practice", specialist: "ent" },
  hearing: { primary: "general-practice", specialist: "ent" },
  sinus: { primary: "general-practice", specialist: "ent" },
  // Digestive
  stomach: { primary: "general-practice", specialist: "gastroenterology" },
  digestive: { primary: "general-practice", specialist: "gastroenterology" },
  gut: { primary: "general-practice", specialist: "gastroenterology" },
  ibs: { primary: "gastroenterology", specialist: "gastroenterology" },
  // Endocrine
  diabetes: { primary: "general-practice", specialist: "endocrinology" },
  thyroid: { primary: "general-practice", specialist: "endocrinology" },
  hormone: { primary: "general-practice", specialist: "endocrinology" },
  // Respiratory
  lung: { primary: "general-practice", specialist: "pulmonology" },
  breathing: { primary: "general-practice", specialist: "pulmonology" },
  asthma: { primary: "general-practice", specialist: "pulmonology" },
  cough: { primary: "general-practice", specialist: "pulmonology" },
  // Oncology
  cancer: { primary: "general-practice", specialist: "oncology" },
  tumor: { primary: "general-practice", specialist: "oncology" },
  lump: { primary: "general-practice", specialist: "oncology" },
  // Pediatrics
  child: { primary: "pediatrics", specialist: "pediatrics" },
  baby: { primary: "pediatrics", specialist: "pediatrics" },
  infant: { primary: "pediatrics", specialist: "pediatrics" },
  // Dental
  teeth: { primary: "dentistry", specialist: "dentistry" },
  dental: { primary: "dentistry", specialist: "dentistry" },
  tooth: { primary: "dentistry", specialist: "dentistry" },
  // Mental health
  anxiety: { primary: "general-practice", specialist: "psychology" },
  depression: { primary: "general-practice", specialist: "psychology" },
  mental: { primary: "general-practice", specialist: "psychiatry" },
  stress: { primary: "general-practice", specialist: "psychology" },
  // Women's health
  pregnancy: { primary: "gynecology", specialist: "gynecology" },
  period: { primary: "general-practice", specialist: "gynecology" },
  fertility: { primary: "gynecology", specialist: "gynecology" },
  // Urinary
  urine: { primary: "general-practice", specialist: "urology" },
  bladder: { primary: "general-practice", specialist: "urology" },
  kidney: { primary: "general-practice", specialist: "nephrology" },
  // Allergy
  allergy: { primary: "general-practice", specialist: "allergy" },
  allergic: { primary: "general-practice", specialist: "allergy" },
  hayfever: { primary: "general-practice", specialist: "allergy" },
  // Lifestyle
  weight: { primary: "general-practice", specialist: "nutrition" },
  diet: { primary: "nutrition", specialist: "nutrition" },
  obesity: { primary: "general-practice", specialist: "nutrition" },
  // Physio
  physiotherapy: { primary: "physiotherapy", specialist: "physiotherapy" },
  physio: { primary: "physiotherapy", specialist: "physiotherapy" },
  rehab: { primary: "physiotherapy", specialist: "physiotherapy" },
};

export interface SearchFilters {
  specialty?: string;
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
  /** Proximity search: latitude of a selected place (borough, street, etc.) */
  placeLat?: number;
  /** Proximity search: longitude of a selected place */
  placeLng?: number;
  /** Proximity search: radius in km (default 25) */
  radius?: number;
}

export async function searchDoctors(filters: SearchFilters) {
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
      photos:doctor_photos(storage_path, alt_text, is_primary)
    `,
      { count: "exact" }
    )
    .eq("verification_status", "verified")
    .eq("is_active", true);

  // License filter: only show doctors with active org licenses (or legacy subscriptions)
  const { data: licensedIds } = await supabase.rpc("get_licensed_doctor_ids");
  if (licensedIds && licensedIds.length > 0) {
    query = query.in("id", licensedIds);
  }

  // Provider type filter (doctor vs testing_service)
  if (filters.providerType) {
    query = query.eq("provider_type", filters.providerType);
  }

  // Same-day availability filter
  if (filters.availableToday) {
    const { data: doctorIds, error: rpcError } = await supabase.rpc(
      "get_doctor_ids_available_today"
    );

    if (rpcError) {
      log.error("Same-day availability RPC error:", { err: rpcError });
      return { doctors: [], total: 0, page: filters.page || 1, perPage: 12 };
    }

    const ids = (doctorIds as string[]) || [];
    if (ids.length === 0) {
      return { doctors: [], total: 0, page: filters.page || 1, perPage: 12 };
    }

    query = query.in("id", ids);
  }

  // Specialty filter — two-step: resolve slug → specialty ID → matching doctor IDs
  if (filters.specialty) {
    const { data: specRow } = await supabase
      .from("specialties")
      .select("id")
      .eq("slug", filters.specialty)
      .single();

    if (specRow) {
      const { data: matchRows } = await supabase
        .from("doctor_specialties")
        .select("doctor_id")
        .eq("specialty_id", specRow.id);

      const ids = (matchRows || []).map(
        (r: { doctor_id: string }) => r.doctor_id
      );
      if (ids.length === 0) {
        return { doctors: [], total: 0, page: filters.page || 1, perPage: 12 };
      }
      query = query.in("id", ids);
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
  if (filters.consultationType) {
    query = query.contains("consultation_types", [filters.consultationType]);
  }
  // Proximity search: when a Place (borough, street, etc.) is selected,
  // filter doctors within the given radius of those coordinates.
  // This replaces the predefined location filter.
  let proximityDistances: Map<string, number> | undefined;
  if (
    filters.placeLat != null &&
    filters.placeLng != null &&
    !filters.location
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
        return { doctors: [], total: 0, page: filters.page || 1, perPage: 12 };
      }

      const proximityIds = withinRadius.map((r) => r.doctor_id);
      query = query.in("id", proximityIds);

      // Store distances for potential use in sorting / response
      proximityDistances = new Map(
        withinRadius.map((r) => [r.doctor_id, r.distance_km])
      );
    }
  }

  if (filters.location) {
    if (isCountryFilter) {
      // Country-level filter (e.g. "country-gb" → country_code "GB")
      const countryCode = filters.location.replace("country-", "").toUpperCase();
      query = query.eq("location.country_code", countryCode);
    } else if (filters.consultationType === "video") {
      // Video consultations: expand to country-level so patients see all
      // doctors in the same country, not just the selected city.
      const { data: loc } = await supabase
        .from("locations")
        .select("country_code")
        .eq("slug", filters.location)
        .single();

      if (loc) {
        query = query.eq("location.country_code", loc.country_code);
      } else {
        query = query.eq("location.slug", filters.location);
      }
    } else {
      // In-person / default: prefer proximity-based matching so that
      // nearby cities (e.g. Islington → London doctors) are included.
      // Falls back to exact slug match if the location has no coordinates.
      const { data: selectedLoc } = await supabase
        .from("locations")
        .select("latitude, longitude, country_code")
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
          } else {
            // No doctors within radius — fall back to same country
            query = query.eq("location.country_code", selectedLoc.country_code);
          }
        } else {
          // RPC failed — fall back to exact slug match
          query = query.eq("location.slug", filters.location);
        }
      } else {
        // No coordinates — fall back to exact slug match
        query = query.eq("location.slug", filters.location);
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
    // Remove the location filter for non-launch regions — show all video doctors
    // We need to re-create the query without the location inner join constraint
    // Instead, just expand to all launch region doctors offering video
    query = query.in(
      "location.country_code",
      LAUNCH_REGION_CODES as unknown as string[]
    );
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

  // Pagination
  const page = filters.page || 1;
  const perPage = 12;

  // "Nearest" sort uses a two-pass approach: RPC for ordered IDs, then fetch page slice
  if (
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
        return { doctors: [], total, page, perPage };
      }

      query = query.in("id", pageIds);

      const { data, error } = await query;

      if (error) {
        log.error("Search error:", { err: error });
        return { doctors: [], total: 0, page, perPage };
      }

      // Re-sort to match distance order (Supabase .in() doesn't preserve order)
      const idIndexMap = new Map(
        pageIds.map((id, i) => [id, i])
      );
      const sorted = (data || []).sort(
        (a: Record<string, unknown>, b: Record<string, unknown>) =>
          (idIndexMap.get(a.id as string) ?? Infinity) -
          (idIndexMap.get(b.id as string) ?? Infinity)
      );

      return { doctors: sorted, total, page, perPage };
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
  }

  const { data, count, error } = await query;

  if (error) {
    log.error("Search error:", { err: error });
    return { doctors: [], total: 0, page, perPage, matchScores: undefined };
  }

  // ── Zero-result fallback chain ─────────────────────────────────
  // If the full filter pipeline returned 0 results, progressively relax
  // filters to ensure the user always sees something useful.
  let fallbackApplied: string | null = null;
  let fallbackData = data;
  let fallbackCount = count;

  if ((!data || data.length === 0) && (filters.query || filters.specialty || textFilterApplied || matchedSpecialtySlug)) {
    // Fallback 1: Drop text/specialty filter, keep location/proximity
    const hasLocationFilter = !!(filters.placeLat || filters.location);
    if (hasLocationFilter) {
      let fbQuery = supabase
        .from("doctors")
        .select(
          `*,
           profile:profiles!doctors_profile_id_fkey(first_name, last_name, avatar_url),
           location:locations(city, country_code, slug, latitude, longitude),
           specialties:doctor_specialties(specialty:specialties(id, name_key, slug), is_primary),
           photos:doctor_photos(storage_path, alt_text, is_primary)`,
          { count: "exact" }
        )
        .eq("verification_status", "verified")
        .eq("is_active", true);

      // Re-apply license filter
      if (licensedIds && licensedIds.length > 0) {
        fbQuery = fbQuery.in("id", licensedIds);
      }

      // Re-apply proximity if available
      if (proximityDistances && proximityDistances.size > 0) {
        fbQuery = fbQuery.in("id", [...proximityDistances.keys()]);
      } else if (filters.location && !isCountryFilter) {
        // Expand to country level
        const { data: locRow } = await supabase
          .from("locations")
          .select("country_code")
          .eq("slug", filters.location)
          .single();
        if (locRow) {
          fbQuery = fbQuery.eq("location.country_code", locRow.country_code);
        }
      }

      fbQuery = fbQuery
        .order("is_featured", { ascending: false })
        .order("avg_rating", { ascending: false })
        .range(0, perPage - 1);

      const fbResult = await fbQuery;
      if (fbResult.data && fbResult.data.length > 0) {
        fallbackData = fbResult.data;
        fallbackCount = fbResult.count;
        fallbackApplied = matchedSpecialtySlug
          ? `No ${matchedSpecialtySlug.replace(/-/g, " ")} specialists found nearby. Showing all nearby doctors.`
          : "No exact matches found. Showing nearby doctors instead.";
      }
    }

    // Fallback 2: If still 0 and had proximity, expand to country
    if (!fallbackData || fallbackData.length === 0) {
      if (filters.placeLat != null) {
        let fbQuery2 = supabase
          .from("doctors")
          .select(
            `*,
             profile:profiles!doctors_profile_id_fkey(first_name, last_name, avatar_url),
             location:locations!inner(city, country_code, slug, latitude, longitude),
             specialties:doctor_specialties(specialty:specialties(id, name_key, slug), is_primary),
             photos:doctor_photos(storage_path, alt_text, is_primary)`,
            { count: "exact" }
          )
          .eq("verification_status", "verified")
          .eq("is_active", true)
          .eq("location.country_code", "GB"); // Default to GB for now

        if (licensedIds && licensedIds.length > 0) {
          fbQuery2 = fbQuery2.in("id", licensedIds);
        }

        fbQuery2 = fbQuery2
          .order("is_featured", { ascending: false })
          .order("avg_rating", { ascending: false })
          .range(0, perPage - 1);

        const fbResult2 = await fbQuery2;
        if (fbResult2.data && fbResult2.data.length > 0) {
          fallbackData = fbResult2.data;
          fallbackCount = fbResult2.count;
          fallbackApplied = "No doctors found in your area. Showing doctors across the country.";
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

    // Sort doctors by match score
    const sorted = [...resultData].sort((a: Record<string, unknown>, b: Record<string, unknown>) => {
      const scoreA = scoreMap.get(a.id as string)?.matchScore ?? 0;
      const scoreB = scoreMap.get(b.id as string)?.matchScore ?? 0;
      return scoreB - scoreA;
    });

    // Build match score map for the client
    const matchScores: Record<string, { score: number; reasons: string[] }> = {};
    for (const s of scored) {
      matchScores[s.doctorId] = { score: s.matchScore, reasons: s.matchReasons };
    }

    return { doctors: sorted, total: resultCount || 0, page, perPage, matchScores, fallbackApplied, specialistSuggestion };
  }

  // When proximity search is active, sort by distance (nearest first) by default
  let finalDoctors = resultData || [];
  if (proximityDistances && proximityDistances.size > 0 && filters.sort !== "rating" && filters.sort !== "price_asc" && filters.sort !== "price_desc") {
    finalDoctors = [...finalDoctors].sort(
      (a: Record<string, unknown>, b: Record<string, unknown>) =>
        (proximityDistances!.get(a.id as string) ?? Infinity) -
        (proximityDistances!.get(b.id as string) ?? Infinity)
    );
  }

  // Build distance map for client
  let distances: Record<string, number> | undefined;
  if (proximityDistances && proximityDistances.size > 0) {
    distances = {};
    for (const d of finalDoctors) {
      const id = (d as Record<string, unknown>).id as string;
      const dist = proximityDistances.get(id);
      if (dist != null) distances[id] = Math.round(dist * 10) / 10;
    }
  }

  return { doctors: finalDoctors, total: resultCount || 0, page, perPage, matchScores: undefined, distances, outsideLaunchRegion, searchCountryCode, fallbackApplied, specialistSuggestion };
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
 */
export async function getNextAvailabilityBatch(
  doctorIds: string[],
  consultationType?: string
): Promise<Record<string, DoctorNextAvailability>> {
  if (doctorIds.length === 0) return {};

  const supabase = createAdminClient();
  const { data, error } = await supabase.rpc(
    "get_next_available_slots_batch",
    {
      p_doctor_ids: doctorIds,
      p_max_days: 14,
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
