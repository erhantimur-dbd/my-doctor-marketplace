"use server";

import crypto from "crypto";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getStripe } from "@/lib/stripe/client";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import {
  createFollowUpInvitationSchema,
  bookFollowUpSessionSchema,
  type CreateFollowUpInvitationInput,
  type BookFollowUpSessionInput,
} from "@/lib/validators/booking";
import { BOOKING_STATUSES } from "@/lib/constants/booking-status";
import { getBookingFeeCents, formatCurrency } from "@/lib/utils/currency";
import { sendEmail } from "@/lib/email/client";
import { followUpInvitationEmail } from "@/lib/email/templates";
import { createNotification } from "@/lib/notifications";
import { exportBookingToGoogleCalendar } from "@/lib/google/sync";
import { exportBookingToMicrosoftCalendar } from "@/lib/microsoft/sync";
import { exportBookingToCalDAV } from "@/lib/caldav/sync";
import { createRoom } from "@/lib/daily/client";
import { bookingConfirmationEmail } from "@/lib/email/templates";
import { log } from "@/lib/utils/logger";

// ─── helpers ───────────────────────────────────────────────────

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

// ─── actions ───────────────────────────────────────────────────

export async function createFollowUpInvitation(
  input: CreateFollowUpInvitationInput
): Promise<{ success?: boolean; invitation_id?: string; error?: string }> {
  try {
    const { error: authError, supabase, doctor } = await requireDoctor();
    if (authError || !supabase || !doctor) {
      return { error: authError || "Authentication failed" };
    }

    const parsed = createFollowUpInvitationSchema.safeParse(input);
    if (!parsed.success) {
      return { error: "Invalid invitation data. Please check your input." };
    }

    // Doctor must have Stripe set up
    if (!doctor.stripe_account_id || !doctor.stripe_onboarding_complete) {
      return {
        error: "Please complete your payment setup before sending invitations.",
      };
    }

    // Verify patient exists and has booked with this doctor before
    const { data: priorBookings } = await supabase
      .from("bookings")
      .select("id")
      .eq("doctor_id", doctor.id)
      .eq("patient_id", parsed.data.patient_id)
      .in("status", ["confirmed", "approved", "completed"])
      .limit(1);

    if (!priorBookings || priorBookings.length === 0) {
      return { error: "This patient has no prior bookings with you." };
    }

    // Resolve service details
    let serviceName: string;
    let unitPriceCents: number;
    let serviceId: string | null = null;
    let durationMinutes = parsed.data.duration_minutes;
    const consultationType = parsed.data.consultation_type;
    let itemsJson: { name: string; price_cents: number; quantity: number }[] | null = null;

    if (parsed.data.items && parsed.data.items.length > 0) {
      // Multi-item invitation
      itemsJson = parsed.data.items;
      unitPriceCents = itemsJson.reduce(
        (sum, item) => sum + item.price_cents * item.quantity,
        0
      );
      serviceName =
        itemsJson.length === 1
          ? itemsJson[0].name
          : itemsJson.map((i) => i.name).join(", ");
      serviceId = parsed.data.service_id || null;
    } else if (parsed.data.service_id) {
      const { data: service } = await supabase
        .from("doctor_services")
        .select("*")
        .eq("id", parsed.data.service_id)
        .eq("doctor_id", doctor.id)
        .single();

      if (!service || !service.is_active) {
        return { error: "Selected service is no longer available." };
      }

      serviceName = service.name;
      unitPriceCents = service.price_cents;
      durationMinutes = service.duration_minutes;
      serviceId = service.id;
    } else if (parsed.data.custom_service_name && parsed.data.custom_price_cents) {
      serviceName = parsed.data.custom_service_name;
      unitPriceCents = parsed.data.custom_price_cents;
    } else {
      return { error: "Either a service or custom name + price is required." };
    }

    // Calculate discount
    const totalSessions = parsed.data.total_sessions;
    const subtotalCents = unitPriceCents * totalSessions;
    let discountCents = 0;

    if (parsed.data.discount_type && parsed.data.discount_value && parsed.data.discount_value > 0) {
      if (parsed.data.discount_type === "percentage") {
        if (parsed.data.discount_value > 100) {
          return { error: "Percentage discount cannot exceed 100%." };
        }
        discountCents = Math.round((subtotalCents * parsed.data.discount_value) / 100);
      } else {
        discountCents = parsed.data.discount_value;
      }
    }

    const discountedTotalCents = Math.max(0, subtotalCents - discountCents);
    if (discountedTotalCents <= 0) {
      return { error: "Discount cannot make the total free. Please adjust." };
    }

    const platformFeeCents = getBookingFeeCents(doctor.base_currency) * totalSessions;

    // Generate secure token and set expiry
    const token = generateToken();
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 14); // 14 days from now

    // Insert invitation
    const { data: invitation, error: insertError } = await supabase
      .from("follow_up_invitations")
      .insert({
        token,
        doctor_id: doctor.id,
        patient_id: parsed.data.patient_id,
        service_id: serviceId,
        service_name: serviceName,
        consultation_type: consultationType,
        duration_minutes: durationMinutes,
        unit_price_cents: unitPriceCents,
        total_sessions: totalSessions,
        discount_type: parsed.data.discount_type || null,
        discount_value: parsed.data.discount_value || null,
        discounted_total_cents: discountedTotalCents,
        platform_fee_cents: platformFeeCents,
        currency: doctor.base_currency,
        doctor_note: parsed.data.doctor_note || null,
        items: itemsJson,
        expires_at: expiresAt.toISOString(),
      })
      .select("id")
      .single();

    if (insertError || !invitation) {
      log.error("Follow-up invitation insert error:", { err: insertError });
      return { error: "Failed to create invitation. Please try again." };
    }

    // Fetch patient details for email
    const { data: patient } = await supabase
      .from("profiles")
      .select("first_name, last_name, email")
      .eq("id", parsed.data.patient_id)
      .single();

    if (patient?.email) {
      const { origin, locale } = await getOriginAndLocale();
      const profile: any = Array.isArray(doctor.profile) ? doctor.profile[0] : doctor.profile;
      const doctorName = `${profile.first_name} ${profile.last_name}`;

      const discountLabel =
        parsed.data.discount_type === "percentage"
          ? `${parsed.data.discount_value}%`
          : parsed.data.discount_value
            ? formatCurrency(parsed.data.discount_value, doctor.base_currency)
            : null;

      const { subject, html } = followUpInvitationEmail({
        patientName: patient.first_name || "Patient",
        doctorName,
        serviceName,
        totalSessions,
        unitPrice: formatCurrency(unitPriceCents, doctor.base_currency),
        discount: discountLabel,
        totalPrice: formatCurrency(discountedTotalCents, doctor.base_currency),
        doctorNote: parsed.data.doctor_note || null,
        invitationUrl: `${origin}/${locale}/invitation/${token}`,
        expiresAt: expiresAt.toLocaleDateString("en-GB", {
          day: "numeric",
          month: "long",
          year: "numeric",
        }),
      });

      sendEmail({ to: patient.email, subject, html }).catch((err) =>
        log.error("Follow-up invitation email error:", { err: err })
      );

      // In-app notification
      createNotification({
        userId: parsed.data.patient_id,
        type: "follow_up_invitation",
        title: "Follow-up Invitation",
        message: `Dr. ${doctorName} has invited you for a follow-up: ${serviceName}`,
        channels: ["in_app"],
        metadata: { invitation_id: invitation.id, token },
      }).catch((err) =>
        log.error("Follow-up notification error:", { err: err })
      );
    }

    revalidatePath("/", "layout");
    return { success: true, invitation_id: invitation.id };
  } catch (err) {
    log.error("createFollowUpInvitation error:", { err: err });
    return { error: "An unexpected error occurred. Please try again." };
  }
}

export async function getFollowUpInvitationByToken(token: string) {
  try {
    // Use admin client to bypass RLS — access is gated by the secret token
    const supabase = createAdminClient();

    const { data: invitation, error } = await supabase
      .from("follow_up_invitations")
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

    if (error || !invitation) {
      return { invitation: null, error: "Invitation not found." };
    }

    // Lazy expiry: if pending and past expiration, mark as expired
    if (
      invitation.status === "pending" &&
      new Date(invitation.expires_at) < new Date()
    ) {
      await supabase
        .from("follow_up_invitations")
        .update({ status: "expired" })
        .eq("id", invitation.id);
      invitation.status = "expired";
    }

    return { invitation, error: null };
  } catch (err) {
    log.error("getFollowUpInvitationByToken error:", { err: err });
    return { invitation: null, error: "Failed to fetch invitation." };
  }
}

export async function createInvitationCheckout(
  invitationId: string,
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
      return { error: "You must be logged in to accept this invitation." };
    }

    // Fetch invitation
    const { data: invitation, error: invError } = await supabase
      .from("follow_up_invitations")
      .select("*")
      .eq("id", invitationId)
      .single();

    if (invError || !invitation) {
      return { error: "Invitation not found." };
    }

    if (invitation.patient_id !== user.id) {
      return { error: "This invitation is not addressed to you." };
    }

    if (invitation.status !== "pending") {
      return { error: "This invitation is no longer available." };
    }

    if (new Date(invitation.expires_at) < new Date()) {
      await supabase
        .from("follow_up_invitations")
        .update({ status: "expired" })
        .eq("id", invitation.id);
      return { error: "This invitation has expired." };
    }

    // Fetch doctor Stripe info
    const { data: doctor } = await supabase
      .from("doctors")
      .select(
        "id, slug, stripe_account_id, stripe_onboarding_complete, profile:profiles!doctors_profile_id_fkey(first_name, last_name)"
      )
      .eq("id", invitation.doctor_id)
      .single();

    if (!doctor || !doctor.stripe_account_id || !doctor.stripe_onboarding_complete) {
      return { error: "Doctor payment setup is incomplete." };
    }

    // Create first booking with pending_payment status
    const { data: booking, error: bookingError } = await supabase
      .from("bookings")
      .insert({
        patient_id: user.id,
        doctor_id: invitation.doctor_id,
        appointment_date: appointmentDate,
        start_time: startTime,
        end_time: endTime,
        consultation_type: invitation.consultation_type,
        status: BOOKING_STATUSES.PENDING_PAYMENT,
        currency: invitation.currency,
        consultation_fee_cents: invitation.unit_price_cents,
        platform_fee_cents: getBookingFeeCents(invitation.currency),
        total_amount_cents: invitation.discounted_total_cents + invitation.platform_fee_cents,
        service_id: invitation.service_id,
        service_name: invitation.service_name,
        invitation_id: invitation.id,
      })
      .select("id, booking_number")
      .single();

    if (bookingError || !booking) {
      log.error("Invitation booking insert error:", { err: bookingError });
      return { error: "Failed to create booking. Please try again." };
    }

    // Create Stripe Checkout Session
    const { origin, locale } = await getOriginAndLocale();
    const profile: any = Array.isArray(doctor.profile) ? doctor.profile[0] : doctor.profile;
    const doctorName = `${profile.first_name} ${profile.last_name}`;

    const sessionLabel =
      invitation.total_sessions > 1
        ? `Care Plan: ${invitation.service_name} (${invitation.total_sessions} sessions) with Dr. ${doctorName}`
        : `${invitation.service_name} with Dr. ${doctorName}`;

    const totalChargeCents =
      invitation.discounted_total_cents + invitation.platform_fee_cents;

    const session = await getStripe().checkout.sessions.create({
      mode: "payment",
      line_items: [
        {
          price_data: {
            currency: invitation.currency.toLowerCase(),
            product_data: {
              name: sessionLabel,
              description: `First session: ${appointmentDate} at ${startTime}`,
            },
            unit_amount: totalChargeCents,
          },
          quantity: 1,
        },
      ],
      payment_intent_data: {
        application_fee_amount: invitation.platform_fee_cents,
        transfer_data: {
          destination: doctor.stripe_account_id,
        },
      },
      metadata: {
        invitation_id: invitation.id,
        first_booking_id: booking.id,
        booking_number: booking.booking_number,
      },
      success_url: `${origin}/${locale}/invitation/${invitation.token}/confirmed?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/${locale}/invitation/${invitation.token}`,
    });

    return { url: session.url };
  } catch (err) {
    log.error("createInvitationCheckout error:", { err: err });
    return { error: "An unexpected error occurred. Please try again." };
  }
}

export async function bookFollowUpSession(
  input: BookFollowUpSessionInput
): Promise<{ success?: boolean; error?: string }> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return { error: "You must be logged in." };
    }

    const parsed = bookFollowUpSessionSchema.safeParse(input);
    if (!parsed.success) {
      return { error: "Invalid booking data." };
    }

    // Fetch invitation
    const { data: invitation, error: invError } = await supabase
      .from("follow_up_invitations")
      .select("*")
      .eq("id", parsed.data.invitation_id)
      .single();

    if (invError || !invitation) {
      return { error: "Care plan not found." };
    }

    if (invitation.patient_id !== user.id) {
      return { error: "This care plan is not yours." };
    }

    if (invitation.status !== "accepted") {
      return { error: "This care plan is not active." };
    }

    if (invitation.sessions_booked >= invitation.total_sessions) {
      return { error: "All sessions have already been booked." };
    }

    // Create booking — already paid, so set to confirmed directly
    const perSessionFeeCents = getBookingFeeCents(invitation.currency);

    const { data: booking, error: bookingError } = await supabase
      .from("bookings")
      .insert({
        patient_id: user.id,
        doctor_id: invitation.doctor_id,
        appointment_date: parsed.data.appointment_date,
        start_time: parsed.data.start_time,
        end_time: parsed.data.end_time,
        consultation_type: invitation.consultation_type,
        status: BOOKING_STATUSES.CONFIRMED,
        currency: invitation.currency,
        consultation_fee_cents: invitation.unit_price_cents,
        platform_fee_cents: perSessionFeeCents,
        total_amount_cents: 0, // Already paid as part of package
        service_id: invitation.service_id,
        service_name: invitation.service_name,
        invitation_id: invitation.id,
        paid_at: invitation.paid_at,
      })
      .select("id, booking_number, appointment_date, start_time, end_time, consultation_type")
      .single();

    if (bookingError || !booking) {
      log.error("Follow-up session booking error:", { err: bookingError });
      return { error: "Failed to book session. Please try again." };
    }

    // Increment sessions_booked
    await supabase
      .from("follow_up_invitations")
      .update({ sessions_booked: invitation.sessions_booked + 1 })
      .eq("id", invitation.id);

    // Create video room if video consultation
    if (booking.consultation_type === "video") {
      try {
        const roomName = `md-${booking.booking_number.toLowerCase().replace(/[^a-z0-9]/g, "-")}`;
        const endTime = new Date(`${booking.appointment_date}T${booking.end_time}`);
        const expiresAt = Math.floor(endTime.getTime() / 1000) + 3600;

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
        log.error("Daily.co room creation error:", { err: err });
      }
    }

    // Export to connected calendars (non-blocking)
    exportBookingToGoogleCalendar(booking.id).catch((err) =>
      log.error("Google Calendar export error:", { err: err })
    );
    exportBookingToMicrosoftCalendar(booking.id).catch((err) =>
      log.error("Microsoft Calendar export error:", { err: err })
    );
    exportBookingToCalDAV(booking.id).catch((err) =>
      log.error("CalDAV export error:", { err: err })
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
      .eq("id", invitation.doctor_id)
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
        currency: invitation.currency.toUpperCase(),
        videoRoomUrl: null,
        clinicName: (doctorData as any).clinic_name,
        address: (doctorData as any).address,
      });

      sendEmail({ to: patient.email, subject, html }).catch((err) =>
        log.error("Confirmation email error:", { err: err })
      );
    }

    revalidatePath("/", "layout");
    return { success: true };
  } catch (err) {
    log.error("bookFollowUpSession error:", { err: err });
    return { error: "An unexpected error occurred. Please try again." };
  }
}

export async function cancelFollowUpInvitation(
  invitationId: string
): Promise<{ success?: boolean; error?: string }> {
  try {
    const { error: authError, supabase, doctor } = await requireDoctor();
    if (authError || !supabase || !doctor) {
      return { error: authError || "Authentication failed" };
    }

    const { data: invitation } = await supabase
      .from("follow_up_invitations")
      .select("id, status, patient_id, service_name")
      .eq("id", invitationId)
      .eq("doctor_id", doctor.id)
      .single();

    if (!invitation) {
      return { error: "Invitation not found." };
    }

    if (invitation.status !== "pending") {
      return { error: "Only pending invitations can be cancelled." };
    }

    await supabase
      .from("follow_up_invitations")
      .update({ status: "cancelled" })
      .eq("id", invitationId);

    // Notify patient
    const profile: any = Array.isArray(doctor.profile)
      ? doctor.profile[0]
      : doctor.profile;
    const doctorName = `${profile.first_name} ${profile.last_name}`;

    createNotification({
      userId: invitation.patient_id,
      type: "follow_up_cancelled",
      title: "Invitation Cancelled",
      message: `Dr. ${doctorName} has cancelled the follow-up invitation for ${invitation.service_name}.`,
      channels: ["in_app"],
      metadata: { invitation_id: invitationId },
    }).catch((err) => log.error("Cancellation notification error:", { err: err }));

    revalidatePath("/", "layout");
    return { success: true };
  } catch (err) {
    log.error("cancelFollowUpInvitation error:", { err: err });
    return { error: "An unexpected error occurred." };
  }
}

export async function getPatientTreatmentPlans() {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return { active: [], completed: [], error: "Not authenticated" };
    }

    const { data: invitations, error } = await supabase
      .from("follow_up_invitations")
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
      .eq("status", "accepted")
      .order("created_at", { ascending: false });

    if (error) {
      log.error("getPatientTreatmentPlans error:", { err: error });
      return { active: [], completed: [], error: "Failed to fetch care plans." };
    }

    const active = (invitations || []).filter(
      (inv: any) => inv.sessions_booked < inv.total_sessions
    );
    const completed = (invitations || []).filter(
      (inv: any) => inv.sessions_booked >= inv.total_sessions
    );

    return { active, completed, error: null };
  } catch (err) {
    log.error("getPatientTreatmentPlans error:", { err: err });
    return { active: [], completed: [], error: "Failed to fetch care plans." };
  }
}
