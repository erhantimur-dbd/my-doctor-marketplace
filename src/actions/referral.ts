"use server";
import { safeError } from "@/lib/utils/safe-error";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { revalidatePath } from "next/cache";
import { sendEmail } from "@/lib/email/client";
import { doctorReferralInvitationEmail } from "@/lib/email/templates";
import { log } from "@/lib/utils/logger";

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
    return { error: safeError(insertError) };
  }

  // Send invitation email (same TLD as referrer)
  const appUrl = await getAppUrl();
  const signUpUrl = `${appUrl}/en/register-doctor?ref=${doctor.referral_code}`;
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
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { hasDiscount: false, referralId: null };

  const { data: doctor } = await supabase
    .from("doctors")
    .select("id")
    .eq("profile_id", user.id)
    .eq("id", doctorId)
    .maybeSingle();
  if (!doctor) return { hasDiscount: false, referralId: null };

  const adminSupabase = createAdminClient();
  const { data: referral } = await adminSupabase
    .from("doctor_referrals")
    .select("id")
    .eq("referred_doctor_id", doctor.id)
    .in("status", ["signed_up", "subscribed"])
    .eq("referred_rewarded", false)
    .maybeSingle();

  if (!referral) return { hasDiscount: false, referralId: null };

  return { hasDiscount: true, referralId: referral.id };
}

// ---------------------------------------------------------------------------
// Patient Referral: Send email invitation
// ---------------------------------------------------------------------------

export async function sendPatientReferralInvite(email: string) {
  const emailLower = email?.trim().toLowerCase();
  if (!emailLower) return { error: "Email is required" };

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(emailLower)) return { error: "Please enter a valid email address" };

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  // Get user's name for the invite email
  const { data: profile } = await supabase
    .from("profiles")
    .select("first_name, last_name")
    .eq("id", user.id)
    .single();

  const referrerName = profile
    ? `${profile.first_name} ${profile.last_name}`
    : "A friend";

  // Get or create referral code
  const { data: existing } = await supabase
    .from("patient_referrals")
    .select("referral_code")
    .eq("referrer_id", user.id)
    .limit(1)
    .single();

  if (!existing?.referral_code) return { error: "Failed to get referral code" };

  // Check if already invited this email
  const { data: alreadyInvited } = await supabase
    .from("patient_referrals")
    .select("id")
    .eq("referrer_id", user.id)
    .eq("referred_email", emailLower)
    .maybeSingle();

  if (alreadyInvited) return { error: "You've already invited this person" };

  // Create a new referral record for this invite
  await supabase.from("patient_referrals").insert({
    referrer_id: user.id,
    referral_code: existing.referral_code,
    referred_email: emailLower,
    status: "pending",
  });

  // Send invitation email
  const { patientReferralInviteEmail } = await import("@/lib/email/templates");
  const appUrl = await getAppUrl();
  const referralLink = `${appUrl}/en/register?ref=${existing.referral_code}`;
  const { subject, html } = patientReferralInviteEmail({
    referrerName,
    referralLink,
  });

  await sendEmail({ to: emailLower, subject, html });

  revalidatePath("/dashboard/referrals");
  return { success: true };
}
