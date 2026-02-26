"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { revalidatePath } from "next/cache";
import { sendEmail } from "@/lib/email/client";
import {
  doctorReferralInvitationEmail,
  referralRewardEmail,
} from "@/lib/email/templates";
import { createNotification } from "@/lib/notifications";
import { getStripe } from "@/lib/stripe/client";

const APP_URL =
  process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

// Stripe coupon ID for referral rewards (100% off for 1 billing period)
const REFERRAL_COUPON_ID = "REFERRAL_1MO_FREE";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function getCurrentDoctor() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: doctor } = await supabase
    .from("doctors")
    .select("id, referral_code, profile:profiles!doctors_profile_id_fkey(first_name, last_name)")
    .eq("profile_id", user.id)
    .single();

  return doctor;
}

// ---------------------------------------------------------------------------
// Validate referral code (used during registration)
// ---------------------------------------------------------------------------

export async function validateReferralCode(code: string) {
  if (!code || code.length < 4) return { valid: false, referrerName: null };

  const adminSupabase = createAdminClient();
  const { data: doctor } = await adminSupabase
    .from("doctors")
    .select(
      "id, profile:profiles!doctors_profile_id_fkey(first_name, last_name)"
    )
    .eq("referral_code", code.toUpperCase().trim())
    .single();

  if (!doctor) return { valid: false, referrerName: null };

  const profile: any = Array.isArray(doctor.profile)
    ? doctor.profile[0]
    : doctor.profile;

  return {
    valid: true,
    referrerName: profile
      ? `Dr. ${profile.first_name} ${profile.last_name}`
      : "A colleague",
  };
}

// ---------------------------------------------------------------------------
// Send referral invitation (from dashboard or registration)
// ---------------------------------------------------------------------------

export async function sendReferralInvitation(formData: FormData) {
  const colleagueName = (formData.get("colleague_name") as string)?.trim();
  const colleagueEmail = (formData.get("colleague_email") as string)
    ?.trim()
    .toLowerCase();

  if (!colleagueEmail) {
    return { error: "Colleague email is required" };
  }

  // Email format validation
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(colleagueEmail)) {
    return { error: "Please enter a valid email address" };
  }

  const doctor = await getCurrentDoctor();
  if (!doctor) return { error: "Not authenticated as a doctor" };

  const profile: any = Array.isArray(doctor.profile)
    ? doctor.profile[0]
    : doctor.profile;
  const referrerName = profile
    ? `Dr. ${profile.first_name} ${profile.last_name}`
    : "A colleague";

  const supabase = await createClient();

  // Check if this email was already invited by this doctor
  const { data: existing } = await supabase
    .from("doctor_referrals")
    .select("id, status")
    .eq("referrer_doctor_id", doctor.id)
    .eq("referred_email", colleagueEmail)
    .maybeSingle();

  if (existing && ["invited", "signed_up"].includes(existing.status)) {
    return { error: "You have already invited this colleague" };
  }

  // Create referral record
  const { error: insertError } = await supabase
    .from("doctor_referrals")
    .insert({
      referrer_doctor_id: doctor.id,
      referred_email: colleagueEmail,
      referred_name: colleagueName || null,
      status: "invited",
      invitation_sent_at: new Date().toISOString(),
    });

  if (insertError) {
    // If unique constraint violation, this email already has a pending invite from someone
    if (insertError.code === "23505") {
      return { error: "This email already has a pending invitation" };
    }
    return { error: insertError.message };
  }

  // Send invitation email
  const signUpUrl = `${APP_URL}/en/register-doctor?ref=${doctor.referral_code}`;
  const { subject, html } = doctorReferralInvitationEmail({
    referrerName,
    colleagueName: colleagueName || "",
    referralCode: doctor.referral_code,
    signUpUrl,
  });

  await sendEmail({ to: colleagueEmail, subject, html });

  revalidatePath("/doctor-dashboard/referrals");
  return { success: true };
}

// ---------------------------------------------------------------------------
// Send referral invitation during registration (uses admin client)
// ---------------------------------------------------------------------------

export async function sendReferralInvitationAtRegistration(
  doctorId: string,
  referralCode: string,
  referrerName: string,
  colleagueName: string,
  colleagueEmail: string
) {
  const adminSupabase = createAdminClient();

  // Create referral record
  await adminSupabase.from("doctor_referrals").insert({
    referrer_doctor_id: doctorId,
    referred_email: colleagueEmail.toLowerCase().trim(),
    referred_name: colleagueName || null,
    status: "invited",
    invitation_sent_at: new Date().toISOString(),
  });

  // Send invitation email
  const signUpUrl = `${APP_URL}/en/register-doctor?ref=${referralCode}`;
  const { subject, html } = doctorReferralInvitationEmail({
    referrerName,
    colleagueName,
    referralCode,
    signUpUrl,
  });

  await sendEmail({ to: colleagueEmail, subject, html });
}

// ---------------------------------------------------------------------------
// Process referral when referred doctor signs up
// ---------------------------------------------------------------------------

export async function processReferralSignup(
  referredDoctorId: string,
  referredEmail: string
) {
  const adminSupabase = createAdminClient();

  // Find pending referral for this email
  const { data: referral } = await adminSupabase
    .from("doctor_referrals")
    .select("id, referrer_doctor_id")
    .eq("referred_email", referredEmail.toLowerCase().trim())
    .eq("status", "invited")
    .maybeSingle();

  if (!referral) return; // No referral found — not an error

  // Update referral with the new doctor's ID
  await adminSupabase
    .from("doctor_referrals")
    .update({
      referred_doctor_id: referredDoctorId,
      status: "signed_up",
      signed_up_at: new Date().toISOString(),
    })
    .eq("id", referral.id);

  // Notify the referring doctor
  const { data: referrerDoctor } = await adminSupabase
    .from("doctors")
    .select("profile_id")
    .eq("id", referral.referrer_doctor_id)
    .single();

  if (referrerDoctor) {
    await createNotification({
      userId: referrerDoctor.profile_id,
      type: "referral_signup",
      title: "Your colleague signed up!",
      message: `A colleague you invited has joined MyDoctor. They'll need to subscribe for both of you to earn your free month.`,
      channels: ["in_app"],
    });
  }
}

// ---------------------------------------------------------------------------
// Process referral reward when referred doctor subscribes
// ---------------------------------------------------------------------------

export async function processReferralReward(referredDoctorId: string) {
  const adminSupabase = createAdminClient();

  // Find referral for this doctor
  const { data: referral } = await adminSupabase
    .from("doctor_referrals")
    .select(
      `id, referrer_doctor_id, referrer_rewarded, referred_rewarded,
       referrer:doctors!doctor_referrals_referrer_doctor_id_fkey(
         profile_id,
         profile:profiles!doctors_profile_id_fkey(first_name, last_name)
       )`
    )
    .eq("referred_doctor_id", referredDoctorId)
    .eq("status", "signed_up")
    .maybeSingle();

  if (!referral) return; // No pending referral

  // Update status to subscribed
  await adminSupabase
    .from("doctor_referrals")
    .update({
      status: "subscribed",
      subscribed_at: new Date().toISOString(),
    })
    .eq("id", referral.id);

  // Try to apply reward to the referring doctor's Stripe subscription
  try {
    const stripe = getStripe();

    // Ensure the coupon exists (create if not)
    try {
      await stripe.coupons.retrieve(REFERRAL_COUPON_ID);
    } catch {
      await stripe.coupons.create({
        id: REFERRAL_COUPON_ID,
        percent_off: 100,
        duration: "once",
        name: "Referral Program - 1 Month Free",
      });
    }

    // Apply coupon to referring doctor's subscription
    const { data: referrerSub } = await adminSupabase
      .from("doctor_subscriptions")
      .select("stripe_subscription_id, status")
      .eq("doctor_id", referral.referrer_doctor_id)
      .in("status", ["active", "trialing"])
      .maybeSingle();

    if (referrerSub?.stripe_subscription_id) {
      await stripe.subscriptions.update(referrerSub.stripe_subscription_id, {
        discounts: [{ coupon: REFERRAL_COUPON_ID }],
      });

      await adminSupabase
        .from("doctor_referrals")
        .update({
          referrer_rewarded: true,
          status: "rewarded",
          rewarded_at: new Date().toISOString(),
        })
        .eq("id", referral.id);
    }
  } catch (err) {
    console.error("[Referral] Failed to apply Stripe coupon:", err);
  }

  // Get referred doctor name for notification
  const { data: referredDoctor } = await adminSupabase
    .from("doctors")
    .select(
      "profile:profiles!doctors_profile_id_fkey(first_name, last_name)"
    )
    .eq("id", referredDoctorId)
    .single();

  const referredProfile: any = referredDoctor
    ? Array.isArray(referredDoctor.profile)
      ? referredDoctor.profile[0]
      : referredDoctor.profile
    : null;

  const referredName = referredProfile
    ? `Dr. ${referredProfile.first_name} ${referredProfile.last_name}`
    : "Your colleague";

  // Notify referring doctor
  const referrer: any = Array.isArray(referral.referrer)
    ? referral.referrer[0]
    : referral.referrer;

  if (referrer) {
    const referrerProfile: any = Array.isArray(referrer.profile)
      ? referrer.profile[0]
      : referrer.profile;

    const referrerName = referrerProfile
      ? referrerProfile.first_name
      : "Doctor";

    // Send reward notification email
    const { subject, html } = referralRewardEmail({
      doctorName: referrerName,
      referredDoctorName: referredName,
    });

    // Get referrer's email from their profile
    const { data: referrerFullProfile } = await adminSupabase
      .from("profiles")
      .select("email")
      .eq("id", referrer.profile_id)
      .single();

    if (referrerFullProfile?.email) {
      await sendEmail({ to: referrerFullProfile.email, subject, html });
    }

    await createNotification({
      userId: referrer.profile_id,
      type: "referral_reward",
      title: "Referral Reward Earned!",
      message: `${referredName} subscribed! Your 1-month free reward has been applied.`,
      channels: ["in_app"],
    });
  }
}

// ---------------------------------------------------------------------------
// Get current doctor's referrals (for dashboard)
// ---------------------------------------------------------------------------

export async function getMyReferrals() {
  const doctor = await getCurrentDoctor();
  if (!doctor) return { referrals: [], stats: null, referralCode: null };

  const supabase = await createClient();
  const { data: referrals } = await supabase
    .from("doctor_referrals")
    .select("*")
    .eq("referrer_doctor_id", doctor.id)
    .order("created_at", { ascending: false });

  const all = referrals || [];
  const stats = {
    totalInvited: all.length,
    signedUp: all.filter((r: any) =>
      ["signed_up", "subscribed", "rewarded"].includes(r.status)
    ).length,
    subscribed: all.filter((r: any) =>
      ["subscribed", "rewarded"].includes(r.status)
    ).length,
    rewarded: all.filter((r: any) => r.status === "rewarded").length,
  };

  return {
    referrals: all,
    stats,
    referralCode: doctor.referral_code,
  };
}

// ---------------------------------------------------------------------------
// Check if doctor has pending referral discount for checkout
// ---------------------------------------------------------------------------

export async function checkReferralDiscount(doctorId: string) {
  const adminSupabase = createAdminClient();
  const { data: referral } = await adminSupabase
    .from("doctor_referrals")
    .select("id")
    .eq("referred_doctor_id", doctorId)
    .in("status", ["signed_up", "subscribed"])
    .eq("referred_rewarded", false)
    .maybeSingle();

  if (!referral) return { hasDiscount: false, referralId: null };

  return { hasDiscount: true, referralId: referral.id };
}

// ---------------------------------------------------------------------------
// Mark referred doctor's reward as applied
// ---------------------------------------------------------------------------

export async function markReferredRewarded(referralId: string) {
  const adminSupabase = createAdminClient();
  await adminSupabase
    .from("doctor_referrals")
    .update({ referred_rewarded: true })
    .eq("id", referralId);
}
