"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { revalidatePath } from "next/cache";
import {
  executeGpReassignmentRequest,
  acceptGpSlotOffer,
  declineAllGpOffers,
} from "@/lib/gp/reassign";
import { log } from "@/lib/utils/logger";

/**
 * Doctor: cannot attend a GP appointment → auto-reassign or patient offers.
 */
export async function doctorCantMakeGpAppointment(
  bookingId: string,
  reason?: string
) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return { error: "Not authenticated" };

    const admin = createAdminClient();
    const { data: doctor } = await admin
      .from("doctors")
      .select("id")
      .eq("profile_id", user.id)
      .single();

    if (!doctor) return { error: "Doctor profile not found" };

    const result = await executeGpReassignmentRequest({
      bookingId,
      requestingDoctorId: doctor.id,
      reason,
    });

    revalidatePath("/doctor-dashboard/bookings");
    revalidatePath("/dashboard/bookings");

    if (result.outcome === "error") {
      return { error: result.error };
    }
    if (result.outcome === "auto_reassigned") {
      return {
        success: true,
        outcome: result.outcome,
        message: `Reassigned to ${result.newDoctorName} at the same time. Payment moved to the new doctor.`,
      };
    }
    if (result.outcome === "pending_patient_choice") {
      return {
        success: true,
        outcome: result.outcome,
        message: `No GP free at the same time. Patient offered ${result.offerCount} alternative slot(s).`,
      };
    }
    return {
      success: true,
      outcome: result.outcome,
      message:
        "No replacement available. Booking cancelled and full refund issued to the patient.",
    };
  } catch (err) {
    log.error("doctorCantMakeGpAppointment", { err });
    return { error: "Unexpected error while reassigning" };
  }
}

export async function patientAcceptGpOffer(token: string) {
  const result = await acceptGpSlotOffer(token);
  revalidatePath("/dashboard/bookings");
  return result;
}

export async function patientDeclineGpOffers(token: string) {
  const result = await declineAllGpOffers("", token);
  revalidatePath("/dashboard/bookings");
  return result;
}

/**
 * Public read of offer details (for offer page).
 */
export async function getGpOfferByToken(token: string) {
  const admin = createAdminClient();
  const { data: offer } = await admin
    .from("gp_slot_offers")
    .select(
      `
      id, appointment_date, start_time, end_time, consultation_type, fee_cents,
      status, expires_at, token,
      doctor:doctors(slug, profile:profiles!doctors_profile_id_fkey(first_name, last_name)),
      booking:bookings(id, booking_number, currency, gp_reassignment_status, patient_id)
    `
    )
    .eq("token", token)
    .maybeSingle();

  if (!offer) return { error: "Offer not found" };
  return { offer };
}
