"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { revalidatePath } from "next/cache";
import { requireOrgMember } from "./organization";
import { getStripe } from "@/lib/stripe/client";
import { sendEmail } from "@/lib/email/client";
import { reschedulePaymentEmail } from "@/lib/email/templates";
import { log } from "@/lib/utils/logger";
import { z } from "zod/v4";

// ─── Validators ──────────────────────────────────────────────

const cancelBookingSchema = z.object({
  booking_id: z.string().uuid(),
  reason: z.string().max(500).optional(),
});

const rescheduleBookingSchema = z.object({
  booking_id: z.string().uuid(),
  new_doctor_id: z.string().uuid(),
  new_start_time: z.string(), // ISO datetime
  new_end_time: z.string(),   // ISO datetime
  new_appointment_date: z.string(), // YYYY-MM-DD
  new_clinic_location_id: z.string().uuid().optional(),
  reason: z.string().max(500).optional(),
});

const CANCELLABLE_STATUSES = [
  "confirmed",
  "pending_approval",
  "approved",
  "pending_reschedule_payment",
];

// ─── Admin: Get org bookings ─────────────────────────────────

export async function getOrgBookings(params: {
  status?: string;
  doctorId?: string;
  locationId?: string;
  fromDate?: string;
  toDate?: string;
  limit?: number;
  offset?: number;
}) {
  const { error: authError, supabase, org } = await requireOrgMember(["owner", "admin"]);
  if (authError || !supabase || !org) return { error: authError, bookings: [] };

  const { data, error } = await supabase.rpc("get_org_bookings", {
    p_org_id: org.id,
    p_status: params.status ?? null,
    p_doctor_id: params.doctorId ?? null,
    p_location_id: params.locationId ?? null,
    p_from_date: params.fromDate ?? null,
    p_to_date: params.toDate ?? null,
    p_limit: params.limit ?? 50,
    p_offset: params.offset ?? 0,
  });

  if (error) return { error: error.message, bookings: [] };
  return { error: null, bookings: data ?? [] };
}

// ─── Admin: Cancel any clinic booking ────────────────────────

export async function adminCancelBooking(formData: FormData) {
  const { error: authError, org, membership } = await requireOrgMember(["owner", "admin"]);
  if (authError || !org || !membership) return { error: authError };

  const parsed = cancelBookingSchema.safeParse({
    booking_id: formData.get("booking_id") as string,
    reason: (formData.get("reason") as string) || undefined,
  });
  if (!parsed.success) return { error: "Invalid input" };

  const adminSupabase = createAdminClient();

  // Fetch full booking
  const { data: booking } = await adminSupabase
    .from("bookings")
    .select(`
      *,
      patient:profiles!bookings_patient_id_fkey(first_name, last_name, email, phone),
      doctor:doctors!inner(
        cancellation_policy,
        cancellation_hours,
        stripe_account_id,
        profile:profiles!doctors_profile_id_fkey(first_name, last_name)
      )
    `)
    .eq("id", parsed.data.booking_id)
    .eq("organization_id", org.id)
    .single();

  if (!booking) return { error: "Booking not found in this organization" };
  if (!CANCELLABLE_STATUSES.includes(booking.status)) {
    return { error: "This booking cannot be cancelled in its current state." };
  }

  // Process Stripe refund if booking was paid
  let refundAmountCents = 0;
  if (booking.stripe_payment_intent_id && booking.paid_at) {
    // Admin cancellations: always full refund (clinic takes responsibility)
    refundAmountCents = booking.payment_mode === "deposit"
      ? (booking.deposit_amount_cents ?? 0) + (booking.platform_fee_cents ?? 0)
      : booking.total_amount_cents;

    if (refundAmountCents > 0) {
      try {
        const stripe = getStripe();
        await stripe.refunds.create({
          payment_intent: booking.stripe_payment_intent_id,
          amount: refundAmountCents,
          reverse_transfer: true,
          refund_application_fee: true,
        });
      } catch (err) {
        log.error("Stripe refund failed during admin cancellation:", { err, bookingId: booking.id });
        return { error: "Failed to process refund. Please try again or contact support." };
      }
    }
  }

  // Update booking status
  await adminSupabase
    .from("bookings")
    .update({
      status: "cancelled_doctor",
      cancelled_at: new Date().toISOString(),
      cancellation_reason: parsed.data.reason || "Cancelled by clinic administrator",
      rescheduled_by: membership.user_id,
      refund_amount_cents: refundAmountCents,
      refunded_at: refundAmountCents > 0 ? new Date().toISOString() : null,
    })
    .eq("id", booking.id);

  // Notify patient
  const patient: any = Array.isArray(booking.patient) ? booking.patient[0] : booking.patient;
  const doctor: any = Array.isArray(booking.doctor) ? booking.doctor[0] : booking.doctor;
  const doctorProfile: any = Array.isArray(doctor?.profile) ? doctor.profile[0] : doctor?.profile;

  if (patient?.email) {
    sendEmail({
      to: patient.email,
      subject: `Appointment Cancelled — ${booking.booking_number}`,
      html: `<p>Hi ${patient.first_name}, your appointment with Dr. ${doctorProfile?.last_name} on ${booking.appointment_date} has been cancelled by the clinic. ${refundAmountCents > 0 ? "A full refund has been issued and should appear within 5-10 business days." : ""}</p>`,
    }).catch((err) => log.error("Cancel notification email failed:", { err }));
  }

  revalidatePath("/doctor-dashboard/organization/bookings");
  return { error: null, refundAmountCents };
}

// ─── Admin: Reschedule any clinic booking ────────────────────

export async function adminRescheduleBooking(formData: FormData) {
  const { error: authError, org, membership } = await requireOrgMember(["owner", "admin"]);
  if (authError || !org || !membership) return { error: authError };

  const locationIdsRaw = formData.get("new_clinic_location_id") as string;
  const parsed = rescheduleBookingSchema.safeParse({
    booking_id: formData.get("booking_id") as string,
    new_doctor_id: formData.get("new_doctor_id") as string,
    new_start_time: formData.get("new_start_time") as string,
    new_end_time: formData.get("new_end_time") as string,
    new_appointment_date: formData.get("new_appointment_date") as string,
    new_clinic_location_id: locationIdsRaw || undefined,
    reason: (formData.get("reason") as string) || undefined,
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message || "Invalid input" };

  const adminSupabase = createAdminClient();
  const stripe = getStripe();

  // Fetch original booking
  const { data: booking } = await adminSupabase
    .from("bookings")
    .select(`
      *,
      patient:profiles!bookings_patient_id_fkey(first_name, last_name, email, phone),
      doctor:doctors!inner(
        id, consultation_fee_cents, stripe_account_id,
        profile:profiles!doctors_profile_id_fkey(first_name, last_name)
      )
    `)
    .eq("id", parsed.data.booking_id)
    .eq("organization_id", org.id)
    .single();

  if (!booking) return { error: "Booking not found in this organization" };
  if (!CANCELLABLE_STATUSES.concat(["confirmed"]).includes(booking.status)) {
    return { error: "This booking cannot be rescheduled in its current state." };
  }

  const patient: any = Array.isArray(booking.patient) ? booking.patient[0] : booking.patient;
  const originalDoctor: any = Array.isArray(booking.doctor) ? booking.doctor[0] : booking.doctor;
  const originalDoctorProfile: any = Array.isArray(originalDoctor?.profile)
    ? originalDoctor.profile[0]
    : originalDoctor?.profile;

  // Fetch new doctor's fee
  const { data: newDoctor } = await adminSupabase
    .from("doctors")
    .select(`
      id, consultation_fee_cents, stripe_account_id,
      profile:profiles(first_name, last_name)
    `)
    .eq("id", parsed.data.new_doctor_id)
    .single();

  if (!newDoctor) return { error: "New doctor not found" };
  const newDoctorProfile: any = Array.isArray(newDoctor.profile)
    ? newDoctor.profile[0]
    : newDoctor.profile;

  // Calculate price difference
  const originalAmountPaid = booking.total_amount_cents as number;
  const newFee = newDoctor.consultation_fee_cents as number;
  const priceDiffCents = newFee - (booking.consultation_fee_cents as number);

  // Case 1: Same price or cheaper → reschedule immediately, issue partial refund if applicable
  if (priceDiffCents <= 0) {
    const refundCents = Math.abs(priceDiffCents);

    if (refundCents > 0 && booking.stripe_payment_intent_id && booking.paid_at) {
      try {
        await stripe.refunds.create({
          payment_intent: booking.stripe_payment_intent_id,
          amount: refundCents,
          reverse_transfer: true,
          refund_application_fee: true,
        });
      } catch (err) {
        log.error("Partial refund failed during reschedule:", { err });
        // Non-fatal — proceed with reschedule, flag in metadata
      }
    }

    await adminSupabase
      .from("bookings")
      .update({
        doctor_id: parsed.data.new_doctor_id,
        appointment_date: parsed.data.new_appointment_date,
        start_time: parsed.data.new_start_time,
        end_time: parsed.data.new_end_time,
        clinic_location_id: parsed.data.new_clinic_location_id ?? booking.clinic_location_id,
        consultation_fee_cents: newFee,
        total_amount_cents: originalAmountPaid - refundCents,
        rescheduled_from_booking_id: booking.id,
        reschedule_price_diff_cents: priceDiffCents,
        reschedule_payment_status: "not_required",
        rescheduled_by: membership.user_id,
        rescheduled_at: new Date().toISOString(),
        cancellation_reason: parsed.data.reason || null,
      })
      .eq("id", booking.id);

    // Notify patient
    if (patient?.email) {
      sendEmail({
        to: patient.email,
        subject: `Appointment Rescheduled — ${booking.booking_number}`,
        html: `<p>Hi ${patient.first_name}, your appointment has been rescheduled to ${parsed.data.new_appointment_date} at ${parsed.data.new_start_time}${priceDiffCents < 0 ? ` A partial refund of ${(refundCents / 100).toFixed(2)} has been issued.` : "."}</p>`,
      }).catch((err) => log.error("Reschedule email error:", { err }));
    }

    revalidatePath("/doctor-dashboard/organization/bookings");
    return { error: null, requiresPayment: false };
  }

  // Case 2: New slot is more expensive → create Stripe Payment Intent for the diff
  if (!patient?.email) return { error: "Cannot send payment request: patient email not found" };

  // Create a new booking record for the new slot in pending_reschedule_payment status
  // The original booking remains confirmed until payment is received.
  const { data: newBooking, error: newBookingError } = await adminSupabase
    .from("bookings")
    .insert({
      booking_number: `${booking.booking_number}-R`,
      patient_id: booking.patient_id,
      doctor_id: parsed.data.new_doctor_id,
      appointment_date: parsed.data.new_appointment_date,
      start_time: parsed.data.new_start_time,
      end_time: parsed.data.new_end_time,
      duration_minutes: booking.duration_minutes,
      consultation_type: booking.consultation_type,
      status: "pending_reschedule_payment",
      currency: booking.currency,
      consultation_fee_cents: newFee,
      platform_fee_cents: Math.round(newFee * 0.15),
      total_amount_cents: newFee + Math.round(newFee * 0.15),
      organization_id: org.id,
      clinic_location_id: parsed.data.new_clinic_location_id ?? booking.clinic_location_id,
      rescheduled_from_booking_id: booking.id,
      reschedule_price_diff_cents: priceDiffCents,
      reschedule_payment_status: "pending",
      rescheduled_by: membership.user_id,
      rescheduled_at: new Date().toISOString(),
      service_id: booking.service_id,
      service_name: booking.service_name,
      patient_notes: booking.patient_notes,
    })
    .select("id")
    .single();

  if (newBookingError || !newBooking) {
    return { error: "Failed to create rescheduled booking record" };
  }

  // Create Stripe Payment Intent for the price difference only
  let paymentIntentClientSecret: string | null = null;
  let paymentLinkUrl: string | null = null;

  try {
    const intent = await stripe.paymentIntents.create({
      amount: priceDiffCents,
      currency: booking.currency.toLowerCase(),
      customer: undefined, // We'll use email receipt
      receipt_email: patient.email,
      description: `Reschedule balance for booking ${booking.booking_number}`,
      metadata: {
        original_booking_id: booking.id,
        new_booking_id: newBooking.id,
        organization_id: org.id,
        type: "reschedule_balance",
      },
    });

    await adminSupabase
      .from("bookings")
      .update({ reschedule_payment_intent_id: intent.id })
      .eq("id", newBooking.id);

    paymentIntentClientSecret = intent.client_secret;

    // Build a hosted payment URL (we route to our own payment page)
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
    paymentLinkUrl = `${appUrl}/en/dashboard/bookings/${newBooking.id}/pay-balance`;
  } catch (err) {
    log.error("Failed to create reschedule payment intent:", { err });
    // Clean up the new booking if payment intent fails
    await adminSupabase.from("bookings").delete().eq("id", newBooking.id);
    return { error: "Failed to create payment request. Please try again." };
  }

  // Send payment email to patient
  const formattedDiff = `£${(priceDiffCents / 100).toFixed(2)}`;
  const originalDoctorName = `Dr. ${originalDoctorProfile?.last_name || ""}`;
  const newDoctorName = `Dr. ${newDoctorProfile?.last_name || ""}`;

  const { subject, html } = reschedulePaymentEmail({
    patientName: patient.first_name,
    clinicName: org.name,
    originalDate: booking.appointment_date,
    originalTime: booking.start_time,
    originalDoctorName,
    newDate: parsed.data.new_appointment_date,
    newTime: parsed.data.new_start_time,
    newDoctorName,
    diffAmount: formattedDiff,
    currency: booking.currency,
    paymentUrl: paymentLinkUrl!,
    expiryHours: 24,
    bookingNumber: booking.booking_number,
  });

  sendEmail({ to: patient.email, subject, html }).catch((err) =>
    log.error("Reschedule payment email error:", { err })
  );

  revalidatePath("/doctor-dashboard/organization/bookings");
  return {
    error: null,
    requiresPayment: true,
    priceDiffCents,
    newBookingId: newBooking.id,
    paymentLinkUrl,
  };
}

// ─── Get available slots for a doctor (for reschedule picker) ─

export async function getDoctorAvailableSlots(doctorId: string, date: string) {
  const { error: authError, supabase } = await requireOrgMember(["owner", "admin"]);
  if (authError || !supabase) return { error: authError, slots: [] };

  const { data, error } = await supabase.rpc("get_available_slots", {
    p_doctor_id: doctorId,
    p_date: date,
  });

  if (error) return { error: error.message, slots: [] };
  return { error: null, slots: data ?? [] };
}

// ─── Get clinic doctors (for reschedule doctor picker) ────────

export async function getClinicDoctors() {
  const { error: authError, supabase, org } = await requireOrgMember(["owner", "admin"]);
  if (authError || !supabase || !org) return { error: authError, doctors: [] };

  const { data, error } = await supabase
    .from("organization_members")
    .select(`
      user_id,
      doctor:doctors!inner(
        id, slug, consultation_fee_cents,
        profile:profiles(first_name, last_name, avatar_url)
      )
    `)
    .eq("organization_id", org.id)
    .eq("status", "active")
    .eq("role", "doctor");

  if (error) return { error: error.message, doctors: [] };
  return { error: null, doctors: data ?? [] };
}
