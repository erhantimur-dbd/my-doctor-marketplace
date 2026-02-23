"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

async function requireAdmin() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated", supabase: null, user: null };

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (profile?.role !== "admin")
    return { error: "Not authorized", supabase: null, user: null };

  return { error: null, supabase, user };
}

export async function updateDoctorVerification(
  doctorId: string,
  status: string
) {
  const { error: authError, supabase } = await requireAdmin();
  if (authError || !supabase) return { error: authError };

  const updateData: Record<string, unknown> = {
    verification_status: status,
  };
  if (status === "verified") {
    updateData.verified_at = new Date().toISOString();
  }

  const { error } = await supabase
    .from("doctors")
    .update(updateData)
    .eq("id", doctorId);

  if (error) return { error: error.message };

  revalidatePath("/admin/doctors");
  return { success: true };
}

export async function toggleDoctorActive(doctorId: string, isActive: boolean) {
  const { error: authError, supabase } = await requireAdmin();
  if (authError || !supabase) return { error: authError };

  const { error } = await supabase
    .from("doctors")
    .update({ is_active: isActive })
    .eq("id", doctorId);

  if (error) return { error: error.message };

  revalidatePath("/admin/doctors");
  return { success: true };
}

export async function toggleDoctorFeatured(
  doctorId: string,
  isFeatured: boolean
) {
  const { error: authError, supabase } = await requireAdmin();
  if (authError || !supabase) return { error: authError };

  const updateData: Record<string, unknown> = {
    is_featured: isFeatured,
  };
  if (isFeatured) {
    // Feature for 30 days
    const featuredUntil = new Date();
    featuredUntil.setDate(featuredUntil.getDate() + 30);
    updateData.featured_until = featuredUntil.toISOString();
  } else {
    updateData.featured_until = null;
  }

  const { error } = await supabase
    .from("doctors")
    .update(updateData)
    .eq("id", doctorId);

  if (error) return { error: error.message };

  revalidatePath("/admin/doctors");
  return { success: true };
}

export async function deleteReview(reviewId: string) {
  const { error: authError, supabase } = await requireAdmin();
  if (authError || !supabase) return { error: authError };

  const { error } = await supabase
    .from("reviews")
    .update({ is_visible: false })
    .eq("id", reviewId);

  if (error) return { error: error.message };

  revalidatePath("/admin/reviews");
  return { success: true };
}

export async function updatePlatformSetting(key: string, value: string) {
  const { error: authError, supabase } = await requireAdmin();
  if (authError || !supabase) return { error: authError };

  const { error } = await supabase
    .from("platform_settings")
    .upsert({ key, value, updated_at: new Date().toISOString() });

  if (error) return { error: error.message };

  revalidatePath("/admin/settings");
  return { success: true };
}
