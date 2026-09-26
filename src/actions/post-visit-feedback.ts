"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { safeError } from "@/lib/utils/safe-error";
import { readJoinedProfileEmail } from "@/lib/soft-launch/softsmoke-connect-bypass";
import { BOOKING_DOCTOR_PROFILE_EMBED } from "@/lib/patient/booking-doctor-embed";
import {
  parsePostVisitFeedbackSubmission,
  shouldPromptSoftsmokePlatformFeedback,
  submitIdentityMatchesSoftsmokeDoctor,
  toPlatformFeedbackRpcArgs,
  type PostVisitFeedbackInput,
} from "@/lib/feedback/post-visit";

/**
 * Save private Softsmoke platform feedback for one completed video visit.
 * Does not email, does not insert a public review, and does not touch
 * doctors.avg_rating.
 */
export async function submitPostVisitFeedback(input: PostVisitFeedbackInput) {
  const parsed = parsePostVisitFeedbackSubmission(input);
  if (!parsed.ok) return { error: parsed.error };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const { data: booking } = await supabase
    .from("bookings")
    .select("id, patient_id, doctor_id, status, consultation_type")
    .eq("id", parsed.value.bookingId)
    .eq("patient_id", user.id)
    .maybeSingle();

  if (!booking) return { error: "Booking not found." };

  if (
    !shouldPromptSoftsmokePlatformFeedback({
      id: booking.id,
      status: booking.status,
      consultationType: booking.consultation_type,
      doctorId: booking.doctor_id,
    })
  ) {
    return {
      error: "Platform feedback is only for a completed Softsmoke video visit.",
    };
  }

  const admin = createAdminClient();
  const { data: doctor } = await admin
    .from("doctors")
    .select(
      `id, slug, profile:${BOOKING_DOCTOR_PROFILE_EMBED}(email)`
    )
    .eq("id", booking.doctor_id)
    .maybeSingle();

  const profile = doctor
    ? Array.isArray(doctor.profile)
      ? doctor.profile[0]
      : doctor.profile
    : null;

  if (
    !doctor ||
    !submitIdentityMatchesSoftsmokeDoctor({
      id: doctor.id,
      slug: doctor.slug,
      email: readJoinedProfileEmail(profile),
    })
  ) {
    return {
      error: "Platform feedback is only for a completed Softsmoke video visit.",
    };
  }

  const { data, error } = await supabase.rpc(
    "submit_post_visit_platform_feedback",
    toPlatformFeedbackRpcArgs(parsed.value)
  );

  if (error || !data) {
    const message = error?.message ?? "";
    if (error?.code === "23505" || /duplicate key/i.test(message)) {
      return { error: "Feedback already submitted for this visit." };
    }
    return { error: safeError(error) };
  }

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/bookings");
  revalidatePath(`/dashboard/bookings/${booking.id}`);
  revalidatePath("/dashboard/reviews");
  revalidatePath("/doctor-dashboard");

  return { success: true as const };
}
