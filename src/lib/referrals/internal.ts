import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import { sendEmail } from "@/lib/email/client";
import {
  doctorReferralInvitationEmail,
  referralRewardEmail,
} from "@/lib/email/templates";
import { createNotification } from "@/lib/notifications";
import { getStripe } from "@/lib/stripe/client";
import { log } from "@/lib/utils/logger";

/**
 * Referral side effects used by signup and the Stripe webhook.
 * Kept out of the server-action module so a browser cannot invoke them.
 */

const REFERRAL_COUPON_ID = "REFERRAL_1MO_FREE";

async function getAppUrl(): Promise<string> {
  try {
    const { getRequestOrigin } = await import("@/lib/http/origin");
    return getRequestOrigin();
  } catch {
    const { getConfiguredAppOrigin } = await import("@/lib/http/origin");
    return getConfiguredAppOrigin();
  }
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
  const appUrl = await getAppUrl();
  const signUpUrl = `${appUrl}/en/register-doctor?ref=${referralCode}`;
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
  referredEmail: string,
  /** Cold link ?ref=CODE — attributes signup when no prior invite row exists */
  referralCode?: string
) {
  const adminSupabase = createAdminClient();
  const email = referredEmail.toLowerCase().trim();

  // 1) Prior invite email match
  let { data: referral } = await adminSupabase
    .from("doctor_referrals")
    .select("id, referrer_doctor_id")
    .eq("referred_email", email)
    .eq("status", "invited")
    .maybeSingle();

  // 2) Cold ?ref= referral code → find referrer and upsert referral row
  if (!referral && referralCode) {
    const code = referralCode.trim().toUpperCase();
    const { data: referrer } = await adminSupabase
      .from("doctors")
      .select("id")
      .eq("referral_code", code)
      .maybeSingle();

    if (referrer && referrer.id !== referredDoctorId) {
      const { data: created } = await adminSupabase
        .from("doctor_referrals")
        .insert({
          referrer_doctor_id: referrer.id,
          referred_email: email,
          referred_doctor_id: referredDoctorId,
          status: "signed_up",
          signed_up_at: new Date().toISOString(),
          invitation_sent_at: null,
        })
        .select("id, referrer_doctor_id")
        .single();
      referral = created;
    }
  }

  if (!referral) return; // No referral found — not an error

  // Update invite row with the new doctor's ID (email path)
  if (referral) {
    await adminSupabase
      .from("doctor_referrals")
      .update({
        referred_doctor_id: referredDoctorId,
        status: "signed_up",
        signed_up_at: new Date().toISOString(),
      })
      .eq("id", referral.id);
  }

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
      message: `A colleague you invited has joined MyDoctors360. They'll need to subscribe for both of you to earn your free month.`,
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

    // Apply coupon to referring doctor's license subscription
    const { data: referrerDoctor } = await adminSupabase
      .from("doctors")
      .select("organization_id")
      .eq("id", referral.referrer_doctor_id)
      .single();

    const { data: referrerLicense } = referrerDoctor?.organization_id
      ? await adminSupabase
          .from("licenses")
          .select("stripe_subscription_id, status")
          .eq("organization_id", referrerDoctor.organization_id)
          .in("status", ["active", "trialing"])
          .maybeSingle()
      : { data: null };

    if (referrerLicense?.stripe_subscription_id) {
      await stripe.subscriptions.update(referrerLicense.stripe_subscription_id, {
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
    log.error("[Referral] Failed to apply Stripe coupon:", { err: err });
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

