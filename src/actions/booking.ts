"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getStripe } from "@/lib/stripe/client";
import { revalidatePath } from "next/cache";
import {
  createBookingSchema,
  cancelBookingSchema,
  type CreateBookingInput,
  type CancelBookingInput,
} from "@/lib/validators/booking";
import { BOOKING_STATUSES } from "@/lib/constants/booking-status";
import type { AvailableSlot } from "@/types/index";
import { headers } from "next/headers";
import { removeBookingFromGoogleCalendar } from "@/lib/google/sync";
import { removeBookingFromMicrosoftCalendar } from "@/lib/microsoft/sync";
import { removeBookingFromCalDAV } from "@/lib/caldav/sync";
import { deleteRoom } from "@/lib/daily/client";
import { sendEmail } from "@/lib/email/client";
import { bookingCancellationEmail } from "@/lib/email/templates";
import { sendWhatsAppTemplate } from "@/lib/whatsapp/client";
import {
  TEMPLATE_BOOKING_CANCELLATION,
  buildBookingCancellationComponents,
  mapLocaleToWhatsApp,
} from "@/lib/whatsapp/templates";

import {
  getBookingFeeCents,
  calculateDepositCents,
  getCommissionCents,
  formatCurrency,
} from "@/lib/utils/currency";
import { createNotification } from "@/lib/notifications";

/** Derive origin + locale from incoming request headers. */
async function getOriginAndLocale() {
  const h = await headers();
  const host = h.get("x-forwarded-host") || h.get("host") || "";
  const proto = h.get("x-forwarded-proto") || "https";
  const origin = host
    ? `${proto}://${host}`
    : process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

  // Extract locale from the referer path (e.g. /de/doctors/slug/book)
  const referer = h.get("referer") || "";
  const localeMatch = referer.match(/\/(en|de|tr|fr|it|es|pt|zh|ja)(\/|$)/);
  const locale = localeMatch ? localeMatch[1] : "en";

  return { origin, locale };
}

const CANCELLABLE_STATUSES = [
  BOOKING_STATUSES.CONFIRMED,
  BOOKING_STATUSES.PENDING_APPROVAL,
  BOOKING_STATUSES.APPROVED,
];

export async function createBookingAndCheckout(input: CreateBookingInput) {
  try {
    const parsed = createBookingSchema.safeParse(input);
    if (!parsed.success) {
      console.error("Booking validation errors:", JSON.stringify(parsed.error.issues, null, 2));
      console.error("Booking input received:", JSON.stringify(input, null, 2));
      return { error: "Invalid booking data. Please check your input." };
    }

    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return { error: "You must be logged in to book an appointment." };
    }

    // Fetch doctor with profile to get pricing and Stripe account
    const { data: doctor, error: doctorError } = await supabase
      .from("doctors")
      .select(
        `
        id,
        slug,
        stripe_account_id,
        stripe_onboarding_complete,
        consultation_fee_cents,
        video_consultation_fee_cents,
        base_currency,
        cancellation_policy,
        consultation_types,
        in_person_deposit_type,
        in_person_deposit_value,
        is_active,
        verification_status,
        organization_id,
        profile:profiles!doctors_profile_id_fkey(first_name, last_name, email)
      `
      )
      .eq("id", parsed.data.doctor_id)
      .single();

    if (doctorError || !doctor) {
      return { error: "Doctor not found." };
    }

    if (!doctor.is_active || doctor.verification_status !== "verified") {
      return { error: "This doctor is not currently accepting appointments." };
    }

    if (!doctor.stripe_account_id || !doctor.stripe_onboarding_complete) {
      return {
        error:
          "This doctor has not completed their payment setup. Please try again later.",
      };
    }

    // Check doctor's org has an active license (or legacy subscription)
    const adminSupabase = createAdminClient();
    let hasActiveLicense = false;

    // New: check organization license
    if (doctor.organization_id) {
      const { data: orgLicense } = await adminSupabase
        .from("licenses")
        .select("id")
        .eq("organization_id", doctor.organization_id)
        .in("status", ["active", "trialing", "past_due"])
        .limit(1)
        .maybeSingle();
      hasActiveLicense = !!orgLicense;
    }

    if (!hasActiveLicense) {
      return {
        error: "This doctor is not currently accepting online bookings.",
      };
    }

    // Ensure the consultation type is supported
    if (!doctor.consultation_types?.includes(parsed.data.consultation_type)) {
      return {
        error: "This doctor does not offer the selected consultation type.",
      };
    }

    // Calculate fees — service-aware pricing
    let consultationFeeCents: number;
    let serviceName: string | null = null;
    const serviceId: string | null = parsed.data.service_id || null;

    // Track service-level deposit overrides
    let serviceDepositType: string | null = null;
    let serviceDepositValue: number | null = null;

    if (serviceId) {
      // Returning patient with selected service — use service price
      const { data: service } = await supabase
        .from("doctor_services")
        .select("*, deposit_type, deposit_value")
        .eq("id", serviceId)
        .eq("doctor_id", parsed.data.doctor_id)
        .single();

      if (!service || !service.is_active) {
        return { error: "Selected service is no longer available." };
      }

      consultationFeeCents = service.price_cents;
      serviceName = service.name;
      serviceDepositType = (service as any).deposit_type ?? null;
      serviceDepositValue = (service as any).deposit_value ?? null;
    } else {
      // First visit or doctor has no services — use default fee
      consultationFeeCents =
        parsed.data.consultation_type === "video" &&
        doctor.video_consultation_fee_cents
          ? doctor.video_consultation_fee_cents
          : doctor.consultation_fee_cents;
    }

    const platformFeeCents = getBookingFeeCents(doctor.base_currency);
    const commissionCents = getCommissionCents(consultationFeeCents);
    const totalAmountCents = consultationFeeCents + platformFeeCents;

    // Resolve deposit config: service override → doctor default → none
    // Video consultations are ALWAYS full payment; deposit only applies to in-person
    let resolvedDepositType: string | null = null;
    let resolvedDepositValue: number | null = null;

    if (parsed.data.consultation_type === "in_person") {
      if (serviceDepositType != null) {
        // Service has its own deposit override
        resolvedDepositType = serviceDepositType;
        resolvedDepositValue = serviceDepositValue;
      } else {
        // Use doctor's default for in-person
        resolvedDepositType = (doctor as any).in_person_deposit_type ?? "none";
        resolvedDepositValue = (doctor as any).in_person_deposit_value ?? null;
      }
    }

    const depositAmountCents = calculateDepositCents(
      consultationFeeCents,
      resolvedDepositType,
      resolvedDepositValue
    );
    const isDeposit = depositAmountCents != null && depositAmountCents > 0;
    const remainderDueCents = isDeposit
      ? consultationFeeCents - depositAmountCents
      : null;

    // The amount Stripe will charge the patient:
    // Full: consultation_fee + booking_fee
    // Deposit: deposit_amount + booking_fee
    const stripeChargeCents = isDeposit
      ? depositAmountCents + platformFeeCents
      : totalAmountCents;

    // Application fee = booking fee (from patient) + 15% commission (from doctor's share)
    // In deposit mode the commission is still on the full consultation fee,
    // but it's capped at the Stripe charge so Stripe doesn't reject it.
    const applicationFeeCents = Math.min(
      platformFeeCents + commissionCents,
      stripeChargeCents
    );

    // Insert booking with pending_payment status
    const { data: booking, error: bookingError } = await supabase
      .from("bookings")
      .insert({
        patient_id: user.id,
        doctor_id: doctor.id,
        appointment_date: parsed.data.appointment_date,
        start_time: parsed.data.start_time,
        end_time: parsed.data.end_time,
        consultation_type: parsed.data.consultation_type,
        patient_notes: parsed.data.patient_notes || null,
        status: BOOKING_STATUSES.PENDING_PAYMENT,
        currency: doctor.base_currency,
        consultation_fee_cents: consultationFeeCents,
        platform_fee_cents: platformFeeCents,
        commission_cents: commissionCents,
        total_amount_cents: totalAmountCents,
        payment_mode: isDeposit ? "deposit" : "full",
        deposit_amount_cents: depositAmountCents,
        remainder_due_cents: remainderDueCents,
        deposit_type: isDeposit ? resolvedDepositType : null,
        deposit_value: isDeposit ? resolvedDepositValue : null,
        service_id: serviceId,
        service_name: serviceName,
        organization_id: doctor.organization_id || null,
      })
      .select("id, booking_number")
      .single();

    if (bookingError || !booking) {
      console.error("Booking insert error:", bookingError);
      return { error: "Failed to create booking. Please try again." };
    }

    // Compose a readable description for the checkout line item
    const profile = Array.isArray(doctor.profile) ? doctor.profile[0] : doctor.profile;
    const doctorName = `${profile.first_name} ${profile.last_name}`;
    const consultationLabel = serviceName
      ? serviceName
      : parsed.data.consultation_type === "video"
        ? "Video Consultation"
        : "In-Person Consultation";

    // Create Stripe Checkout Session
    const { origin, locale } = await getOriginAndLocale();

    const session = await getStripe().checkout.sessions.create({
      mode: "payment",
      line_items: [
        {
          price_data: {
            currency: doctor.base_currency.toLowerCase(),
            product_data: {
              name: isDeposit
                ? `Deposit: ${consultationLabel} with Dr. ${doctorName}`
                : `${consultationLabel} with Dr. ${doctorName}`,
              description: isDeposit
                ? `${parsed.data.appointment_date} at ${parsed.data.start_time} (${resolvedDepositType === "percentage" ? `${resolvedDepositValue}% deposit` : "deposit"} — remainder due on the day)`
                : `${parsed.data.appointment_date} at ${parsed.data.start_time}`,
            },
            unit_amount: stripeChargeCents,
          },
          quantity: 1,
        },
      ],
      payment_intent_data: {
        application_fee_amount: applicationFeeCents,
        transfer_data: {
          destination: doctor.stripe_account_id,
        },
      },
      metadata: {
        booking_id: booking.id,
        booking_number: booking.booking_number,
        payment_mode: isDeposit ? "deposit" : "full",
      },
      success_url: `${origin}/${locale}/booking-confirmation?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/${locale}/doctors/${doctor.slug}`,
    });

    return { url: session.url };
  } catch (err) {
    console.error("createBookingAndCheckout error:", err);
    return { error: "An unexpected error occurred. Please try again." };
  }
}

export async function cancelBooking(input: CancelBookingInput) {
  try {
    const parsed = cancelBookingSchema.safeParse(input);
    if (!parsed.success) {
      return { error: "Invalid cancellation data." };
    }

    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return { error: "You must be logged in to cancel a booking." };
    }

    // Fetch booking with doctor + patient details for cancellation email
    const { data: booking, error: bookingError } = await supabase
      .from("bookings")
      .select(
        `
        *,
        patient:profiles!bookings_patient_id_fkey(first_name, last_name, email, phone, notification_whatsapp, preferred_locale),
        doctor:doctors!inner(
          cancellation_policy,
          cancellation_hours,
          stripe_account_id,
          profile:profiles!doctors_profile_id_fkey(first_name, last_name)
        )
      `
      )
      .eq("id", parsed.data.booking_id)
      .single();

    if (bookingError || !booking) {
      return { error: "Booking not found." };
    }

    // Verify ownership
    if (booking.patient_id !== user.id) {
      return { error: "You are not authorized to cancel this booking." };
    }

    // Verify the booking is in a cancellable status
    if (!CANCELLABLE_STATUSES.includes(booking.status)) {
      return { error: "This booking cannot be cancelled in its current state." };
    }

    // Calculate hours until appointment
    const appointmentDateTime = new Date(
      `${booking.appointment_date}T${booking.start_time}`
    );
    const now = new Date();
    const hoursUntilAppointment =
      (appointmentDateTime.getTime() - now.getTime()) / (1000 * 60 * 60);

    // Determine refund amount based on cancellation policy
    let refundPercent = 0;
    const policy = booking.doctor.cancellation_policy;

    if (policy === "flexible") {
      // Full refund if more than 24 hours before appointment
      refundPercent = hoursUntilAppointment > 24 ? 100 : 0;
    } else if (policy === "moderate") {
      // 50% refund if more than 48 hours before
      if (hoursUntilAppointment > 48) {
        refundPercent = 100;
      } else if (hoursUntilAppointment > 24) {
        refundPercent = 50;
      } else {
        refundPercent = 0;
      }
    } else if (policy === "strict") {
      // No refund if less than 72 hours before
      refundPercent = hoursUntilAppointment > 72 ? 100 : 0;
    }

    // Process refund via Stripe if payment was made
    // For deposit bookings, refund is based on what was actually charged (deposit + booking fee)
    const stripeChargedAmount =
      booking.payment_mode === "deposit" && booking.deposit_amount_cents != null
        ? booking.deposit_amount_cents + booking.platform_fee_cents
        : booking.total_amount_cents;

    if (
      booking.stripe_payment_intent_id &&
      refundPercent > 0 &&
      stripeChargedAmount > 0
    ) {
      const refundAmount = Math.round(
        (stripeChargedAmount * refundPercent) / 100
      );

      await getStripe().refunds.create({
        payment_intent: booking.stripe_payment_intent_id,
        amount: refundAmount,
        reverse_transfer: true,
        refund_application_fee: true,
      });
    }

    // Update booking status
    const { error: updateError } = await supabase
      .from("bookings")
      .update({
        status: BOOKING_STATUSES.CANCELLED_PATIENT,
        cancelled_at: new Date().toISOString(),
        cancellation_reason: parsed.data.reason || null,
      })
      .eq("id", booking.id);

    if (updateError) {
      console.error("Booking cancellation update error:", updateError);
      return { error: "Failed to update booking status." };
    }

    // Remove event from doctor's connected calendars (non-blocking)
    removeBookingFromGoogleCalendar(booking.id).catch((err) =>
      console.error("Google Calendar removal error:", err)
    );
    removeBookingFromMicrosoftCalendar(booking.id).catch((err) =>
      console.error("Microsoft Calendar removal error:", err)
    );
    removeBookingFromCalDAV(booking.id).catch((err) =>
      console.error("CalDAV removal error:", err)
    );

    // Delete Daily.co video room if one was created (non-blocking)
    if (booking.daily_room_name) {
      deleteRoom(booking.daily_room_name).catch((err) =>
        console.error("Daily.co room deletion error:", err)
      );
    }

    // Send cancellation email to patient (non-blocking)
    const patient: any = Array.isArray(booking.patient) ? booking.patient[0] : booking.patient;
    const doctor: any = booking.doctor;
    const doctorProfile: any = doctor?.profile
      ? (Array.isArray(doctor.profile) ? doctor.profile[0] : doctor.profile)
      : null;

    if (patient?.email && doctorProfile) {
      const refundAmount = refundPercent > 0
        ? (stripeChargedAmount * refundPercent) / 100 / 100
        : 0;

      const { subject, html } = bookingCancellationEmail({
        patientName: patient.first_name || "Patient",
        doctorName: `${doctorProfile.first_name} ${doctorProfile.last_name}`,
        date: booking.appointment_date,
        time: booking.start_time,
        bookingNumber: booking.booking_number,
        refundAmount,
        currency: booking.currency.toUpperCase(),
      });

      sendEmail({ to: patient.email, subject, html }).catch((err) =>
        console.error("Cancellation email error:", err)
      );

      // Send WhatsApp cancellation notification if opted in
      if (patient.notification_whatsapp && patient.phone) {
        const refundInfo = refundPercent > 0
          ? `A ${refundPercent}% refund has been initiated.`
          : "No refund applicable per cancellation policy.";

        sendWhatsAppTemplate({
          to: patient.phone,
          templateName: TEMPLATE_BOOKING_CANCELLATION,
          languageCode: mapLocaleToWhatsApp(patient.preferred_locale),
          components: buildBookingCancellationComponents({
            patientName: patient.first_name || "there",
            bookingNumber: booking.booking_number,
            date: booking.appointment_date,
            refundInfo,
          }),
        }).catch((err) =>
          console.error("WhatsApp cancellation error:", err)
        );
      }
    }

    revalidatePath("/", "layout");
    return {
      success: true,
      refundPercent,
      message:
        refundPercent > 0
          ? `Booking cancelled. A ${refundPercent}% refund will be processed.`
          : "Booking cancelled. No refund is applicable based on the cancellation policy.",
    };
  } catch (err) {
    console.error("cancelBooking error:", err);
    return { error: "An unexpected error occurred while cancelling." };
  }
}

export async function getBookingDetails(bookingId: string) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return { error: "You must be logged in." };
    }

    const { data: booking, error } = await supabase
      .from("bookings")
      .select(
        `
        *,
        patient:profiles!bookings_patient_id_fkey(
          id, first_name, last_name, email, avatar_url, phone
        ),
        doctor:doctors!inner(
          id, slug, title, base_currency, cancellation_policy,
          clinic_name, address,
          profile:profiles!doctors_profile_id_fkey(first_name, last_name, avatar_url, email),
          location:locations(city, country_code, timezone),
          specialties:doctor_specialties(
            specialty:specialties(id, name_key, slug),
            is_primary
          )
        )
      `
      )
      .eq("id", bookingId)
      .single();

    if (error || !booking) {
      return { error: "Booking not found." };
    }

    // Verify the user is either the patient or the doctor
    const isDoctorOwner = booking.doctor?.profile?.email === user.email;
    const isPatientOwner = booking.patient_id === user.id;

    if (!isPatientOwner && !isDoctorOwner) {
      return { error: "You are not authorized to view this booking." };
    }

    return { booking };
  } catch (err) {
    console.error("getBookingDetails error:", err);
    return { error: "Failed to fetch booking details." };
  }
}

export interface AvailableDateInfo {
  date: string; // "YYYY-MM-DD"
  slotCount: number;
}

export async function getDoctorAvailableDates(
  doctorId: string,
  startDate: string, // "YYYY-MM-DD"
  endDate: string, // "YYYY-MM-DD"
  consultationType: string
): Promise<{ dates: AvailableDateInfo[]; error?: string }> {
  try {
    const supabase = createAdminClient();

    const { data, error } = await supabase.rpc("get_available_dates_in_range", {
      p_doctor_id: doctorId,
      p_start_date: startDate,
      p_end_date: endDate,
      p_consultation_type: consultationType,
    });

    if (error) {
      console.error("get_available_dates_in_range RPC error:", error);
      return { dates: [], error: "Failed to fetch available dates." };
    }

    return {
      dates: (
        (data as { available_date: string; slot_count: number }[]) || []
      ).map((r) => ({
        date: r.available_date,
        slotCount: r.slot_count,
      })),
    };
  } catch (err) {
    console.error("getDoctorAvailableDates error:", err);
    return { dates: [], error: "Failed to fetch available dates." };
  }
}

export async function getDoctorAvailableSlots(
  doctorId: string,
  date: string,
  consultationType: string,
  slotDurationOverride?: number
): Promise<{ slots: AvailableSlot[]; error?: string }> {
  try {
    // Use admin client so the RPC is callable regardless of the user's role
    // permissions (matches getNextAvailabilityBatch which also uses admin).
    const supabase = createAdminClient();

    const { data, error } = await supabase.rpc("get_available_slots", {
      p_doctor_id: doctorId,
      p_date: date,
      p_consultation_type: consultationType,
      p_slot_duration_override: slotDurationOverride ?? null,
    });

    if (error) {
      console.error("get_available_slots RPC error:", error);
      return { slots: [], error: "Failed to fetch available slots." };
    }

    return { slots: (data as AvailableSlot[]) || [] };
  } catch (err) {
    console.error("getDoctorAvailableSlots error:", err);
    return { slots: [], error: "Failed to fetch available slots." };
  }
}

// ── Post-Visit Summary ──────────────────────────────────────────────

export async function saveVisitSummary(bookingId: string, summary: string) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) return { error: "You must be logged in." };

    // Verify the user is the doctor for this booking
    const { data: booking } = await supabase
      .from("bookings")
      .select("id, status, doctor_id, patient_id")
      .eq("id", bookingId)
      .single();

    if (!booking) return { error: "Booking not found." };
    if (booking.status !== "completed") {
      return { error: "Visit summary can only be added to completed bookings." };
    }

    // Check user is the doctor
    const { data: doctor } = await supabase
      .from("doctors")
      .select("id")
      .eq("profile_id", user.id)
      .eq("id", booking.doctor_id)
      .single();

    if (!doctor) return { error: "Only the doctor can add a visit summary." };

    const trimmed = summary.trim();
    if (!trimmed || trimmed.length > 5000) {
      return { error: "Summary must be between 1 and 5000 characters." };
    }

    const admin = createAdminClient();
    const { error: updateErr } = await admin
      .from("bookings")
      .update({
        visit_summary: trimmed,
        visit_summary_at: new Date().toISOString(),
      })
      .eq("id", bookingId);

    if (updateErr) {
      console.error("[VisitSummary] Update error:", updateErr);
      return { error: "Failed to save visit summary." };
    }

    // Notify patient
    try {
      await createNotification({
        userId: booking.patient_id,
        type: "visit_summary",
        title: "Visit Summary Available",
        message: "Your doctor has added a summary for your recent appointment.",
        channels: ["in_app", "email"],
        metadata: { bookingId },
      });
    } catch (err) {
      console.error("[VisitSummary] Notification error:", err);
    }

    revalidatePath("/", "layout");
    return { success: true };
  } catch (err) {
    console.error("saveVisitSummary error:", err);
    return { error: "An unexpected error occurred." };
  }
}
