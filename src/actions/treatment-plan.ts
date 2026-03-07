"use server";

import crypto from "crypto";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getStripe } from "@/lib/stripe/client";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { BOOKING_STATUSES } from "@/lib/constants/booking-status";
import { getBookingFeeCents, formatCurrency } from "@/lib/utils/currency";
import { sendEmail } from "@/lib/email/client";
import { treatmentPlanEmail } from "@/lib/email/templates";
import { createNotification } from "@/lib/notifications";
import { exportBookingToGoogleCalendar } from "@/lib/google/sync";
import { exportBookingToMicrosoftCalendar } from "@/lib/microsoft/sync";
import { exportBookingToCalDAV } from "@/lib/caldav/sync";
import { createRoom } from "@/lib/daily/client";
import { bookingConfirmationEmail } from "@/lib/email/templates";

// ─── types ────────────────────────────────────────────────────

export interface CreateTreatmentPlanInput {
  patient_id: string;
  booking_id?: string;
  title: string;
  description?: string;
  custom_notes?: string;
  total_sessions: number;
  session_duration_minutes: number;
  consultation_type: "in_person" | "video";
  service_id?: string;
  custom_service_name?: string;
  custom_price_cents?: number;
  payment_type: "pay_full" | "pay_per_visit";
  discount_type?: "percentage" | "fixed_amount";
  discount_value?: number;
}

export interface BookTreatmentSessionInput {
  treatment_plan_id: string;
  appointment_date: string;
  start_time: string;
  end_time: string;
}

// ─── helpers ──────────────────────────────────────────────────

async function requireDoctor() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated", supabase: null, doctor: null };

  const { data: doctor } = await supabase
    .from("doctors")
    .select(
      "id, profile_id, stripe_account_id, stripe_onboarding_complete, base_currency, consultation_types, profile:profiles!doctors_profile_id_fkey(first_name, last_name, email)"
    )
    .eq("profile_id", user.id)
    .single();

  if (!doctor) return { error: "Not a doctor", supabase: null, doctor: null };
  return { error: null, supabase, doctor };
}

async function getOriginAndLocale() {
  const h = await headers();
  const host = h.get("x-forwarded-host") || h.get("host") || "";
  const proto = h.get("x-forwarded-proto") || "https";
  const origin = host
    ? `${proto}://${host}`
    : process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

  const referer = h.get("referer") || "";
  const localeMatch = referer.match(/\/(en|de|tr|fr|it|es|pt|zh|ja)(\/|$)/);
  const locale = localeMatch ? localeMatch[1] : "en";

  return { origin, locale };
}

function generateToken(): string {
  return crypto.randomBytes(32).toString("base64url");
}

// ─── actions ──────────────────────────────────────────────────

export async function createTreatmentPlan(
  input: CreateTreatmentPlanInput
): Promise<{ success?: boolean; plan_id?: string; error?: string }> {
  try {
    const { error: authError, supabase, doctor } = await requireDoctor();
    if (authError || !supabase || !doctor) {
      return { error: authError || "Authentication failed" };
    }

    // Doctor must have Stripe set up
    if (!doctor.stripe_account_id || !doctor.stripe_onboarding_complete) {
      return {
        error: "Please complete your payment setup before creating treatment plans.",
      };
    }

    // Validate required fields
    if (!input.title || !input.title.trim()) {
      return { error: "Treatment plan title is required." };
    }

    if (!input.total_sessions || input.total_sessions < 1 || input.total_sessions > 20) {
      return { error: "Total sessions must be between 1 and 20." };
    }

    if (![15, 30, 45, 60].includes(input.session_duration_minutes)) {
      return { error: "Session duration must be 15, 30, 45, or 60 minutes." };
    }

    if (!["in_person", "video"].includes(input.consultation_type)) {
      return { error: "Invalid consultation type." };
    }

    if (!["pay_full", "pay_per_visit"].includes(input.payment_type)) {
      return { error: "Invalid payment type." };
    }

    // Verify patient has prior booking with this doctor
    const { data: priorBookings } = await supabase
      .from("bookings")
      .select("id")
      .eq("doctor_id", doctor.id)
      .eq("patient_id", input.patient_id)
      .in("status", ["confirmed", "approved", "completed"])
      .limit(1);

    if (!priorBookings || priorBookings.length === 0) {
      return { error: "This patient has no prior bookings with you." };
    }

    // Resolve service details
    let serviceName: string;
    let unitPriceCents: number;
    let serviceId: string | null = null;
    let durationMinutes = input.session_duration_minutes;

    if (input.service_id) {
      const { data: service } = await supabase
        .from("doctor_services")
        .select("*")
        .eq("id", input.service_id)
        .eq("doctor_id", doctor.id)
        .single();

      if (!service || !service.is_active) {
        return { error: "Selected service is no longer available." };
      }

      serviceName = service.name;
      unitPriceCents = service.price_cents;
      durationMinutes = service.duration_minutes;
      serviceId = service.id;
    } else if (input.custom_service_name && input.custom_price_cents) {
      serviceName = input.custom_service_name;
      unitPriceCents = input.custom_price_cents;
    } else {
      return { error: "Either a service or custom name + price is required." };
    }

    // Calculate discount
    const totalSessions = input.total_sessions;
    const subtotalCents = unitPriceCents * totalSessions;
    let discountCents = 0;

    if (input.discount_type && input.discount_value && input.discount_value > 0) {
      if (input.discount_type === "percentage") {
        if (input.discount_value > 100) {
          return { error: "Percentage discount cannot exceed 100%." };
        }
        discountCents = Math.round((subtotalCents * input.discount_value) / 100);
      } else {
        discountCents = input.discount_value;
      }
    }

    const discountedTotalCents = Math.max(0, subtotalCents - discountCents);
    if (discountedTotalCents <= 0) {
      return { error: "Discount cannot make the total free. Please adjust." };
    }

    const platformFeePerSessionCents = getBookingFeeCents(doctor.base_currency);
    const totalPlatformFeeCents = platformFeePerSessionCents * totalSessions;

    // Generate secure token and set expiry
    const token = generateToken();
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 14); // 14 days from now

    // Insert treatment plan
    const { data: plan, error: insertError } = await supabase
      .from("treatment_plans")
      .insert({
        token,
        doctor_id: doctor.id,
        patient_id: input.patient_id,
        booking_id: input.booking_id || null,
        title: input.title.trim(),
        description: input.description || null,
        custom_notes: input.custom_notes || null,
        total_sessions: totalSessions,
        sessions_completed: 0,
        session_duration_minutes: durationMinutes,
        consultation_type: input.consultation_type,
        service_id: serviceId,
        service_name: serviceName,
        unit_price_cents: unitPriceCents,
        currency: doctor.base_currency,
        payment_type: input.payment_type,
        discount_type: input.discount_type || null,
        discount_value: input.discount_value || null,
        discounted_total_cents: discountedTotalCents,
        platform_fee_per_session_cents: platformFeePerSessionCents,
        total_platform_fee_cents: totalPlatformFeeCents,
        status: "sent",
        expires_at: expiresAt.toISOString(),
      })
      .select("id")
      .single();

    if (insertError || !plan) {
      console.error("Treatment plan insert error:", insertError);
      return { error: "Failed to create treatment plan. Please try again." };
    }

    // Fetch patient details for email
    const { data: patient } = await supabase
      .from("profiles")
      .select("first_name, last_name, email")
      .eq("id", input.patient_id)
      .single();

    if (patient?.email) {
      const { origin, locale } = await getOriginAndLocale();
      const profile: any = Array.isArray(doctor.profile)
        ? doctor.profile[0]
        : doctor.profile;
      const doctorName = `${profile.first_name} ${profile.last_name}`;

      const discountLabel =
        input.discount_type === "percentage"
          ? `${input.discount_value}%`
          : input.discount_value
            ? formatCurrency(input.discount_value, doctor.base_currency)
            : null;

      const { subject, html } = treatmentPlanEmail({
        patientName: patient.first_name || "Patient",
        doctorName,
        planTitle: input.title.trim(),
        description: input.description || null,
        totalSessions,
        unitPrice: formatCurrency(unitPriceCents, doctor.base_currency),
        discount: discountLabel,
        totalPrice: formatCurrency(discountedTotalCents, doctor.base_currency),
        paymentType: input.payment_type,
        doctorNote: input.custom_notes || null,
        planUrl: `${origin}/${locale}/treatment-plan/${token}`,
        expiresAt: expiresAt.toLocaleDateString("en-GB", {
          day: "numeric",
          month: "long",
          year: "numeric",
        }),
      });

      sendEmail({ to: patient.email, subject, html }).catch((err) =>
        console.error("Treatment plan email error:", err)
      );

      // In-app notification
      createNotification({
        userId: input.patient_id,
        type: "treatment_plan",
        title: "New Treatment Plan",
        message: `Dr. ${doctorName} has created a treatment plan for you: ${input.title.trim()}`,
        channels: ["in_app"],
        metadata: { treatment_plan_id: plan.id, token },
      }).catch((err) =>
        console.error("Treatment plan notification error:", err)
      );
    }

    revalidatePath("/", "layout");
    return { success: true, plan_id: plan.id };
  } catch (err) {
    console.error("createTreatmentPlan error:", err);
    return { error: "An unexpected error occurred. Please try again." };
  }
}

export async function getTreatmentPlanByToken(token: string) {
  try {
    const supabase = await createClient();

    const { data: plan, error } = await supabase
      .from("treatment_plans")
      .select(
        `
        *,
        doctor:doctors!inner(
          id,
          slug,
          clinic_name,
          address,
          consultation_types,
          profile:profiles!doctors_profile_id_fkey(first_name, last_name, avatar_url),
          location:locations(city, country_code),
          specialties:doctor_specialties(
            specialty:specialties(name_key),
            is_primary
          )
        )
      `
      )
      .eq("token", token)
      .single();

    if (error || !plan) {
      return { plan: null, error: "Treatment plan not found." };
    }

    // Lazy expiry: if sent and past expiration, mark as expired
    if (plan.status === "sent" && new Date(plan.expires_at) < new Date()) {
      await supabase
        .from("treatment_plans")
        .update({ status: "expired" })
        .eq("id", plan.id);
      plan.status = "expired";
    }

    return { plan, error: null };
  } catch (err) {
    console.error("getTreatmentPlanByToken error:", err);
    return { plan: null, error: "Failed to fetch treatment plan." };
  }
}

export async function acceptTreatmentPlanFull(
  planId: string,
  appointmentDate: string,
  startTime: string,
  endTime: string
): Promise<{ url?: string | null; error?: string }> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return { error: "You must be logged in to accept this treatment plan." };
    }

    // Fetch treatment plan
    const { data: plan, error: planError } = await supabase
      .from("treatment_plans")
      .select("*")
      .eq("id", planId)
      .single();

    if (planError || !plan) {
      return { error: "Treatment plan not found." };
    }

    if (plan.patient_id !== user.id) {
      return { error: "This treatment plan is not addressed to you." };
    }

    if (plan.status !== "sent") {
      return { error: "This treatment plan is no longer available." };
    }

    if (new Date(plan.expires_at) < new Date()) {
      await supabase
        .from("treatment_plans")
        .update({ status: "expired" })
        .eq("id", plan.id);
      return { error: "This treatment plan has expired." };
    }

    // Fetch doctor Stripe info
    const { data: doctor } = await supabase
      .from("doctors")
      .select(
        "id, slug, stripe_account_id, stripe_onboarding_complete, profile:profiles!doctors_profile_id_fkey(first_name, last_name)"
      )
      .eq("id", plan.doctor_id)
      .single();

    if (!doctor || !doctor.stripe_account_id || !doctor.stripe_onboarding_complete) {
      return { error: "Doctor payment setup is incomplete." };
    }

    // Create first booking with pending_payment status
    const { data: booking, error: bookingError } = await supabase
      .from("bookings")
      .insert({
        patient_id: user.id,
        doctor_id: plan.doctor_id,
        appointment_date: appointmentDate,
        start_time: startTime,
        end_time: endTime,
        consultation_type: plan.consultation_type,
        status: BOOKING_STATUSES.PENDING_PAYMENT,
        currency: plan.currency,
        consultation_fee_cents: plan.unit_price_cents,
        platform_fee_cents: plan.platform_fee_per_session_cents,
        total_amount_cents: plan.discounted_total_cents + plan.total_platform_fee_cents,
        service_id: plan.service_id,
        service_name: plan.service_name,
        treatment_plan_id: plan.id,
      })
      .select("id, booking_number")
      .single();

    if (bookingError || !booking) {
      console.error("Treatment plan booking insert error:", bookingError);
      return { error: "Failed to create booking. Please try again." };
    }

    // Create Stripe Checkout Session
    const { origin, locale } = await getOriginAndLocale();
    const profile: any = Array.isArray(doctor.profile)
      ? doctor.profile[0]
      : doctor.profile;
    const doctorName = `${profile.first_name} ${profile.last_name}`;

    const totalChargeCents = plan.discounted_total_cents + plan.total_platform_fee_cents;

    const session = await getStripe().checkout.sessions.create({
      mode: "payment",
      line_items: [
        {
          price_data: {
            currency: plan.currency.toLowerCase(),
            product_data: {
              name: `Treatment Plan: ${plan.title} (${plan.total_sessions} sessions) with Dr. ${doctorName}`,
              description: `First session: ${appointmentDate} at ${startTime}`,
            },
            unit_amount: totalChargeCents,
          },
          quantity: 1,
        },
      ],
      payment_intent_data: {
        application_fee_amount: plan.total_platform_fee_cents,
        transfer_data: {
          destination: doctor.stripe_account_id,
        },
      },
      metadata: {
        treatment_plan_id: planId,
        first_booking_id: booking.id,
        booking_number: booking.booking_number,
      },
      success_url: `${origin}/${locale}/treatment-plan/${plan.token}/confirmed?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/${locale}/treatment-plan/${plan.token}`,
    });

    return { url: session.url };
  } catch (err) {
    console.error("acceptTreatmentPlanFull error:", err);
    return { error: "An unexpected error occurred. Please try again." };
  }
}

export async function acceptTreatmentPlanPerVisit(
  planId: string
): Promise<{ success?: boolean; error?: string }> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return { error: "You must be logged in to accept this treatment plan." };
    }

    // Fetch treatment plan
    const { data: plan, error: planError } = await supabase
      .from("treatment_plans")
      .select("*")
      .eq("id", planId)
      .single();

    if (planError || !plan) {
      return { error: "Treatment plan not found." };
    }

    if (plan.patient_id !== user.id) {
      return { error: "This treatment plan is not addressed to you." };
    }

    if (plan.status !== "sent") {
      return { error: "This treatment plan is no longer available." };
    }

    if (new Date(plan.expires_at) < new Date()) {
      await supabase
        .from("treatment_plans")
        .update({ status: "expired" })
        .eq("id", plan.id);
      return { error: "This treatment plan has expired." };
    }

    // Update plan status to accepted
    const { error: updateError } = await supabase
      .from("treatment_plans")
      .update({ status: "accepted" })
      .eq("id", plan.id);

    if (updateError) {
      console.error("Treatment plan accept error:", updateError);
      return { error: "Failed to accept treatment plan. Please try again." };
    }

    // Notify doctor
    const { data: patient } = await supabase
      .from("profiles")
      .select("first_name, last_name")
      .eq("id", user.id)
      .single();

    const patientName = patient
      ? `${patient.first_name} ${patient.last_name}`
      : "A patient";

    createNotification({
      userId: plan.doctor_id,
      type: "treatment_plan_accepted",
      title: "Treatment Plan Accepted",
      message: `${patientName} has accepted the treatment plan: ${plan.title}`,
      channels: ["in_app"],
      metadata: { treatment_plan_id: plan.id },
    }).catch((err) =>
      console.error("Treatment plan accepted notification error:", err)
    );

    revalidatePath("/", "layout");
    return { success: true };
  } catch (err) {
    console.error("acceptTreatmentPlanPerVisit error:", err);
    return { error: "An unexpected error occurred. Please try again." };
  }
}

export async function bookTreatmentPlanSession(
  input: BookTreatmentSessionInput
): Promise<{ success?: boolean; url?: string | null; error?: string }> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return { error: "You must be logged in." };
    }

    // Fetch treatment plan
    const { data: plan, error: planError } = await supabase
      .from("treatment_plans")
      .select("*")
      .eq("id", input.treatment_plan_id)
      .single();

    if (planError || !plan) {
      return { error: "Treatment plan not found." };
    }

    if (plan.patient_id !== user.id) {
      return { error: "This treatment plan is not yours." };
    }

    if (!["accepted", "in_progress"].includes(plan.status)) {
      return { error: "This treatment plan is not active." };
    }

    if (plan.sessions_completed >= plan.total_sessions) {
      return { error: "All sessions have already been completed." };
    }

    // ─── Pay Full: booking is free (already paid as package) ───
    if (plan.payment_type === "pay_full") {
      const { data: booking, error: bookingError } = await supabase
        .from("bookings")
        .insert({
          patient_id: user.id,
          doctor_id: plan.doctor_id,
          appointment_date: input.appointment_date,
          start_time: input.start_time,
          end_time: input.end_time,
          consultation_type: plan.consultation_type,
          status: BOOKING_STATUSES.CONFIRMED,
          currency: plan.currency,
          consultation_fee_cents: plan.unit_price_cents,
          platform_fee_cents: plan.platform_fee_per_session_cents,
          total_amount_cents: 0, // Already paid as part of package
          service_id: plan.service_id,
          service_name: plan.service_name,
          treatment_plan_id: plan.id,
          paid_at: plan.paid_at,
        })
        .select(
          "id, booking_number, appointment_date, start_time, end_time, consultation_type"
        )
        .single();

      if (bookingError || !booking) {
        console.error("Treatment plan session booking error:", bookingError);
        return { error: "Failed to book session. Please try again." };
      }

      // Increment sessions_completed
      const newSessionsCompleted = plan.sessions_completed + 1;
      let newStatus = plan.status;
      if (plan.sessions_completed === 0) {
        newStatus = "in_progress";
      }
      if (newSessionsCompleted >= plan.total_sessions) {
        newStatus = "completed";
      }

      await supabase
        .from("treatment_plans")
        .update({
          sessions_completed: newSessionsCompleted,
          status: newStatus,
        })
        .eq("id", plan.id);

      // Create video room if video consultation
      if (booking.consultation_type === "video") {
        try {
          const roomName = `md-${booking.booking_number.toLowerCase().replace(/[^a-z0-9]/g, "-")}`;
          const endTimeDate = new Date(
            `${booking.appointment_date}T${booking.end_time}`
          );
          const expiresAt = Math.floor(endTimeDate.getTime() / 1000) + 3600;

          const room = await createRoom({
            name: roomName,
            expiresAt,
            maxParticipants: 2,
          });

          await supabase
            .from("bookings")
            .update({ video_room_url: room.url, daily_room_name: room.name })
            .eq("id", booking.id);
        } catch (err) {
          console.error("Daily.co room creation error:", err);
        }
      }

      // Export to connected calendars (non-blocking)
      exportBookingToGoogleCalendar(booking.id).catch((err) =>
        console.error("Google Calendar export error:", err)
      );
      exportBookingToMicrosoftCalendar(booking.id).catch((err) =>
        console.error("Microsoft Calendar export error:", err)
      );
      exportBookingToCalDAV(booking.id).catch((err) =>
        console.error("CalDAV export error:", err)
      );

      // Send confirmation email (non-blocking)
      const { data: patient } = await supabase
        .from("profiles")
        .select("first_name, email")
        .eq("id", user.id)
        .single();

      const { data: doctorData } = await supabase
        .from("doctors")
        .select(
          "clinic_name, address, profile:profiles!doctors_profile_id_fkey(first_name, last_name)"
        )
        .eq("id", plan.doctor_id)
        .single();

      if (patient?.email && doctorData) {
        const docProfile: any = Array.isArray(doctorData.profile)
          ? doctorData.profile[0]
          : doctorData.profile;

        const { subject, html } = bookingConfirmationEmail({
          patientName: patient.first_name || "Patient",
          doctorName: `${docProfile.first_name} ${docProfile.last_name}`,
          date: booking.appointment_date,
          time: booking.start_time,
          consultationType:
            booking.consultation_type === "video"
              ? "Video Consultation"
              : "In-Person Consultation",
          bookingNumber: booking.booking_number,
          amount: 0, // Already paid
          currency: plan.currency.toUpperCase(),
          videoRoomUrl: null,
          clinicName: (doctorData as any).clinic_name,
          address: (doctorData as any).address,
        });

        sendEmail({ to: patient.email, subject, html }).catch((err) =>
          console.error("Confirmation email error:", err)
        );
      }

      revalidatePath("/", "layout");
      return { success: true };
    }

    // ─── Pay Per Visit: create booking + Stripe checkout ───
    const perSessionAmountCents = plan.unit_price_cents;
    const perSessionFeeCents = plan.platform_fee_per_session_cents;
    const totalForSession = perSessionAmountCents + perSessionFeeCents;

    const { data: booking, error: bookingError } = await supabase
      .from("bookings")
      .insert({
        patient_id: user.id,
        doctor_id: plan.doctor_id,
        appointment_date: input.appointment_date,
        start_time: input.start_time,
        end_time: input.end_time,
        consultation_type: plan.consultation_type,
        status: BOOKING_STATUSES.PENDING_PAYMENT,
        currency: plan.currency,
        consultation_fee_cents: perSessionAmountCents,
        platform_fee_cents: perSessionFeeCents,
        total_amount_cents: totalForSession,
        service_id: plan.service_id,
        service_name: plan.service_name,
        treatment_plan_id: plan.id,
      })
      .select("id, booking_number")
      .single();

    if (bookingError || !booking) {
      console.error("Treatment plan per-visit booking error:", bookingError);
      return { error: "Failed to create booking. Please try again." };
    }

    // Fetch doctor Stripe info
    const { data: doctor } = await supabase
      .from("doctors")
      .select(
        "id, slug, stripe_account_id, stripe_onboarding_complete, profile:profiles!doctors_profile_id_fkey(first_name, last_name)"
      )
      .eq("id", plan.doctor_id)
      .single();

    if (!doctor || !doctor.stripe_account_id || !doctor.stripe_onboarding_complete) {
      return { error: "Doctor payment setup is incomplete." };
    }

    const { origin, locale } = await getOriginAndLocale();
    const profile: any = Array.isArray(doctor.profile)
      ? doctor.profile[0]
      : doctor.profile;
    const doctorName = `${profile.first_name} ${profile.last_name}`;

    const sessionNumber = plan.sessions_completed + 1;

    const session = await getStripe().checkout.sessions.create({
      mode: "payment",
      line_items: [
        {
          price_data: {
            currency: plan.currency.toLowerCase(),
            product_data: {
              name: `${plan.title} - Session ${sessionNumber}/${plan.total_sessions} with Dr. ${doctorName}`,
              description: `${input.appointment_date} at ${input.start_time}`,
            },
            unit_amount: totalForSession,
          },
          quantity: 1,
        },
      ],
      payment_intent_data: {
        application_fee_amount: perSessionFeeCents,
        transfer_data: {
          destination: doctor.stripe_account_id,
        },
      },
      metadata: {
        treatment_plan_id: plan.id,
        booking_id: booking.id,
        booking_number: booking.booking_number,
        payment_type: "per_visit",
      },
      success_url: `${origin}/${locale}/treatment-plan/${plan.token}/confirmed?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/${locale}/treatment-plan/${plan.token}`,
    });

    return { url: session.url };
  } catch (err) {
    console.error("bookTreatmentPlanSession error:", err);
    return { error: "An unexpected error occurred. Please try again." };
  }
}

export async function cancelTreatmentPlan(
  planId: string
): Promise<{ success?: boolean; error?: string }> {
  try {
    const { error: authError, supabase, doctor } = await requireDoctor();
    if (authError || !supabase || !doctor) {
      return { error: authError || "Authentication failed" };
    }

    const { data: plan } = await supabase
      .from("treatment_plans")
      .select("id, status, patient_id, title")
      .eq("id", planId)
      .eq("doctor_id", doctor.id)
      .single();

    if (!plan) {
      return { error: "Treatment plan not found." };
    }

    if (!["sent", "accepted"].includes(plan.status)) {
      return { error: "Only sent or accepted treatment plans can be cancelled." };
    }

    await supabase
      .from("treatment_plans")
      .update({ status: "cancelled" })
      .eq("id", planId);

    // Notify patient
    const profile: any = Array.isArray(doctor.profile)
      ? doctor.profile[0]
      : doctor.profile;
    const doctorName = `${profile.first_name} ${profile.last_name}`;

    createNotification({
      userId: plan.patient_id,
      type: "treatment_plan_cancelled",
      title: "Treatment Plan Cancelled",
      message: `Dr. ${doctorName} has cancelled the treatment plan: ${plan.title}`,
      channels: ["in_app"],
      metadata: { treatment_plan_id: planId },
    }).catch((err) =>
      console.error("Treatment plan cancellation notification error:", err)
    );

    revalidatePath("/", "layout");
    return { success: true };
  } catch (err) {
    console.error("cancelTreatmentPlan error:", err);
    return { error: "An unexpected error occurred." };
  }
}

export async function saveDoctorNotes(
  bookingId: string,
  notes: string
): Promise<{ success?: boolean; error?: string }> {
  try {
    const { error: authError, supabase, doctor } = await requireDoctor();
    if (authError || !supabase || !doctor) {
      return { error: authError || "Authentication failed" };
    }

    // Verify booking belongs to this doctor
    const { data: booking } = await supabase
      .from("bookings")
      .select("id, doctor_id")
      .eq("id", bookingId)
      .eq("doctor_id", doctor.id)
      .single();

    if (!booking) {
      return { error: "Booking not found or does not belong to you." };
    }

    const { error: updateError } = await supabase
      .from("bookings")
      .update({ doctor_notes: notes.trim() || null })
      .eq("id", bookingId);

    if (updateError) {
      console.error("saveDoctorNotes error:", updateError);
      return { error: "Failed to save notes. Please try again." };
    }

    revalidatePath("/", "layout");
    return { success: true };
  } catch (err) {
    console.error("saveDoctorNotes error:", err);
    return { error: "An unexpected error occurred." };
  }
}

export async function getDoctorTreatmentPlans() {
  try {
    const { error: authError, supabase, doctor } = await requireDoctor();
    if (authError || !supabase || !doctor) {
      return { plans: [], error: authError || "Authentication failed" };
    }

    const { data: plans, error } = await supabase
      .from("treatment_plans")
      .select(
        `
        *,
        patient:profiles!treatment_plans_patient_id_fkey(
          first_name, last_name, avatar_url, email
        )
      `
      )
      .eq("doctor_id", doctor.id)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("getDoctorTreatmentPlans error:", error);
      return { plans: [], error: "Failed to fetch treatment plans." };
    }

    return { plans: plans || [], error: null };
  } catch (err) {
    console.error("getDoctorTreatmentPlans error:", err);
    return { plans: [], error: "Failed to fetch treatment plans." };
  }
}

export async function getPatientTreatmentPlansV2() {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return {
        pending: [],
        active: [],
        completed: [],
        error: "Not authenticated",
      };
    }

    const { data: plans, error } = await supabase
      .from("treatment_plans")
      .select(
        `
        *,
        doctor:doctors!inner(
          id,
          slug,
          clinic_name,
          profile:profiles!doctors_profile_id_fkey(first_name, last_name, avatar_url)
        )
      `
      )
      .eq("patient_id", user.id)
      .in("status", ["sent", "accepted", "in_progress", "completed"])
      .order("created_at", { ascending: false });

    if (error) {
      console.error("getPatientTreatmentPlansV2 error:", error);
      return {
        pending: [],
        active: [],
        completed: [],
        error: "Failed to fetch treatment plans.",
      };
    }

    const allPlans = plans || [];

    const pending = allPlans.filter((p: any) => p.status === "sent");
    const active = allPlans.filter((p: any) =>
      ["accepted", "in_progress"].includes(p.status)
    );
    const completed = allPlans.filter((p: any) => p.status === "completed");

    return { pending, active, completed, error: null };
  } catch (err) {
    console.error("getPatientTreatmentPlansV2 error:", err);
    return {
      pending: [],
      active: [],
      completed: [],
      error: "Failed to fetch treatment plans.",
    };
  }
}
