"use server";
import { safeError } from "@/lib/utils/safe-error";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getStripe } from "@/lib/stripe/client";
import { revalidatePath } from "next/cache";
import crypto from "crypto";

export async function updateProfile(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { error: "Not authenticated" };

  const firstName = formData.get("first_name") as string;
  const lastName = formData.get("last_name") as string;
  const phone = formData.get("phone") as string;
  const preferredLocale = formData.get("preferred_locale") as string;
  const preferredCurrency = formData.get("preferred_currency") as string;

  const updates: Record<string, unknown> = {};
  if (firstName) updates.first_name = firstName;
  if (lastName) updates.last_name = lastName;
  if (phone !== undefined) updates.phone = phone || null;
  if (preferredLocale) updates.preferred_locale = preferredLocale;
  if (preferredCurrency) updates.preferred_currency = preferredCurrency;

  const { error } = await supabase
    .from("profiles")
    .update(updates)
    .eq("id", user.id);

  if (error) return { error: safeError(error) };

  revalidatePath("/dashboard/settings");
  return { success: true };
}

export async function changePassword(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { error: "Not authenticated" };

  const newPassword = formData.get("new_password") as string;
  const confirmPassword = formData.get("confirm_password") as string;

  if (!newPassword || newPassword.length < 8) {
    return { error: "Password must be at least 8 characters" };
  }

  if (newPassword !== confirmPassword) {
    return { error: "Passwords do not match" };
  }

  const { error } = await supabase.auth.updateUser({
    password: newPassword,
  });

  if (error) return { error: safeError(error) };

  return { success: true };
}

// ---------------------------------------------------------------------------
// GDPR Data Export (Article 20 — Right to Data Portability)
// ---------------------------------------------------------------------------
export async function exportPatientData() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const [
    profile,
    bookings,
    reviews,
    favorites,
    notifications,
    treatmentPlans,
    medicalProfile,
    referrals,
    conversations,
    messages,
    familyDependents,
    prescriptions,
    pushSubscriptions,
    cookieConsent,
  ] = await Promise.all([
    supabase.from("profiles").select("*").eq("id", user.id).single(),
    supabase.from("bookings").select("*").eq("patient_id", user.id),
    supabase.from("reviews").select("*").eq("patient_id", user.id),
    supabase.from("favorites").select("*").eq("patient_id", user.id),
    supabase.from("notifications").select("*").eq("user_id", user.id),
    supabase.from("treatment_plans").select("*").eq("patient_id", user.id),
    supabase
      .from("medical_profiles")
      .select("*")
      .eq("patient_id", user.id)
      .maybeSingle(),
    supabase
      .from("patient_referrals")
      .select("*")
      .eq("referrer_id", user.id),
    supabase.from("conversations").select("*").eq("patient_id", user.id),
    supabase.from("direct_messages").select("*").eq("sender_id", user.id),
    supabase.from("family_dependents").select("*").eq("patient_id", user.id),
    supabase.from("prescriptions").select("*").eq("patient_id", user.id),
    supabase.from("push_subscriptions").select("*").eq("user_id", user.id),
    supabase
      .from("cookie_consents")
      .select("*")
      .eq("user_id", user.id)
      .maybeSingle(),
  ]);

  return {
    data: {
      exported_at: new Date().toISOString(),
      format_version: "1.0",
      profile: profile.data,
      medical_profile: medicalProfile.data || null,
      bookings: bookings.data || [],
      reviews: reviews.data || [],
      favorites: favorites.data || [],
      treatment_plans: treatmentPlans.data || [],
      prescriptions: prescriptions.data || [],
      conversations: conversations.data || [],
      messages_sent: messages.data || [],
      family_dependents: familyDependents.data || [],
      referrals: referrals.data || [],
      notifications: notifications.data || [],
      push_subscriptions: pushSubscriptions.data || [],
      cookie_consent: cookieConsent.data || null,
    },
  };
}

// ---------------------------------------------------------------------------
// Account Deletion (Article 17 — Right to Erasure)
// ---------------------------------------------------------------------------
export async function requestAccountDeletion() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  // Check for active bookings that would block deletion
  const { data: activeBookings } = await supabase
    .from("bookings")
    .select("id")
    .eq("patient_id", user.id)
    .in("status", ["confirmed", "approved", "pending_payment", "pending_approval"])
    .limit(1);

  if (activeBookings && activeBookings.length > 0) {
    return {
      error:
        "You have active bookings. Please cancel them before deleting your account.",
    };
  }

  const adminClient = createAdminClient();

  // Clean up related data before auth user deletion
  // (Some tables have ON DELETE CASCADE, but we handle non-cascading ones explicitly)
  await Promise.allSettled([
    // Anonymize reviews (keep content for doctor, remove patient identity)
    adminClient
      .from("reviews")
      .update({ patient_id: null })
      .eq("patient_id", user.id),
    // Remove push subscriptions
    adminClient
      .from("push_subscriptions")
      .delete()
      .eq("user_id", user.id),
    // Remove cookie consent
    adminClient
      .from("cookie_consents")
      .delete()
      .eq("user_id", user.id),
    // Soft-delete bookings (keep for doctor records, anonymize patient)
    adminClient
      .from("bookings")
      .update({ patient_notes: null })
      .eq("patient_id", user.id)
      .in("status", ["completed", "cancelled_patient", "cancelled_doctor", "no_show"]),
  ]);

  // Delete auth user — this cascades to profiles, which cascades to
  // favorites, medical_profiles, notifications, conversations, etc.
  const { error } = await adminClient.auth.admin.deleteUser(user.id);

  if (error)
    return { error: "Failed to delete account. Please contact support." };

  return { success: true };
}

// ---------------------------------------------------------------------------
// Saved Payment Methods
// ---------------------------------------------------------------------------
export async function getPatientPaymentMethods() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { methods: [], error: null };

  // Patient bookings store stripe_payment_intent_id but not customer id directly.
  // We look up the payment intent from the most recent paid booking to find the customer.
  const { data: booking } = await supabase
    .from("bookings")
    .select("stripe_payment_intent_id")
    .eq("patient_id", user.id)
    .not("stripe_payment_intent_id", "is", null)
    .order("created_at", { ascending: false })
    .limit(1)
    .single();

  if (!booking?.stripe_payment_intent_id) return { methods: [], error: null };

  try {
    const stripe = getStripe();

    // Retrieve the customer from the payment intent
    const paymentIntent = await stripe.paymentIntents.retrieve(
      booking.stripe_payment_intent_id
    );

    const customerId = paymentIntent.customer as string | null;
    if (!customerId) return { methods: [], error: null };

    const paymentMethods = await stripe.customers.listPaymentMethods(
      customerId,
      { type: "card", limit: 10 }
    );

    return {
      methods: paymentMethods.data.map((pm) => ({
        id: pm.id,
        brand: pm.card?.brand || "unknown",
        last4: pm.card?.last4 || "****",
        expMonth: pm.card?.exp_month || 0,
        expYear: pm.card?.exp_year || 0,
      })),
      error: null,
    };
  } catch (err) {
    console.error("Failed to fetch payment methods:", err);
    return { methods: [], error: null }; // Fail silently
  }
}

// ---------------------------------------------------------------------------
// Referral Code
// ---------------------------------------------------------------------------
export async function getOrCreateReferralCode() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { code: null, error: "Not authenticated" };

  // Check existing
  const { data: existing } = await supabase
    .from("patient_referrals")
    .select("referral_code")
    .eq("referrer_id", user.id)
    .limit(1)
    .single();

  if (existing) return { code: existing.referral_code, error: null };

  // Generate new code
  const code = `REF-${crypto.randomBytes(4).toString("hex").toUpperCase()}`;

  const { error } = await supabase.from("patient_referrals").insert({
    referrer_id: user.id,
    referral_code: code,
    status: "pending",
  });

  if (error) return { code: null, error: "Failed to create referral code" };
  return { code, error: null };
}

// ---------------------------------------------------------------------------
// Patient Referral List & Stats
// ---------------------------------------------------------------------------
export async function getPatientReferrals() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user)
    return {
      referrals: [],
      stats: {
        total: 0,
        signedUp: 0,
        booked: 0,
        credited: 0,
        totalCredits: 0,
      },
      error: null,
    };

  const { data: referrals } = await supabase
    .from("patient_referrals")
    .select("*")
    .eq("referrer_id", user.id)
    .order("created_at", { ascending: false });

  const allReferrals = referrals || [];
  const stats = {
    total: allReferrals.length,
    signedUp: allReferrals.filter(
      (r: { status: string }) => r.status === "signed_up"
    ).length,
    booked: allReferrals.filter(
      (r: { status: string }) => r.status === "booked"
    ).length,
    credited: allReferrals.filter(
      (r: { status: string }) => r.status === "credited"
    ).length,
    totalCredits: allReferrals
      .filter((r: { status: string }) => r.status === "credited")
      .reduce(
        (sum: number, r: { credit_amount_cents: number }) =>
          sum + r.credit_amount_cents,
        0
      ),
  };

  return { referrals: allReferrals, stats, error: null };
}
