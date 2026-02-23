"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

async function requireDoctor() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated", supabase: null, doctor: null };

  const { data: doctor } = await supabase
    .from("doctors")
    .select("*")
    .eq("profile_id", user.id)
    .single();

  if (!doctor) return { error: "Not a doctor", supabase: null, doctor: null };
  return { error: null, supabase, doctor };
}

export async function updateDoctorProfile(formData: FormData) {
  const { error: authError, supabase, doctor } = await requireDoctor();
  if (authError || !supabase || !doctor) return { error: authError };

  const updates: Record<string, unknown> = {};

  const title = formData.get("title") as string;
  if (title !== null) updates.title = title;

  const bio = formData.get("bio") as string;
  if (bio !== null) updates.bio = bio;

  const experience = formData.get("years_of_experience") as string;
  if (experience) updates.years_of_experience = parseInt(experience, 10);

  const clinicName = formData.get("clinic_name") as string;
  if (clinicName !== null) updates.clinic_name = clinicName;

  const address = formData.get("address") as string;
  if (address !== null) updates.address = address;

  const fee = formData.get("consultation_fee_cents") as string;
  if (fee) updates.consultation_fee_cents = parseInt(fee, 10);

  const videoFee = formData.get("video_consultation_fee_cents") as string;
  if (videoFee) updates.video_consultation_fee_cents = parseInt(videoFee, 10);

  const cancellationPolicy = formData.get("cancellation_policy") as string;
  if (cancellationPolicy) updates.cancellation_policy = cancellationPolicy;

  const cancellationHours = formData.get("cancellation_hours") as string;
  if (cancellationHours) updates.cancellation_hours = parseInt(cancellationHours, 10);

  const { error } = await supabase
    .from("doctors")
    .update(updates)
    .eq("id", doctor.id);

  if (error) return { error: error.message };

  revalidatePath("/doctor-dashboard/profile");
  return { success: true };
}

export async function updateAvailabilitySchedule(formData: FormData) {
  const { error: authError, supabase, doctor } = await requireDoctor();
  if (authError || !supabase || !doctor) return { error: authError };

  const id = formData.get("id") as string;
  const dayOfWeek = parseInt(formData.get("day_of_week") as string, 10);
  const startTime = formData.get("start_time") as string;
  const endTime = formData.get("end_time") as string;
  const slotDuration = parseInt(formData.get("slot_duration_minutes") as string, 10);
  const consultationType = formData.get("consultation_type") as string;

  const data = {
    doctor_id: doctor.id,
    day_of_week: dayOfWeek,
    start_time: startTime,
    end_time: endTime,
    slot_duration_minutes: slotDuration,
    consultation_type: consultationType || "both",
  };

  if (id) {
    const { error } = await supabase
      .from("availability_schedules")
      .update(data)
      .eq("id", id)
      .eq("doctor_id", doctor.id);
    if (error) return { error: error.message };
  } else {
    const { error } = await supabase
      .from("availability_schedules")
      .insert(data);
    if (error) return { error: error.message };
  }

  revalidatePath("/doctor-dashboard/calendar");
  return { success: true };
}

export async function deleteAvailabilitySchedule(scheduleId: string) {
  const { error: authError, supabase, doctor } = await requireDoctor();
  if (authError || !supabase || !doctor) return { error: authError };

  const { error } = await supabase
    .from("availability_schedules")
    .delete()
    .eq("id", scheduleId)
    .eq("doctor_id", doctor.id);

  if (error) return { error: error.message };

  revalidatePath("/doctor-dashboard/calendar");
  return { success: true };
}

export async function addAvailabilityOverride(formData: FormData) {
  const { error: authError, supabase, doctor } = await requireDoctor();
  if (authError || !supabase || !doctor) return { error: authError };

  const overrideDate = formData.get("override_date") as string;
  const isBlocked = formData.get("is_blocked") === "true";
  const startTime = formData.get("start_time") as string;
  const endTime = formData.get("end_time") as string;

  const { error } = await supabase.from("availability_overrides").insert({
    doctor_id: doctor.id,
    override_date: overrideDate,
    is_blocked: isBlocked,
    start_time: isBlocked ? null : startTime,
    end_time: isBlocked ? null : endTime,
  });

  if (error) return { error: error.message };

  revalidatePath("/doctor-dashboard/calendar");
  return { success: true };
}

export async function updateBookingStatus(
  bookingId: string,
  status: string,
  reason?: string
) {
  const { error: authError, supabase, doctor } = await requireDoctor();
  if (authError || !supabase || !doctor) return { error: authError };

  const updateData: Record<string, unknown> = { status };
  if (status === "completed") {
    updateData.completed_at = new Date().toISOString();
  }
  if (reason) {
    updateData.cancellation_reason = reason;
    updateData.cancelled_at = new Date().toISOString();
  }

  const { error } = await supabase
    .from("bookings")
    .update(updateData)
    .eq("id", bookingId)
    .eq("doctor_id", doctor.id);

  if (error) return { error: error.message };

  revalidatePath("/doctor-dashboard/bookings");
  return { success: true };
}

export async function connectStripeAccount() {
  const { error: authError, supabase, doctor } = await requireDoctor();
  if (authError || !supabase || !doctor) return { error: authError };

  const { stripe } = await import("@/lib/stripe/client");

  let accountId = doctor.stripe_account_id;

  if (!accountId) {
    const account = await stripe.accounts.create({
      type: "express",
      metadata: { doctor_id: doctor.id },
    });
    accountId = account.id;

    await supabase
      .from("doctors")
      .update({ stripe_account_id: accountId })
      .eq("id", doctor.id);
  }

  const accountLink = await stripe.accountLinks.create({
    account: accountId,
    refresh_url: `${process.env.NEXT_PUBLIC_APP_URL}/en/doctor-dashboard/payments`,
    return_url: `${process.env.NEXT_PUBLIC_APP_URL}/en/doctor-dashboard/payments`,
    type: "account_onboarding",
  });

  return { url: accountLink.url };
}

export async function createSubscriptionCheckout(priceId: string) {
  const { error: authError, supabase, doctor } = await requireDoctor();
  if (authError || !supabase || !doctor) return { error: authError };

  const { stripe } = await import("@/lib/stripe/client");

  // Get or create Stripe customer
  const { data: existingSub } = await supabase
    .from("doctor_subscriptions")
    .select("stripe_customer_id")
    .eq("doctor_id", doctor.id)
    .single();

  let customerId = existingSub?.stripe_customer_id;

  if (!customerId) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("email, first_name, last_name")
      .eq("id", doctor.profile_id)
      .single();

    const customer = await stripe.customers.create({
      email: profile?.email,
      name: `${profile?.first_name} ${profile?.last_name}`,
      metadata: { doctor_id: doctor.id },
    });
    customerId = customer.id;
  }

  const session = await stripe.checkout.sessions.create({
    customer: customerId,
    mode: "subscription",
    line_items: [{ price: priceId, quantity: 1 }],
    metadata: { doctor_id: doctor.id },
    success_url: `${process.env.NEXT_PUBLIC_APP_URL}/en/doctor-dashboard/subscription?success=true`,
    cancel_url: `${process.env.NEXT_PUBLIC_APP_URL}/en/doctor-dashboard/subscription`,
  });

  return { url: session.url };
}
