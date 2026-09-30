/**
 * Apply a successful Stripe Checkout payment to a treatment (care) plan.
 *
 * Handles both pay_full (first session via first_booking_id) and pay_per_visit
 * (subsequent sessions via booking_id). Session progress is derived from
 * confirmed bookings so webhook retries stay idempotent.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { ensureDailyVideoRoom } from "@/lib/booking/finalize-confirmed-booking";
import { persistBookingDestinationChargeIds } from "@/lib/stripe/destination-charge";
import {
  BOOKING_CURRENT_DOCTOR_INNER_EMBED,
  BOOKING_DOCTOR_PROFILE_EMBED,
} from "@/lib/patient/booking-doctor-embed";
import { statusForTreatmentPlanProgress } from "@/lib/treatment-plan/pricing";
import { exportBookingToGoogleCalendar } from "@/lib/google/sync";
import { exportBookingToMicrosoftCalendar } from "@/lib/microsoft/sync";
import { exportBookingToCalDAV } from "@/lib/caldav/sync";
import { sendEmail } from "@/lib/email/client";
import { resolvePatientConfirmationEmail } from "@/lib/email/softsmoke-send";
import { sendWhatsAppTemplate } from "@/lib/whatsapp/client";
import {
  TEMPLATE_BOOKING_CONFIRMATION,
  buildBookingConfirmationComponents,
  mapLocaleToWhatsApp,
} from "@/lib/whatsapp/templates";
import { formatCurrency } from "@/lib/utils/currency";
import { createNotification } from "@/lib/notifications";

export type TreatmentPlanCheckoutSession = {
  id: string;
  payment_intent?: string | { id?: string } | null;
  metadata?: {
    treatment_plan_id?: string;
    first_booking_id?: string;
    booking_id?: string;
    payment_type?: string;
  } | null;
};

function paymentIntentId(
  session: TreatmentPlanCheckoutSession
): string | null {
  const pi = session.payment_intent;
  if (!pi) return null;
  if (typeof pi === "string") return pi;
  return pi.id ?? null;
}

const COUNTED_SESSION_STATUSES = [
  "confirmed",
  "approved",
  "completed",
  "pending_approval",
];

export async function applyTreatmentPlanCheckoutPayment(
  session: TreatmentPlanCheckoutSession,
  supabase: SupabaseClient
): Promise<{ handled: boolean }> {
  const planId = session.metadata?.treatment_plan_id;
  if (!planId) {
    return { handled: false };
  }

  const firstBookingId = session.metadata?.first_booking_id || null;
  const bookingId = session.metadata?.booking_id || firstBookingId || null;
  const isPayFullFirst = Boolean(firstBookingId);
  const piId = paymentIntentId(session);

  const { data: plan } = await supabase
    .from("treatment_plans")
    .select(
      "id, status, sessions_completed, total_sessions, payment_type, patient_id, doctor_id, title, discounted_total_cents, platform_fee_per_session_cents, total_platform_fee_cents, currency, paid_at, token"
    )
    .eq("id", planId)
    .maybeSingle();

  if (!plan) {
    console.error("Treatment plan checkout: plan not found", planId);
    return { handled: true };
  }

  const wasSent = plan.status === "sent";
  const alreadyPaid = Boolean(plan.paid_at);

  if (bookingId) {
    await supabase
      .from("bookings")
      .update({
        status: "confirmed",
        stripe_payment_intent_id: piId,
        paid_at: new Date().toISOString(),
      })
      .eq("id", bookingId)
      .eq("status", "pending_payment");

    await persistBookingDestinationChargeIds({
      bookingId,
      paymentIntentId: piId,
      supabase,
    });
  }

  // Idempotent progress: count confirmed/active linked bookings.
  const { count: sessionCount } = await supabase
    .from("bookings")
    .select("id", { count: "exact", head: true })
    .eq("treatment_plan_id", planId)
    .in("status", COUNTED_SESSION_STATUSES);

  const sessionsCompleted = Math.min(
    plan.total_sessions,
    Math.max(sessionCount ?? 0, plan.sessions_completed ?? 0)
  );

  const nextStatus = statusForTreatmentPlanProgress({
    previousStatus: plan.status,
    sessionsCompleted,
    totalSessions: plan.total_sessions,
  });

  const planUpdate: Record<string, unknown> = {
    status: nextStatus,
    sessions_completed: sessionsCompleted,
    stripe_checkout_session_id: session.id,
    stripe_payment_intent_id: piId,
  };

  if (isPayFullFirst && !alreadyPaid) {
    planUpdate.paid_at = new Date().toISOString();
  }

  await supabase.from("treatment_plans").update(planUpdate).eq("id", planId);

  if (wasSent) {
    const { data: doctor } = await supabase
      .from("doctors")
      .select("profile_id")
      .eq("id", plan.doctor_id)
      .maybeSingle();

    if (doctor?.profile_id) {
      const { data: patient } = await supabase
        .from("profiles")
        .select("first_name, last_name")
        .eq("id", plan.patient_id)
        .maybeSingle();

      const patientName = patient
        ? `${patient.first_name} ${patient.last_name}`
        : "A patient";

      createNotification({
        userId: doctor.profile_id,
        type: "treatment_plan_accepted",
        title: "Care Plan Accepted",
        message: `${patientName} has accepted the care plan: ${plan.title}`,
        channels: ["in_app"],
        metadata: { treatment_plan_id: plan.id },
      }).catch((err) =>
        console.error("Treatment plan accepted notification error:", err)
      );
    }
  }

  if (!bookingId) {
    return { handled: true };
  }

  const { data: booking } = await supabase
    .from("bookings")
    .select(
      `
      id,
      booking_number,
      doctor_id,
      appointment_date,
      start_time,
      end_time,
      consultation_type,
      consultation_fee_cents,
      platform_fee_cents,
      total_amount_cents,
      currency,
      video_room_url,
      daily_room_name,
      patient:profiles!bookings_patient_id_fkey(first_name, last_name, email, phone, notification_whatsapp, preferred_locale),
      doctor:${BOOKING_CURRENT_DOCTOR_INNER_EMBED}(
        id,
        clinic_name,
        address,
        slug,
        profile:${BOOKING_DOCTOR_PROFILE_EMBED}(first_name, last_name, email)
      )
    `
    )
    .eq("id", bookingId)
    .single();

  if (!booking) {
    return { handled: true };
  }

  if (isPayFullFirst && !alreadyPaid) {
    const feeCents =
      plan.total_platform_fee_cents || plan.platform_fee_per_session_cents || 0;
    if (feeCents > 0) {
      await supabase.from("platform_fees").insert({
        booking_id: bookingId,
        doctor_id: booking.doctor_id,
        fee_type: "commission",
        amount_cents: feeCents,
        currency: plan.currency || booking.currency,
      });
    }
  } else if (!isPayFullFirst && (booking.platform_fee_cents || 0) > 0) {
    await supabase.from("platform_fees").insert({
      booking_id: bookingId,
      doctor_id: booking.doctor_id,
      fee_type: "commission",
      amount_cents: booking.platform_fee_cents,
      currency: booking.currency,
    });
  }

  exportBookingToGoogleCalendar(bookingId).catch((err) =>
    console.error("Google Calendar export error (treatment plan):", err)
  );
  exportBookingToMicrosoftCalendar(bookingId).catch((err) =>
    console.error("Microsoft Calendar export error (treatment plan):", err)
  );
  exportBookingToCalDAV(bookingId).catch((err) =>
    console.error("CalDAV export error (treatment plan):", err)
  );

  let videoRoomUrl: string | null = booking.video_room_url;
  if (booking.consultation_type === "video") {
    try {
      videoRoomUrl = await ensureDailyVideoRoom(
        {
          id: bookingId,
          bookingNumber: booking.booking_number,
          appointmentDate: booking.appointment_date,
          endTime: booking.end_time,
          consultationType: booking.consultation_type,
          videoRoomUrl: booking.video_room_url,
          dailyRoomName: booking.daily_room_name,
        },
        supabase
      );
    } catch (err) {
      console.error("Daily.co room creation error (treatment plan):", err);
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const patient: any = Array.isArray(booking.patient)
    ? booking.patient[0]
    : booking.patient;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const doctor: any = Array.isArray(booking.doctor)
    ? booking.doctor[0]
    : booking.doctor;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const doctorProfile: any = doctor?.profile
    ? Array.isArray(doctor.profile)
      ? doctor.profile[0]
      : doctor.profile
    : null;

  if (patient?.email && doctorProfile) {
    const consultationLabel =
      booking.consultation_type === "video"
        ? "Video Consultation"
        : "In-Person Consultation";

    const { subject, html } = resolvePatientConfirmationEmail({
      patientName: patient.first_name || "Patient",
      doctorName: `${doctorProfile.first_name} ${doctorProfile.last_name}`,
      date: booking.appointment_date,
      time: booking.start_time,
      end: booking.end_time,
      locale: patient.preferred_locale,
      consultationType: consultationLabel,
      bookingNumber: booking.booking_number,
      amount: booking.total_amount_cents / 100,
      currency: booking.currency.toUpperCase(),
      videoRoomUrl:
        booking.consultation_type === "video" ? videoRoomUrl : undefined,
      clinicName: doctor.clinic_name,
      address: doctor.address,
      bookingId: booking.id,
      doctor: {
        id: booking.doctor_id,
        slug: doctor.slug,
        email: doctorProfile.email,
      },
    });

    sendEmail({ to: patient.email, subject, html }).catch((err) =>
      console.error("Confirmation email error (treatment plan):", err)
    );

    if (patient.notification_whatsapp && patient.phone) {
      const dateFormatted = new Date(
        booking.appointment_date
      ).toLocaleDateString("en-GB", {
        weekday: "short",
        day: "numeric",
        month: "short",
      });

      sendWhatsAppTemplate({
        to: patient.phone,
        templateName: TEMPLATE_BOOKING_CONFIRMATION,
        languageCode: mapLocaleToWhatsApp(patient.preferred_locale),
        components: buildBookingConfirmationComponents({
          patientName: patient.first_name || "there",
          bookingNumber: booking.booking_number,
          date: dateFormatted,
          time: booking.start_time,
          doctorName: `${doctorProfile.first_name} ${doctorProfile.last_name}`,
          amount: formatCurrency(
            booking.total_amount_cents,
            booking.currency
          ),
        }),
      }).catch((err) =>
        console.error("WhatsApp confirmation error (treatment plan):", err)
      );
    }
  }

  return { handled: true };
}
