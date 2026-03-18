"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { log } from "@/lib/utils/logger";

/**
 * Submit a satisfaction survey (token-based, no auth required).
 */
export async function submitSurvey(
  token: string,
  data: {
    nps_score: number;
    would_recommend: boolean;
    feedback_text?: string;
  }
) {
  if (!token) return { error: "Invalid survey link." };
  if (data.nps_score < 0 || data.nps_score > 10) {
    return { error: "NPS score must be between 0 and 10." };
  }

  const adminClient = createAdminClient();

  // Find the survey by token
  const { data: survey, error: fetchError } = await adminClient
    .from("satisfaction_surveys")
    .select("id, submitted_at")
    .eq("token", token)
    .single();

  if (fetchError || !survey) {
    return { error: "Survey not found or link has expired." };
  }

  if (survey.submitted_at) {
    return { error: "This survey has already been submitted. Thank you!" };
  }

  // Update with the response
  const { error: updateError } = await adminClient
    .from("satisfaction_surveys")
    .update({
      nps_score: data.nps_score,
      would_recommend: data.would_recommend,
      feedback_text: data.feedback_text || null,
      submitted_at: new Date().toISOString(),
    })
    .eq("id", survey.id);

  if (updateError) {
    log.error("Survey submission failed", { err: updateError, surveyId: survey.id });
    return { error: "Failed to submit survey. Please try again." };
  }

  return { success: true };
}

/**
 * Get survey by token (for the public survey page).
 */
export async function getSurveyByToken(token: string) {
  if (!token) return { error: "Invalid token." };

  const adminClient = createAdminClient();

  const { data: survey, error } = await adminClient
    .from("satisfaction_surveys")
    .select(
      `id, token, submitted_at, nps_score,
       booking:bookings!satisfaction_surveys_booking_id_fkey(
         appointment_date,
         doctor:doctors!inner(
           profile:profiles!doctors_profile_id_fkey(first_name, last_name)
         )
       )`
    )
    .eq("token", token)
    .single();

  if (error || !survey) {
    return { error: "Survey not found." };
  }

  const booking: any = Array.isArray(survey.booking) ? survey.booking[0] : survey.booking;
  const doctor: any = booking?.doctor;
  const doctorProfile: any = doctor?.profile
    ? (Array.isArray(doctor.profile) ? doctor.profile[0] : doctor.profile)
    : null;

  return {
    survey: {
      id: survey.id,
      token: survey.token,
      submitted: !!survey.submitted_at,
      doctorName: doctorProfile
        ? `${doctorProfile.first_name} ${doctorProfile.last_name}`
        : "your doctor",
      appointmentDate: booking?.appointment_date || "",
    },
  };
}
