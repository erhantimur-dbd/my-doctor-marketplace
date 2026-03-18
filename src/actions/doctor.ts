"use server";
import { safeError } from "@/lib/utils/safe-error";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import type Stripe from "stripe";
import { log } from "@/lib/utils/logger";

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

/**
 * Org-aware version of requireDoctor().
 * Returns the doctor, their organization, license, and membership info.
 * Falls back gracefully when org is not yet set up (migration transition).
 */
export async function requireDoctorWithOrg() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user)
    return {
      error: "Not authenticated" as string | null,
      supabase: null as Awaited<ReturnType<typeof createClient>> | null,
      doctor: null as Record<string, unknown> | null,
      org: null as Record<string, unknown> | null,
      license: null as Record<string, unknown> | null,
      membership: null as Record<string, unknown> | null,
    };

  const { data: doctor } = await supabase
    .from("doctors")
    .select("*")
    .eq("profile_id", user.id)
    .single();

  if (!doctor)
    return { error: "Not a doctor", supabase: null, doctor: null, org: null, license: null, membership: null };

  let org: Record<string, unknown> | null = null;
  let license: Record<string, unknown> | null = null;
  let membership: Record<string, unknown> | null = null;

  if (doctor.organization_id) {
    const { data: orgData } = await supabase
      .from("organizations")
      .select("*")
      .eq("id", doctor.organization_id)
      .single();
    org = orgData;

    const { data: mem } = await supabase
      .from("organization_members")
      .select("*")
      .eq("organization_id", doctor.organization_id)
      .eq("user_id", user.id)
      .eq("status", "active")
      .single();
    membership = mem;

    const { data: lic } = await supabase
      .from("licenses")
      .select("*")
      .eq("organization_id", doctor.organization_id)
      .in("status", ["active", "trialing", "past_due", "grace_period"])
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    license = lic;
  }

  return { error: null, supabase, doctor, org, license, membership };
}

export async function updateDoctorProfile(formData: FormData) {
  const { error: authError, supabase, doctor } = await requireDoctor();
  if (authError || !supabase || !doctor) return { error: authError };

  if (doctor.verification_status === "verified") {
    return { error: "Your profile is locked after GMC verification. Please open a support ticket to request changes." };
  }

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

  const city = formData.get("city") as string;
  if (city !== null) updates.city = city;

  const postalCode = formData.get("postal_code") as string;
  if (postalCode !== null) updates.postal_code = postalCode;

  const fee = formData.get("consultation_fee_cents") as string;
  if (fee) updates.consultation_fee_cents = parseInt(fee, 10);

  const videoFee = formData.get("video_consultation_fee_cents") as string;
  if (videoFee) updates.video_consultation_fee_cents = parseInt(videoFee, 10);

  const cancellationPolicy = formData.get("cancellation_policy") as string;
  if (cancellationPolicy) updates.cancellation_policy = cancellationPolicy;

  const cancellationHours = formData.get("cancellation_hours") as string;
  if (cancellationHours) updates.cancellation_hours = parseInt(cancellationHours, 10);

  const depositType = formData.get("in_person_deposit_type") as string;
  if (depositType && ["none", "percentage", "flat"].includes(depositType)) {
    updates.in_person_deposit_type = depositType;
    if (depositType === "none") {
      updates.in_person_deposit_value = null;
    } else {
      const depositValue = formData.get("in_person_deposit_value") as string;
      if (depositValue) {
        updates.in_person_deposit_value = parseInt(depositValue, 10);
      }
    }
  }

  const { error } = await supabase
    .from("doctors")
    .update(updates)
    .eq("id", doctor.id);

  if (error) return { error: safeError(error) };

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
    if (error) return { error: safeError(error) };
  } else {
    const { error } = await supabase
      .from("availability_schedules")
      .insert(data);
    if (error) return { error: safeError(error) };
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

  if (error) return { error: safeError(error) };

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

  if (error) return { error: safeError(error) };

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

  if (error) return { error: safeError(error) };

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

// ---------------------------------------------------------------------------
// Reminder Preferences
// ---------------------------------------------------------------------------

export interface ReminderPreference {
  id?: string;
  minutes_before: number;
  channel: "email" | "in_app";
  is_enabled: boolean;
}

export async function getDoctorReminderPreferences(): Promise<{
  data?: ReminderPreference[];
  error?: string;
}> {
  const { error: authError, supabase, doctor } = await requireDoctor();
  if (authError || !supabase || !doctor) return { error: authError || "Not authorized" };

  const { data, error } = await supabase
    .from("doctor_reminder_preferences")
    .select("id, minutes_before, channel, is_enabled")
    .eq("doctor_id", doctor.id)
    .order("minutes_before", { ascending: false });

  if (error) return { error: safeError(error) };
  return { data: data as ReminderPreference[] };
}

export async function saveDoctorReminderPreferences(
  prefs: ReminderPreference[]
): Promise<{ success?: boolean; error?: string }> {
  const { error: authError, supabase, doctor } = await requireDoctor();
  if (authError || !supabase || !doctor) return { error: authError || "Not authorized" };

  // Delete existing preferences and re-insert (atomic replace)
  const { error: deleteError } = await supabase
    .from("doctor_reminder_preferences")
    .delete()
    .eq("doctor_id", doctor.id);

  if (deleteError) return { error: safeError(deleteError) };

  if (prefs.length > 0) {
    const rows = prefs.map((p) => ({
      doctor_id: doctor.id,
      minutes_before: p.minutes_before,
      channel: p.channel,
      is_enabled: p.is_enabled,
    }));

    const { error: insertError } = await supabase
      .from("doctor_reminder_preferences")
      .insert(rows);

    if (insertError) return { error: safeError(insertError) };
  }

  revalidatePath("/doctor-dashboard/settings");
  return { success: true };
}

export async function createSubscriptionCheckout(priceId: string, couponCode?: string) {
  const { error: authError, supabase, doctor } = await requireDoctor();
  if (authError || !supabase || !doctor) return { error: authError };

  const { stripe } = await import("@/lib/stripe/client");

  // Get or create Stripe customer — check licenses (org-based) first
  let customerId: string | null = null;

  if (doctor.organization_id) {
    const { data: license } = await supabase
      .from("licenses")
      .select("stripe_customer_id")
      .eq("organization_id", doctor.organization_id)
      .in("status", ["active", "trialing", "past_due"])
      .limit(1)
      .maybeSingle();
    customerId = license?.stripe_customer_id ?? null;
  }

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

  // Check for referral discount
  const { checkReferralDiscount, markReferredRewarded } = await import(
    "@/actions/referral"
  );
  const { hasDiscount, referralId } = await checkReferralDiscount(doctor.id);

  // Build checkout session options
  const sessionOptions: Stripe.Checkout.SessionCreateParams = {
    customer: customerId,
    mode: "subscription",
    line_items: [{ price: priceId, quantity: 1 }],
    metadata: { doctor_id: doctor.id },
    success_url: `${process.env.NEXT_PUBLIC_APP_URL}/en/doctor-dashboard/organization/billing?success=true`,
    cancel_url: `${process.env.NEXT_PUBLIC_APP_URL}/en/doctor-dashboard/organization/billing`,
  };

  // Apply manual coupon code (if provided and no referral discount)
  let appliedCouponId: string | null = null;

  if (couponCode && !hasDiscount) {
    const { validateCoupon } = await import("@/actions/coupon");
    // Determine planId from priceId
    const planId = priceId === process.env.STRIPE_PRICE_PROFESSIONAL
      ? "professional"
      : priceId === process.env.STRIPE_PRICE_STARTER
        ? "starter"
        : priceId === process.env.STRIPE_PRICE_CLINIC
          ? "clinic"
          : "unknown";

    const validation = await validateCoupon(couponCode, planId);

    if (validation.valid && validation.stripeCouponId) {
      sessionOptions.discounts = [{ coupon: validation.stripeCouponId }];
      appliedCouponId = validation.couponId;
    }
  }

  // Apply referral coupon if eligible (and no manual coupon applied)
  if (hasDiscount && !appliedCouponId) {
    try {
      // Ensure coupon exists in Stripe
      const stripeClient = (await import("@/lib/stripe/client")).getStripe();
      try {
        await stripeClient.coupons.retrieve("REFERRAL_1MO_FREE");
      } catch {
        await stripeClient.coupons.create({
          id: "REFERRAL_1MO_FREE",
          percent_off: 100,
          duration: "once",
          name: "Referral Program - 1 Month Free",
        });
      }
      sessionOptions.discounts = [{ coupon: "REFERRAL_1MO_FREE" }];
      // Mark the referred doctor's reward as applied
      if (referralId) await markReferredRewarded(referralId);
    } catch (err) {
      log.error("[Referral] Failed to apply checkout discount:", { err: err });
    }
  }

  const session = await stripe.checkout.sessions.create(sessionOptions);

  // Record coupon redemption if applied
  if (appliedCouponId) {
    const { recordCouponRedemption } = await import("@/actions/coupon");
    const planId = priceId === process.env.STRIPE_PRICE_PROFESSIONAL
      ? "professional"
      : priceId === process.env.STRIPE_PRICE_STARTER
        ? "starter"
        : priceId === process.env.STRIPE_PRICE_CLINIC
          ? "clinic"
          : "unknown";
    await recordCouponRedemption(appliedCouponId, doctor.id, planId, session.id);
  }

  return { url: session.url };
}
