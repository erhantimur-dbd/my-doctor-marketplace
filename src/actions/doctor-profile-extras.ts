"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { revalidatePath } from "next/cache";
import { filterValidInsurers } from "@/lib/constants/insurers";
import { isValidGender, type DoctorGender } from "@/lib/constants/gender";
import { log } from "@/lib/utils/logger";

async function getOwnDoctor() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" as const, supabase, doctor: null };

  const { data: doctor } = await supabase
    .from("doctors")
    .select("id, slug, profile_id, profile_video_path, profile_video_status")
    .eq("profile_id", user.id)
    .single();

  if (!doctor) return { error: "Doctor profile not found" as const, supabase, doctor: null };
  return { error: null, supabase, doctor, userId: user.id };
}

/** Update accepted insurers (allowed even when verified). */
export async function updateAcceptedInsurers(insurers: string[]) {
  const { error, supabase, doctor } = await getOwnDoctor();
  if (error || !doctor) return { error: error || "Not found" };

  const cleaned = filterValidInsurers(insurers);
  const { error: updateError } = await supabase
    .from("doctors")
    .update({ accepted_insurers: cleaned })
    .eq("id", doctor.id);

  if (updateError) return { error: updateError.message };

  revalidatePath(`/doctors/${doctor.slug}`);
  revalidatePath("/doctor-dashboard/profile");
  return { error: null, accepted_insurers: cleaned };
}

/** Update gender (allowed even when verified). */
export async function updateDoctorGender(gender: string | null) {
  const { error, supabase, doctor } = await getOwnDoctor();
  if (error || !doctor) return { error: error || "Not found" };

  if (gender !== null && !isValidGender(gender)) {
    return { error: "Invalid gender value" };
  }

  const { error: updateError } = await supabase
    .from("doctors")
    .update({ gender: gender as DoctorGender | null })
    .eq("id", doctor.id);

  if (updateError) return { error: updateError.message };

  revalidatePath(`/doctors/${doctor.slug}`);
  revalidatePath("/doctor-dashboard/profile");
  return { error: null };
}

/**
 * Register an uploaded profile video path and mark it pending approval.
 * Public profile only shows video when status === 'approved'.
 */
export async function submitProfileVideo(storagePath: string) {
  const { error, supabase, doctor } = await getOwnDoctor();
  if (error || !doctor) return { error: error || "Not found" };

  if (!storagePath || !storagePath.includes(doctor.id)) {
    return { error: "Invalid video path" };
  }

  const { error: updateError } = await supabase
    .from("doctors")
    .update({
      profile_video_path: storagePath,
      profile_video_status: "pending",
      profile_video_uploaded_at: new Date().toISOString(),
      profile_video_reviewed_at: null,
      profile_video_reviewed_by: null,
      profile_video_rejection_reason: null,
    })
    .eq("id", doctor.id);

  if (updateError) return { error: updateError.message };

  revalidatePath("/doctor-dashboard/profile");
  return { error: null, status: "pending" as const };
}

/** Doctor removes their profile video (any status). */
export async function removeProfileVideo() {
  const { error, supabase, doctor } = await getOwnDoctor();
  if (error || !doctor) return { error: error || "Not found" };

  const { error: updateError } = await supabase
    .from("doctors")
    .update({
      profile_video_path: null,
      profile_video_status: null,
      profile_video_uploaded_at: null,
      profile_video_reviewed_at: null,
      profile_video_reviewed_by: null,
      profile_video_rejection_reason: null,
    })
    .eq("id", doctor.id);

  if (updateError) return { error: updateError.message };

  revalidatePath(`/doctors/${doctor.slug}`);
  revalidatePath("/doctor-dashboard/profile");
  return { error: null };
}

// ── FAQs ─────────────────────────────────────────────────────

export async function listOwnFaqs() {
  const { error, supabase, doctor } = await getOwnDoctor();
  if (error || !doctor) return { error: error || "Not found", faqs: [] };

  const { data, error: qErr } = await supabase
    .from("doctor_faqs")
    .select("*")
    .eq("doctor_id", doctor.id)
    .order("display_order", { ascending: true });

  if (qErr) return { error: qErr.message, faqs: [] };
  return { error: null, faqs: data || [] };
}

export async function upsertDoctorFaq(input: {
  id?: string;
  question: string;
  answer: string;
  display_order?: number;
  is_active?: boolean;
}) {
  const { error, supabase, doctor } = await getOwnDoctor();
  if (error || !doctor) return { error: error || "Not found" };

  const question = input.question.trim();
  const answer = input.answer.trim();
  if (!question || !answer) return { error: "Question and answer are required" };
  if (question.length > 300) return { error: "Question too long (max 300)" };
  if (answer.length > 2000) return { error: "Answer too long (max 2000)" };

  if (input.id) {
    const { error: uErr } = await supabase
      .from("doctor_faqs")
      .update({
        question,
        answer,
        display_order: input.display_order ?? 0,
        is_active: input.is_active ?? true,
      })
      .eq("id", input.id)
      .eq("doctor_id", doctor.id);
    if (uErr) return { error: uErr.message };
  } else {
    const { count } = await supabase
      .from("doctor_faqs")
      .select("id", { count: "exact", head: true })
      .eq("doctor_id", doctor.id);
    if ((count ?? 0) >= 12) return { error: "Maximum 12 FAQs per profile" };

    const { error: iErr } = await supabase.from("doctor_faqs").insert({
      doctor_id: doctor.id,
      question,
      answer,
      display_order: input.display_order ?? count ?? 0,
      is_active: input.is_active ?? true,
    });
    if (iErr) return { error: iErr.message };
  }

  revalidatePath(`/doctors/${doctor.slug}`);
  revalidatePath("/doctor-dashboard/profile");
  return { error: null };
}

export async function deleteDoctorFaq(faqId: string) {
  const { error, supabase, doctor } = await getOwnDoctor();
  if (error || !doctor) return { error: error || "Not found" };

  const { error: dErr } = await supabase
    .from("doctor_faqs")
    .delete()
    .eq("id", faqId)
    .eq("doctor_id", doctor.id);

  if (dErr) return { error: dErr.message };

  revalidatePath(`/doctors/${doctor.slug}`);
  revalidatePath("/doctor-dashboard/profile");
  return { error: null };
}

// ── Admin video moderation ───────────────────────────────────

export async function adminListPendingVideos() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated", videos: [] };

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();
  if (profile?.role !== "admin") return { error: "Forbidden", videos: [] };

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("doctors")
    .select(
      `id, slug, profile_video_path, profile_video_status, profile_video_uploaded_at,
       profile:profiles!doctors_profile_id_fkey(first_name, last_name, email)`
    )
    .eq("profile_video_status", "pending")
    .order("profile_video_uploaded_at", { ascending: true });

  if (error) {
    log.error("[adminListPendingVideos]", { err: error });
    return { error: error.message, videos: [] };
  }
  return { error: null, videos: data || [] };
}

export async function adminModerateProfileVideo(
  doctorId: string,
  decision: "approved" | "rejected",
  rejectionReason?: string
) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();
  if (profile?.role !== "admin") return { error: "Forbidden" };

  if (decision === "rejected" && !rejectionReason?.trim()) {
    return { error: "Rejection reason is required" };
  }

  const admin = createAdminClient();
  const { data: doctor, error: fetchErr } = await admin
    .from("doctors")
    .select("id, slug, profile_video_status")
    .eq("id", doctorId)
    .single();

  if (fetchErr || !doctor) return { error: "Doctor not found" };
  if (doctor.profile_video_status !== "pending") {
    return { error: "Video is not pending review" };
  }

  const { error: updateError } = await admin
    .from("doctors")
    .update({
      profile_video_status: decision,
      profile_video_reviewed_at: new Date().toISOString(),
      profile_video_reviewed_by: user.id,
      profile_video_rejection_reason:
        decision === "rejected" ? rejectionReason!.trim() : null,
    })
    .eq("id", doctorId);

  if (updateError) return { error: updateError.message };

  revalidatePath(`/doctors/${doctor.slug}`);
  revalidatePath("/admin/video-approvals");
  return { error: null };
}
