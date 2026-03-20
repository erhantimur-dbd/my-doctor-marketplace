"use server";

import { createClient } from "@/lib/supabase/server";
import { getStripe } from "@/lib/stripe/client";

/**
 * Returns the PaymentIntent client secret for a pending reschedule-balance booking.
 * Only the owning patient may call this.
 */
export async function getReschedulePaymentIntent(bookingId: string): Promise<{
  clientSecret: string | null;
  booking: {
    booking_number: string;
    appointment_date: string;
    start_time: string;
    end_time: string;
    consultation_type: string;
    reschedule_price_diff_cents: number;
    currency: string;
    doctor_name: string;
    original_booking_id: string | null;
    original_date: string | null;
    original_time: string | null;
    original_doctor_name: string | null;
  } | null;
  error: string | null;
}> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { clientSecret: null, booking: null, error: "Not authenticated" };

  // Fetch the booking — must belong to this patient and be in pending state
  const { data: raw, error: fetchErr } = await supabase
    .from("bookings")
    .select(`
      id,
      booking_number,
      patient_id,
      doctor_id,
      appointment_date,
      start_time,
      end_time,
      consultation_type,
      reschedule_price_diff_cents,
      reschedule_payment_intent_id,
      reschedule_payment_status,
      rescheduled_from_booking_id,
      currency,
      status,
      doctor:doctors!inner(
        profile:profiles!doctors_profile_id_fkey(first_name, last_name)
      )
    `)
    .eq("id", bookingId)
    .eq("patient_id", user.id)
    .single();

  if (fetchErr || !raw) {
    return { clientSecret: null, booking: null, error: "Booking not found" };
  }

  if (raw.status !== "pending_reschedule_payment") {
    return {
      clientSecret: null,
      booking: null,
      error:
        raw.reschedule_payment_status === "paid"
          ? "This payment has already been completed."
          : "This payment link is no longer active.",
    };
  }

  if (!raw.reschedule_payment_intent_id) {
    return { clientSecret: null, booking: null, error: "Payment details not found." };
  }

  // Retrieve the PaymentIntent from Stripe to get the client_secret
  const stripe = getStripe();
  let clientSecret: string | null = null;
  try {
    const intent = await stripe.paymentIntents.retrieve(raw.reschedule_payment_intent_id);
    if (intent.status === "canceled") {
      return { clientSecret: null, booking: null, error: "This payment link has expired." };
    }
    if (intent.status === "succeeded") {
      return {
        clientSecret: null,
        booking: null,
        error: "Payment already received. Your appointment is confirmed.",
      };
    }
    clientSecret = intent.client_secret;
  } catch {
    return { clientSecret: null, booking: null, error: "Failed to load payment details." };
  }

  // Resolve doctor name
  const doctorRaw: any = Array.isArray(raw.doctor) ? raw.doctor[0] : raw.doctor;
  const doctorProfileRaw: any = doctorRaw?.profile
    ? Array.isArray(doctorRaw.profile) ? doctorRaw.profile[0] : doctorRaw.profile
    : null;
  const doctorName = doctorProfileRaw
    ? `${doctorProfileRaw.first_name} ${doctorProfileRaw.last_name}`
    : "Your doctor";

  // Optionally fetch original booking details for "before/after" display
  let originalDate: string | null = null;
  let originalTime: string | null = null;
  let originalDoctorName: string | null = null;

  if (raw.rescheduled_from_booking_id) {
    const { data: orig } = await supabase
      .from("bookings")
      .select(`
        appointment_date,
        start_time,
        doctor:doctors!inner(
          profile:profiles!doctors_profile_id_fkey(first_name, last_name)
        )
      `)
      .eq("id", raw.rescheduled_from_booking_id)
      .single();

    if (orig) {
      originalDate = orig.appointment_date;
      originalTime = orig.start_time;
      const origDoc: any = Array.isArray(orig.doctor) ? orig.doctor[0] : orig.doctor;
      const origProf: any = origDoc?.profile
        ? Array.isArray(origDoc.profile) ? origDoc.profile[0] : origDoc.profile
        : null;
      originalDoctorName = origProf
        ? `${origProf.first_name} ${origProf.last_name}`
        : null;
    }
  }

  return {
    clientSecret,
    booking: {
      booking_number: raw.booking_number,
      appointment_date: raw.appointment_date,
      start_time: raw.start_time,
      end_time: raw.end_time,
      consultation_type: raw.consultation_type,
      reschedule_price_diff_cents: raw.reschedule_price_diff_cents || 0,
      currency: raw.currency,
      doctor_name: doctorName,
      original_booking_id: raw.rescheduled_from_booking_id ?? null,
      original_date: originalDate,
      original_time: originalTime,
      original_doctor_name: originalDoctorName,
    },
    error: null,
  };
}
