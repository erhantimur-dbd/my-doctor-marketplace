"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { revalidatePath } from "next/cache";
import {
  requestRescheduleSchema,
  respondRescheduleSchema,
  type RequestRescheduleInput,
  type RespondRescheduleInput,
} from "@/lib/validators/reschedule";
import { createNotification } from "@/lib/notifications";
import { sendEmail } from "@/lib/email/client";
import { rescheduleRequestEmail, rescheduleResponseEmail } from "@/lib/email/templates";
import { log } from "@/lib/utils/logger";

// ── Patient requests a reschedule ───────────────────────────────────

export async function requestReschedule(input: RequestRescheduleInput) {
  const parsed = requestRescheduleSchema.safeParse(input);
  if (!parsed.success) {
    return { error: "Invalid reschedule data." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { error: "You must be logged in." };

  // Fetch booking
  const { data: booking, error: bookingErr } = await supabase
    .from("bookings")
    .select(
      `id, patient_id, doctor_id, appointment_date, start_time, end_time, status,
       doctor:doctors!inner(
         profile:profiles!doctors_profile_id_fkey(first_name, last_name, email)
       )`
    )
    .eq("id", parsed.data.booking_id)
    .single();

  if (bookingErr || !booking) return { error: "Booking not found." };
  if (booking.patient_id !== user.id) return { error: "Not your booking." };

  // Only allow rescheduling confirmed/approved bookings
  if (!["confirmed", "approved"].includes(booking.status)) {
    return { error: "This booking cannot be rescheduled in its current state." };
  }

  // Check for existing pending reschedule
  const { data: existing } = await supabase
    .from("reschedule_requests")
    .select("id")
    .eq("booking_id", booking.id)
    .eq("status", "pending")
    .maybeSingle();

  if (existing) {
    return { error: "A reschedule request is already pending for this booking." };
  }

  // Extract original times (strip seconds if stored as HH:MM:SS)
  const origDate = booking.appointment_date;
  const origStart = typeof booking.start_time === "string"
    ? booking.start_time.substring(0, 5)
    : booking.start_time;
  const origEnd = typeof booking.end_time === "string"
    ? booking.end_time.substring(0, 5)
    : booking.end_time;

  const admin = createAdminClient();
  const { error: insertErr } = await admin
    .from("reschedule_requests")
    .insert({
      booking_id: booking.id,
      requested_by: user.id,
      original_date: origDate,
      original_start_time: origStart,
      original_end_time: origEnd,
      new_date: parsed.data.new_date,
      new_start_time: parsed.data.new_start_time,
      new_end_time: parsed.data.new_end_time,
      status: "pending",
    });

  if (insertErr) {
    log.error("[Reschedule] Insert error:", { err: insertErr });
    return { error: "Failed to create reschedule request." };
  }

  // Notify the doctor
  const doctor: any = Array.isArray(booking.doctor) ? booking.doctor[0] : booking.doctor;
  const doctorProfile: any = doctor?.profile
    ? (Array.isArray(doctor.profile) ? doctor.profile[0] : doctor.profile)
    : null;

  if (doctorProfile?.email) {
    // Get patient name
    const { data: patientProfile } = await supabase
      .from("profiles")
      .select("first_name, last_name")
      .eq("id", user.id)
      .single();

    const patientName = patientProfile
      ? `${patientProfile.first_name} ${patientProfile.last_name}`
      : "A patient";

    // Build reschedule email
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://mydoctors360.com";
    const { subject: emailSubject, html: emailHtml } = rescheduleRequestEmail({
      doctorName: `${doctorProfile.first_name} ${doctorProfile.last_name}`,
      patientName,
      originalDate: origDate,
      originalTime: origStart,
      newDate: parsed.data.new_date,
      newTime: parsed.data.new_start_time,
      dashboardUrl: `${appUrl}/en/doctor-dashboard/bookings`,
    });

    // Send notification with proper email template
    try {
      await createNotification({
        userId: doctorProfile.email === user.email ? user.id : booking.doctor_id,
        type: "reschedule_request",
        title: "Reschedule Request",
        message: `${patientName} has requested to reschedule their appointment from ${origDate} to ${parsed.data.new_date}.`,
        channels: ["in_app", "email"],
        metadata: {
          bookingId: booking.id,
          newDate: parsed.data.new_date,
          newStartTime: parsed.data.new_start_time,
        },
        email: { to: doctorProfile.email, subject: emailSubject, html: emailHtml },
      });
    } catch (err) {
      log.error("[Reschedule] Notification error:", { err: err });
    }
  }

  revalidatePath("/", "layout");
  return { success: true };
}

// ── Doctor approves or rejects a reschedule ─────────────────────────

export async function respondToReschedule(input: RespondRescheduleInput) {
  const parsed = respondRescheduleSchema.safeParse(input);
  if (!parsed.success) {
    return { error: "Invalid response data." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { error: "You must be logged in." };

  // Fetch the reschedule request with booking info
  const admin = createAdminClient();
  const { data: request, error: reqErr } = await admin
    .from("reschedule_requests")
    .select(
      `*, booking:bookings!inner(
        id, patient_id, doctor_id, appointment_date, start_time, end_time
      )`
    )
    .eq("id", parsed.data.reschedule_id)
    .eq("status", "pending")
    .single();

  if (reqErr || !request) {
    return { error: "Reschedule request not found or already processed." };
  }

  const bookingData: any = Array.isArray(request.booking)
    ? request.booking[0]
    : request.booking;

  // Verify the user is the doctor for this booking
  const { data: doctorRecord } = await supabase
    .from("doctors")
    .select("id")
    .eq("profile_id", user.id)
    .eq("id", bookingData.doctor_id)
    .single();

  if (!doctorRecord) {
    return { error: "You are not authorized to respond to this request." };
  }

  // Fetch patient profile and doctor name for emails
  const { data: patientProfile } = await admin
    .from("profiles")
    .select("first_name, last_name, email")
    .eq("id", bookingData.patient_id)
    .single();

  const { data: doctorProfile } = await admin
    .from("profiles")
    .select("first_name, last_name")
    .eq("id", user.id)
    .single();

  const patientName = patientProfile
    ? `${patientProfile.first_name} ${patientProfile.last_name}`
    : "Patient";
  const doctorName = doctorProfile
    ? `${doctorProfile.first_name} ${doctorProfile.last_name}`
    : "your doctor";
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://mydoctors360.com";

  if (parsed.data.action === "approve") {
    // Update booking with new date/time
    const { error: updateBookingErr } = await admin
      .from("bookings")
      .update({
        appointment_date: request.new_date,
        start_time: request.new_start_time,
        end_time: request.new_end_time,
      })
      .eq("id", bookingData.id);

    if (updateBookingErr) {
      log.error("[Reschedule] Booking update error:", { err: updateBookingErr });
      return { error: "Failed to update booking." };
    }

    // Mark request as approved
    await admin
      .from("reschedule_requests")
      .update({ status: "approved", responded_at: new Date().toISOString() })
      .eq("id", request.id);

    // Build approval email
    const { subject: emailSubject, html: emailHtml } = rescheduleResponseEmail({
      patientName: patientProfile?.first_name || "there",
      doctorName,
      approved: true,
      newDate: request.new_date,
      newTime: request.new_start_time,
      originalDate: request.original_date,
      originalTime: request.original_start_time,
      dashboardUrl: `${appUrl}/en/dashboard/bookings`,
    });

    // Notify patient
    try {
      await createNotification({
        userId: bookingData.patient_id,
        type: "reschedule_approved",
        title: "Reschedule Approved",
        message: `Your appointment has been rescheduled to ${request.new_date} at ${request.new_start_time}.`,
        channels: ["in_app", "email"],
        metadata: {
          bookingId: bookingData.id,
          newDate: request.new_date,
          newStartTime: request.new_start_time,
        },
        email: patientProfile?.email
          ? { to: patientProfile.email, subject: emailSubject, html: emailHtml }
          : undefined,
      });
    } catch (err) {
      log.error("[Reschedule] Notification error:", { err: err });
    }
  } else {
    // Reject
    await admin
      .from("reschedule_requests")
      .update({
        status: "rejected",
        rejection_reason: parsed.data.rejection_reason || null,
        responded_at: new Date().toISOString(),
      })
      .eq("id", request.id);

    // Build rejection email
    const { subject: emailSubject, html: emailHtml } = rescheduleResponseEmail({
      patientName: patientProfile?.first_name || "there",
      doctorName,
      approved: false,
      originalDate: request.original_date,
      originalTime: request.original_start_time,
      rejectionReason: parsed.data.rejection_reason || undefined,
      dashboardUrl: `${appUrl}/en/dashboard/bookings`,
    });

    // Notify patient
    try {
      await createNotification({
        userId: bookingData.patient_id,
        type: "reschedule_rejected",
        title: "Reschedule Declined",
        message: parsed.data.rejection_reason
          ? `Your reschedule request was declined: ${parsed.data.rejection_reason}`
          : "Your reschedule request was declined. Your original appointment remains unchanged.",
        channels: ["in_app", "email"],
        metadata: { bookingId: bookingData.id },
        email: patientProfile?.email
          ? { to: patientProfile.email, subject: emailSubject, html: emailHtml }
          : undefined,
      });
    } catch (err) {
      log.error("[Reschedule] Notification error:", { err: err });
    }
  }

  revalidatePath("/", "layout");
  return { success: true, action: parsed.data.action };
}

// ── Get pending reschedule for a booking ────────────────────────────

export async function getPendingReschedule(bookingId: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("reschedule_requests")
    .select("*")
    .eq("booking_id", bookingId)
    .eq("status", "pending")
    .maybeSingle();

  return data;
}
