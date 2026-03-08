"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

async function requireDoctorWithAddon() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated", supabase: null, doctor: null };

  const { data: doctor } = await supabase
    .from("doctors")
    .select("id, has_testing_addon")
    .eq("profile_id", user.id)
    .single();

  if (!doctor) return { error: "Not a doctor", supabase: null, doctor: null };
  if (!doctor.has_testing_addon)
    return { error: "Medical testing add-on not active", supabase: null, doctor: null };

  return { error: null, supabase, doctor };
}

export interface TestingLocation {
  id: string;
  doctor_id: string;
  name: string;
  address: string;
  city: string;
  country_code: string;
  postal_code: string | null;
  latitude: number | null;
  longitude: number | null;
  phone: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export async function getTestingLocations(): Promise<{
  locations: TestingLocation[];
  error?: string;
}> {
  try {
    const { error: authError, supabase, doctor } = await requireDoctorWithAddon();
    if (authError || !supabase || !doctor) {
      return { locations: [], error: authError || "Authentication failed" };
    }

    const { data, error } = await supabase
      .from("doctor_testing_locations")
      .select("*")
      .eq("doctor_id", doctor.id)
      .order("created_at");

    if (error) {
      console.error("getTestingLocations error:", error);
      return { locations: [], error: "Failed to fetch testing locations." };
    }

    return { locations: (data || []) as TestingLocation[] };
  } catch (err) {
    console.error("getTestingLocations error:", err);
    return { locations: [], error: "An unexpected error occurred." };
  }
}

export async function saveTestingLocation(input: {
  id?: string;
  name: string;
  address: string;
  city: string;
  country_code: string;
  postal_code?: string;
  phone?: string;
}): Promise<{ success?: boolean; error?: string }> {
  try {
    const { error: authError, supabase, doctor } = await requireDoctorWithAddon();
    if (authError || !supabase || !doctor) {
      return { error: authError || "Authentication failed" };
    }

    if (!input.name.trim() || !input.address.trim() || !input.city.trim()) {
      return { error: "Name, address, and city are required." };
    }

    if (input.id) {
      // Update existing
      const { error } = await supabase
        .from("doctor_testing_locations")
        .update({
          name: input.name.trim(),
          address: input.address.trim(),
          city: input.city.trim(),
          country_code: input.country_code,
          postal_code: input.postal_code?.trim() || null,
          phone: input.phone?.trim() || null,
        })
        .eq("id", input.id)
        .eq("doctor_id", doctor.id);

      if (error) {
        console.error("updateTestingLocation error:", error);
        return { error: "Failed to update location." };
      }
    } else {
      // Insert new
      const { error } = await supabase.from("doctor_testing_locations").insert({
        doctor_id: doctor.id,
        name: input.name.trim(),
        address: input.address.trim(),
        city: input.city.trim(),
        country_code: input.country_code,
        postal_code: input.postal_code?.trim() || null,
        phone: input.phone?.trim() || null,
      });

      if (error) {
        console.error("saveTestingLocation error:", error);
        return { error: "Failed to save location." };
      }
    }

    revalidatePath("/", "layout");
    return { success: true };
  } catch (err) {
    console.error("saveTestingLocation error:", err);
    return { error: "An unexpected error occurred." };
  }
}

export async function deleteTestingLocation(
  locationId: string
): Promise<{ success?: boolean; error?: string }> {
  try {
    const { error: authError, supabase, doctor } = await requireDoctorWithAddon();
    if (authError || !supabase || !doctor) {
      return { error: authError || "Authentication failed" };
    }

    const { error } = await supabase
      .from("doctor_testing_locations")
      .delete()
      .eq("id", locationId)
      .eq("doctor_id", doctor.id);

    if (error) {
      console.error("deleteTestingLocation error:", error);
      return { error: "Failed to delete location." };
    }

    revalidatePath("/", "layout");
    return { success: true };
  } catch (err) {
    console.error("deleteTestingLocation error:", err);
    return { error: "An unexpected error occurred." };
  }
}

export async function toggleTestingLocation(
  locationId: string,
  isActive: boolean
): Promise<{ success?: boolean; error?: string }> {
  try {
    const { error: authError, supabase, doctor } = await requireDoctorWithAddon();
    if (authError || !supabase || !doctor) {
      return { error: authError || "Authentication failed" };
    }

    const { error } = await supabase
      .from("doctor_testing_locations")
      .update({ is_active: isActive })
      .eq("id", locationId)
      .eq("doctor_id", doctor.id);

    if (error) {
      console.error("toggleTestingLocation error:", error);
      return { error: "Failed to update location." };
    }

    revalidatePath("/", "layout");
    return { success: true };
  } catch (err) {
    console.error("toggleTestingLocation error:", err);
    return { error: "An unexpected error occurred." };
  }
}
