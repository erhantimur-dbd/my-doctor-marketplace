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
