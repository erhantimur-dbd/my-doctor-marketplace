"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import {
  doctorServiceSchema,
  type DoctorServiceInput,
} from "@/lib/validators/booking";
import type { DoctorService } from "@/types";

async function requireDoctor() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated", supabase: null, doctor: null };

  const { data: doctor } = await supabase
    .from("doctors")
    .select("id")
    .eq("profile_id", user.id)
    .single();

  if (!doctor) return { error: "Not a doctor", supabase: null, doctor: null };
  return { error: null, supabase, doctor };
}

export async function getDoctorServices(
  doctorId: string
): Promise<{ services: DoctorService[]; error?: string }> {
  try {
    const supabase = await createClient();

    const { data, error } = await supabase
      .from("doctor_services")
      .select("*")
      .eq("doctor_id", doctorId)
      .eq("is_active", true)
      .order("display_order", { ascending: true })
      .order("created_at", { ascending: true });

    if (error) {
      console.error("getDoctorServices error:", error);
      return { services: [], error: "Failed to fetch services." };
    }

    return { services: (data as DoctorService[]) || [] };
  } catch (err) {
    console.error("getDoctorServices error:", err);
    return { services: [], error: "Failed to fetch services." };
  }
}

export async function createDoctorService(
  input: DoctorServiceInput
): Promise<{ service?: DoctorService; error?: string }> {
  try {
    const { error: authError, supabase, doctor } = await requireDoctor();
    if (authError || !supabase || !doctor) {
      return { error: authError || "Authentication failed" };
    }

    const parsed = doctorServiceSchema.safeParse(input);
    if (!parsed.success) {
      return { error: "Invalid service data." };
    }

    const { data, error } = await supabase
      .from("doctor_services")
      .insert({
        doctor_id: doctor.id,
        name: parsed.data.name,
        description: parsed.data.description || null,
        price_cents: parsed.data.price_cents,
        duration_minutes: parsed.data.duration_minutes,
        consultation_type: parsed.data.consultation_type,
        is_active: parsed.data.is_active ?? true,
        display_order: parsed.data.display_order ?? 0,
      })
      .select("*")
      .single();

    if (error) {
      console.error("createDoctorService error:", error);
      return { error: "Failed to create service." };
    }

    revalidatePath("/", "layout");
    return { service: data as DoctorService };
  } catch (err) {
    console.error("createDoctorService error:", err);
    return { error: "Failed to create service." };
  }
}

export async function updateDoctorService(
  serviceId: string,
  input: DoctorServiceInput
): Promise<{ service?: DoctorService; error?: string }> {
  try {
    const { error: authError, supabase, doctor } = await requireDoctor();
    if (authError || !supabase || !doctor) {
      return { error: authError || "Authentication failed" };
    }

    const parsed = doctorServiceSchema.safeParse(input);
    if (!parsed.success) {
      return { error: "Invalid service data." };
    }

    const { data, error } = await supabase
      .from("doctor_services")
      .update({
        name: parsed.data.name,
        description: parsed.data.description || null,
        price_cents: parsed.data.price_cents,
        duration_minutes: parsed.data.duration_minutes,
        consultation_type: parsed.data.consultation_type,
        is_active: parsed.data.is_active ?? true,
        display_order: parsed.data.display_order ?? 0,
      })
      .eq("id", serviceId)
      .eq("doctor_id", doctor.id)
      .select("*")
      .single();

    if (error) {
      console.error("updateDoctorService error:", error);
      return { error: "Failed to update service." };
    }

    revalidatePath("/", "layout");
    return { service: data as DoctorService };
  } catch (err) {
    console.error("updateDoctorService error:", err);
    return { error: "Failed to update service." };
  }
}

export async function deleteDoctorService(
  serviceId: string
): Promise<{ success?: boolean; error?: string }> {
  try {
    const { error: authError, supabase, doctor } = await requireDoctor();
    if (authError || !supabase || !doctor) {
      return { error: authError || "Authentication failed" };
    }

    // Soft-delete: set is_active = false
    const { error } = await supabase
      .from("doctor_services")
      .update({ is_active: false })
      .eq("id", serviceId)
      .eq("doctor_id", doctor.id);

    if (error) {
      console.error("deleteDoctorService error:", error);
      return { error: "Failed to delete service." };
    }

    revalidatePath("/", "layout");
    return { success: true };
  } catch (err) {
    console.error("deleteDoctorService error:", err);
    return { error: "Failed to delete service." };
  }
}
