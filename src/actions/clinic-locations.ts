"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { revalidatePath } from "next/cache";
import { requireOrgMember } from "./organization";
import { z } from "zod/v4";
import type { ClinicLocation, DoctorLocationAssignment } from "@/types";

// ─── Validators ──────────────────────────────────────────────

const upsertLocationSchema = z.object({
  name: z.string().min(1).max(100),
  address_line1: z.string().max(200).optional(),
  address_line2: z.string().max(200).optional(),
  city: z.string().max(100).optional(),
  state: z.string().max(100).optional(),
  country_code: z.string().length(2).default("GB"),
  postal_code: z.string().max(20).optional(),
  phone: z.string().max(30).optional(),
  email: z.email().optional().or(z.literal("")),
  is_primary: z.coerce.boolean().default(false),
});

// ─── Read ────────────────────────────────────────────────────

export async function getClinicLocations() {
  const { error: authError, supabase, org } = await requireOrgMember();
  if (authError || !supabase || !org) return { error: authError, locations: [] };

  const { data, error } = await supabase
    .from("clinic_locations")
    .select("*")
    .eq("organization_id", org.id)
    .order("is_primary", { ascending: false })
    .order("created_at", { ascending: true });

  if (error) return { error: error.message, locations: [] };
  return { error: null, locations: (data ?? []) as ClinicLocation[] };
}

export async function getClinicLocationDoctors(locationId: string) {
  const { error: authError, supabase, org } = await requireOrgMember();
  if (authError || !supabase || !org) return { error: authError, assignments: [] };

  const { data, error } = await supabase
    .from("doctor_location_assignments")
    .select(`
      *,
      doctor:doctors(
        id, slug, consultation_fee_cents,
        profile:profiles(first_name, last_name, avatar_url),
        specialties:doctor_specialties(specialty:specialties(name_key))
      )
    `)
    .eq("clinic_location_id", locationId)
    .eq("organization_id", org.id)
    .eq("is_active", true);

  if (error) return { error: error.message, assignments: [] };
  return { error: null, assignments: data ?? [] };
}

// ─── Mutations ───────────────────────────────────────────────

export async function createClinicLocation(formData: FormData) {
  const { error: authError, org } = await requireOrgMember(["owner", "admin"]);
  if (authError || !org) return { error: authError };

  const raw = {
    name: formData.get("name") as string,
    address_line1: (formData.get("address_line1") as string) || undefined,
    address_line2: (formData.get("address_line2") as string) || undefined,
    city: (formData.get("city") as string) || undefined,
    state: (formData.get("state") as string) || undefined,
    country_code: (formData.get("country_code") as string) || "GB",
    postal_code: (formData.get("postal_code") as string) || undefined,
    phone: (formData.get("phone") as string) || undefined,
    email: (formData.get("email") as string) || undefined,
    is_primary: formData.get("is_primary") === "true",
  };

  const parsed = upsertLocationSchema.safeParse(raw);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message || "Invalid input" };

  const adminSupabase = createAdminClient();

  // If setting as primary, clear existing primary first
  if (parsed.data.is_primary) {
    await adminSupabase
      .from("clinic_locations")
      .update({ is_primary: false })
      .eq("organization_id", org.id)
      .eq("is_primary", true);
  }

  const { data, error } = await adminSupabase
    .from("clinic_locations")
    .insert({
      organization_id: org.id,
      ...parsed.data,
      email: parsed.data.email || null,
    })
    .select("id")
    .single();

  if (error) return { error: error.message };

  revalidatePath("/doctor-dashboard/organization/locations");
  return { error: null, locationId: data.id };
}

export async function updateClinicLocation(formData: FormData) {
  const { error: authError, org } = await requireOrgMember(["owner", "admin"]);
  if (authError || !org) return { error: authError };

  const locationId = formData.get("location_id") as string;
  if (!locationId) return { error: "Location ID required" };

  const raw = {
    name: formData.get("name") as string,
    address_line1: (formData.get("address_line1") as string) || undefined,
    address_line2: (formData.get("address_line2") as string) || undefined,
    city: (formData.get("city") as string) || undefined,
    state: (formData.get("state") as string) || undefined,
    country_code: (formData.get("country_code") as string) || "GB",
    postal_code: (formData.get("postal_code") as string) || undefined,
    phone: (formData.get("phone") as string) || undefined,
    email: (formData.get("email") as string) || undefined,
    is_primary: formData.get("is_primary") === "true",
  };

  const parsed = upsertLocationSchema.safeParse(raw);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message || "Invalid input" };

  const adminSupabase = createAdminClient();

  // If setting as primary, clear existing primary first
  if (parsed.data.is_primary) {
    await adminSupabase
      .from("clinic_locations")
      .update({ is_primary: false })
      .eq("organization_id", org.id)
      .eq("is_primary", true)
      .neq("id", locationId);
  }

  const { error } = await adminSupabase
    .from("clinic_locations")
    .update({ ...parsed.data, email: parsed.data.email || null })
    .eq("id", locationId)
    .eq("organization_id", org.id);

  if (error) return { error: error.message };

  revalidatePath("/doctor-dashboard/organization/locations");
  return { error: null };
}

export async function deactivateClinicLocation(locationId: string) {
  const { error: authError, org } = await requireOrgMember(["owner", "admin"]);
  if (authError || !org) return { error: authError };

  const adminSupabase = createAdminClient();

  // Deactivate location + all its doctor assignments
  const [{ error: locError }] = await Promise.all([
    adminSupabase
      .from("clinic_locations")
      .update({ is_active: false, is_primary: false })
      .eq("id", locationId)
      .eq("organization_id", org.id),
    adminSupabase
      .from("doctor_location_assignments")
      .update({ is_active: false })
      .eq("clinic_location_id", locationId),
  ]);

  if (locError) return { error: locError.message };

  revalidatePath("/doctor-dashboard/organization/locations");
  return { error: null };
}

// ─── Doctor ↔ Location Assignment ────────────────────────────

export async function assignDoctorToLocation(doctorId: string, locationId: string) {
  const { error: authError, org } = await requireOrgMember(["owner", "admin"]);
  if (authError || !org) return { error: authError };

  const adminSupabase = createAdminClient();

  // Upsert: re-activate if previously removed
  const { error } = await adminSupabase
    .from("doctor_location_assignments")
    .upsert({
      doctor_id: doctorId,
      clinic_location_id: locationId,
      organization_id: org.id,
      is_active: true,
    }, { onConflict: "doctor_id,clinic_location_id" });

  if (error) return { error: error.message };

  revalidatePath("/doctor-dashboard/organization/locations");
  return { error: null };
}

export async function removeDoctorFromLocation(doctorId: string, locationId: string) {
  const { error: authError, org } = await requireOrgMember(["owner", "admin"]);
  if (authError || !org) return { error: authError };

  const adminSupabase = createAdminClient();

  const { error } = await adminSupabase
    .from("doctor_location_assignments")
    .update({ is_active: false })
    .eq("doctor_id", doctorId)
    .eq("clinic_location_id", locationId)
    .eq("organization_id", org.id);

  if (error) return { error: error.message };

  revalidatePath("/doctor-dashboard/organization/locations");
  return { error: null };
}

export async function setDoctorLocations(doctorId: string, locationIds: string[]) {
  const { error: authError, org } = await requireOrgMember(["owner", "admin"]);
  if (authError || !org) return { error: authError };

  const adminSupabase = createAdminClient();

  // Deactivate all current assignments for this doctor in this org
  await adminSupabase
    .from("doctor_location_assignments")
    .update({ is_active: false })
    .eq("doctor_id", doctorId)
    .eq("organization_id", org.id);

  // Re-assign selected locations
  if (locationIds.length > 0) {
    const rows = locationIds.map((lid) => ({
      doctor_id: doctorId,
      clinic_location_id: lid,
      organization_id: org.id,
      is_active: true,
    }));
    const { error } = await adminSupabase
      .from("doctor_location_assignments")
      .upsert(rows, { onConflict: "doctor_id,clinic_location_id" });
    if (error) return { error: error.message };
  }

  revalidatePath("/doctor-dashboard/organization/locations");
  return { error: null };
}

// ─── Public fetch (no auth needed) ───────────────────────────

export async function getPublicClinicLocations(organizationId: string) {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("clinic_locations")
    .select(`
      *,
      doctor_location_assignments(
        doctor_id,
        doctor:doctors(
          id, slug, consultation_fee_cents,
          profile:profiles(first_name, last_name, avatar_url),
          specialties:doctor_specialties(specialty:specialties(name_key, slug))
        )
      )
    `)
    .eq("organization_id", organizationId)
    .eq("is_active", true)
    .order("is_primary", { ascending: false })
    .order("created_at", { ascending: true });

  if (error) return { error: error.message, locations: [] };
  return { error: null, locations: data ?? [] };
}
