"use server";

import { createAdminClient } from "@/lib/supabase/admin";

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
}

export async function searchDoctors(filters: SearchFilters) {
  const supabase = createAdminClient();

  let query = supabase
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
    `,
      { count: "exact" }
    )
    .eq("verification_status", "verified")
    .eq("is_active", true);

  // Same-day availability filter
  if (filters.availableToday) {
    const { data: doctorIds, error: rpcError } = await supabase.rpc(
      "get_doctor_ids_available_today"
    );

    if (rpcError) {
      console.error("Same-day availability RPC error:", rpcError);
      return { doctors: [], total: 0, page: filters.page || 1, perPage: 12 };
    }

    const ids = (doctorIds as string[]) || [];
    if (ids.length === 0) {
      return { doctors: [], total: 0, page: filters.page || 1, perPage: 12 };
    }

    query = query.in("id", ids);
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
  if (filters.location) {
    query = query.eq("location.slug", filters.location);
  }
  if (filters.query) {
    query = query.ilike("bio", `%${filters.query}%`);
  }

  // Sort
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

  // Pagination
  const page = filters.page || 1;
  const perPage = 12;
  query = query.range((page - 1) * perPage, page * perPage - 1);

  const { data, count, error } = await query;

  if (error) {
    console.error("Search error:", error);
    return { doctors: [], total: 0, page, perPage };
  }

  return { doctors: data || [], total: count || 0, page, perPage };
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
