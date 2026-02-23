"use server";

import { createClient } from "@/lib/supabase/server";
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

const PLATFORM_FEE_PERCENT = 15;

const CANCELLABLE_STATUSES = [
  BOOKING_STATUSES.CONFIRMED,
  BOOKING_STATUSES.PENDING_APPROVAL,
  BOOKING_STATUSES.APPROVED,
];

export async function createBookingAndCheckout(input: CreateBookingInput) {
  try {
    const parsed = createBookingSchema.safeParse(input);
    if (!parsed.success) {
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
        is_active,
        verification_status,
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

    // Ensure the consultation type is supported
    if (!doctor.consultation_types?.includes(parsed.data.consultation_type)) {
      return {
        error: "This doctor does not offer the selected consultation type.",
      };
    }

    // Calculate fees
    const consultationFeeCents =
      parsed.data.consultation_type === "video" &&
      doctor.video_consultation_fee_cents
        ? doctor.video_consultation_fee_cents
        : doctor.consultation_fee_cents;

    const platformFeeCents = Math.round(
      (consultationFeeCents * PLATFORM_FEE_PERCENT) / 100
    );
    const totalAmountCents = consultationFeeCents + platformFeeCents;

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
        total_amount_cents: totalAmountCents,
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
    const consultationLabel =
      parsed.data.consultation_type === "video"
        ? "Video Consultation"
        : "In-Person Consultation";

    // Create Stripe Checkout Session
    const session = await getStripe().checkout.sessions.create({
      mode: "payment",
      line_items: [
        {
          price_data: {
            currency: doctor.base_currency.toLowerCase(),
            product_data: {
              name: `${consultationLabel} with Dr. ${doctorName}`,
              description: `${parsed.data.appointment_date} at ${parsed.data.start_time}`,
            },
            unit_amount: totalAmountCents,
          },
          quantity: 1,
        },
      ],
      payment_intent_data: {
        application_fee_amount: platformFeeCents,
        transfer_data: {
          destination: doctor.stripe_account_id,
        },
      },
      metadata: {
        booking_id: booking.id,
        booking_number: booking.booking_number,
      },
      success_url: `${process.env.NEXT_PUBLIC_APP_URL}/en/booking-confirmation?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${process.env.NEXT_PUBLIC_APP_URL}/en/doctors/${doctor.slug}`,
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

    // Fetch booking
    const { data: booking, error: bookingError } = await supabase
      .from("bookings")
      .select(
        `
        *,
        doctor:doctors!inner(
          cancellation_policy,
          cancellation_hours,
          stripe_account_id
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
    if (
      booking.stripe_payment_intent_id &&
      refundPercent > 0 &&
      booking.total_amount_cents > 0
    ) {
      const refundAmount = Math.round(
        (booking.total_amount_cents * refundPercent) / 100
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

export async function getDoctorAvailableSlots(
  doctorId: string,
  date: string,
  consultationType: string
): Promise<{ slots: AvailableSlot[]; error?: string }> {
  try {
    const supabase = await createClient();

    const { data, error } = await supabase.rpc("get_available_slots", {
      p_doctor_id: doctorId,
      p_date: date,
      p_consultation_type: consultationType,
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
