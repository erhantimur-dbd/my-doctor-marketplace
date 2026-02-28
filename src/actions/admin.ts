"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { subscriptionUpgradeInviteEmail } from "@/lib/email/templates";
import { createNotification } from "@/lib/notifications";

// Admin email allowlist — mirrors middleware check for defense-in-depth
const ADMIN_EMAILS = (process.env.ADMIN_EMAILS || "")
  .split(",")
  .map((e) => e.trim().toLowerCase())
  .filter(Boolean);

async function requireAdmin() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated", supabase: null, user: null };

  // Check email allowlist (if configured)
  if (
    ADMIN_EMAILS.length > 0 &&
    !ADMIN_EMAILS.includes(user.email?.toLowerCase() || "")
  ) {
    return { error: "Not authorized", supabase: null, user: null };
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (profile?.role !== "admin")
    return { error: "Not authorized", supabase: null, user: null };

  return { error: null, supabase, user };
}

async function logAdminAction(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  action: string,
  targetType: string,
  targetId: string,
  metadata?: Record<string, unknown>
) {
  await supabase.from("audit_log").insert({
    actor_id: userId,
    action,
    target_type: targetType,
    target_id: targetId,
    metadata: metadata || {},
  });
}

export async function updateDoctorVerification(
  doctorId: string,
  status: string
) {
  const { error: authError, supabase, user } = await requireAdmin();
  if (authError || !supabase || !user) return { error: authError };

  const updateData: Record<string, unknown> = {
    verification_status: status,
  };
  if (status === "verified") {
    updateData.verified_at = new Date().toISOString();
  }

  const { error } = await supabase
    .from("doctors")
    .update(updateData)
    .eq("id", doctorId);

  if (error) return { error: error.message };

  await logAdminAction(supabase, user.id, `doctor_verification_${status}`, "doctor", doctorId);

  revalidatePath("/admin/doctors");
  return { success: true };
}

export async function toggleDoctorActive(doctorId: string, isActive: boolean) {
  const { error: authError, supabase, user } = await requireAdmin();
  if (authError || !supabase || !user) return { error: authError };

  const { error } = await supabase
    .from("doctors")
    .update({ is_active: isActive })
    .eq("id", doctorId);

  if (error) return { error: error.message };

  await logAdminAction(supabase, user.id, isActive ? "doctor_activated" : "doctor_deactivated", "doctor", doctorId);

  revalidatePath("/admin/doctors");
  return { success: true };
}

export async function toggleDoctorFeatured(
  doctorId: string,
  isFeatured: boolean
) {
  const { error: authError, supabase, user } = await requireAdmin();
  if (authError || !supabase || !user) return { error: authError };

  const updateData: Record<string, unknown> = {
    is_featured: isFeatured,
  };
  if (isFeatured) {
    const featuredUntil = new Date();
    featuredUntil.setDate(featuredUntil.getDate() + 30);
    updateData.featured_until = featuredUntil.toISOString();
  } else {
    updateData.featured_until = null;
  }

  const { error } = await supabase
    .from("doctors")
    .update(updateData)
    .eq("id", doctorId);

  if (error) return { error: error.message };

  await logAdminAction(supabase, user.id, isFeatured ? "doctor_featured" : "doctor_unfeatured", "doctor", doctorId);

  revalidatePath("/admin/doctors");
  return { success: true };
}

export async function approveReview(reviewId: string) {
  const { error: authError, supabase, user } = await requireAdmin();
  if (authError || !supabase || !user) return { error: authError };

  const { error } = await supabase
    .from("reviews")
    .update({ is_visible: true })
    .eq("id", reviewId);

  if (error) return { error: error.message };

  await logAdminAction(supabase, user.id, "review_approved", "review", reviewId);

  revalidatePath("/admin/reviews");
  return { success: true };
}

export async function hideReview(reviewId: string) {
  const { error: authError, supabase, user } = await requireAdmin();
  if (authError || !supabase || !user) return { error: authError };

  const { error } = await supabase
    .from("reviews")
    .update({ is_visible: false })
    .eq("id", reviewId);

  if (error) return { error: error.message };

  await logAdminAction(supabase, user.id, "review_hidden", "review", reviewId);

  revalidatePath("/admin/reviews");
  return { success: true };
}

/** @deprecated Use hideReview instead */
export async function deleteReview(reviewId: string) {
  return hideReview(reviewId);
}

export async function updatePlatformSetting(key: string, value: string) {
  const { error: authError, supabase, user } = await requireAdmin();
  if (authError || !supabase || !user) return { error: authError };

  const { error } = await supabase
    .from("platform_settings")
    .upsert({ key, value, updated_at: new Date().toISOString() });

  if (error) return { error: error.message };

  await logAdminAction(supabase, user.id, "setting_updated", "platform_setting", key, { value });

  revalidatePath("/admin/settings");
  return { success: true };
}

export async function sendUpgradeInvite(doctorId: string) {
  const { error: authError, supabase, user } = await requireAdmin();
  if (authError || !supabase || !user) return { error: authError };

  // Fetch doctor with profile
  const { data: doctor } = await supabase
    .from("doctors")
    .select("id, profile:profiles!doctors_profile_id_fkey(id, first_name, last_name, email)")
    .eq("id", doctorId)
    .single();

  if (!doctor) return { error: "Doctor not found" };

  // Check they don't already have an active subscription
  const { data: activeSub } = await supabase
    .from("doctor_subscriptions")
    .select("id, plan_id")
    .eq("doctor_id", doctorId)
    .in("status", ["active", "trialing", "past_due"])
    .limit(1)
    .maybeSingle();

  if (activeSub) return { error: "Doctor already has an active subscription" };

  const profile: any = Array.isArray(doctor.profile) ? doctor.profile[0] : doctor.profile;
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

  const { subject, html } = subscriptionUpgradeInviteEmail({
    doctorName: `${profile.first_name} ${profile.last_name}`,
    subscriptionUrl: `${appUrl}/en/doctor-dashboard/subscription`,
  });

  // Send in-app notification + email
  await createNotification({
    userId: profile.id,
    type: "subscription_upgrade_invite",
    title: "Upgrade to Professional",
    message: "Unlock the full suite of tools to manage your practice and reach more patients.",
    channels: ["in_app", "email"],
    metadata: { invitedBy: user.id, plan: "professional" },
    email: { to: profile.email, subject, html },
  });

  await logAdminAction(supabase, user.id, "subscription_upgrade_invite_sent", "doctor", doctorId, { plan: "professional" });

  revalidatePath("/admin/doctors");
  return { success: true };
}

// ===================== Coupon Management =====================

export async function createCoupon(data: {
  code: string;
  name: string;
  description?: string;
  discount_type: "percentage" | "fixed_amount";
  discount_value: number;
  currency?: string;
  applicable_plans?: string[] | null;
  duration?: "once" | "repeating" | "forever";
  duration_in_months?: number;
  max_uses?: number | null;
  valid_from?: string;
  expires_at?: string | null;
}) {
  const { error: authError, supabase, user } = await requireAdmin();
  if (authError || !supabase || !user) return { error: authError };

  const code = data.code.toUpperCase().trim();
  if (!code || code.length < 3) return { error: "Code must be at least 3 characters" };

  if (data.discount_type === "percentage" && (data.discount_value < 1 || data.discount_value > 100)) {
    return { error: "Percentage must be between 1 and 100" };
  }
  if (data.discount_type === "fixed_amount" && data.discount_value < 1) {
    return { error: "Amount must be positive" };
  }

  // Check uniqueness
  const { data: existing } = await supabase
    .from("coupons")
    .select("id")
    .eq("code", code)
    .maybeSingle();
  if (existing) return { error: "A coupon with this code already exists" };

  // Create Stripe coupon
  const { getStripe } = await import("@/lib/stripe/client");
  const stripe = getStripe();

  const stripeCouponParams: Record<string, unknown> = {
    name: data.name,
    duration: data.duration || "once",
  };
  if (data.discount_type === "percentage") {
    stripeCouponParams.percent_off = data.discount_value;
  } else {
    stripeCouponParams.amount_off = data.discount_value;
    stripeCouponParams.currency = (data.currency || "eur").toLowerCase();
  }
  if (data.duration === "repeating" && data.duration_in_months) {
    stripeCouponParams.duration_in_months = data.duration_in_months;
  }
  if (data.max_uses) {
    stripeCouponParams.max_redemptions = data.max_uses;
  }
  if (data.expires_at) {
    stripeCouponParams.redeem_by = Math.floor(new Date(data.expires_at).getTime() / 1000);
  }

  let stripeCoupon;
  try {
    stripeCoupon = await stripe.coupons.create(stripeCouponParams as any);
  } catch (err: any) {
    return { error: `Stripe error: ${err.message}` };
  }

  // Insert into DB
  const { error: insertError } = await supabase.from("coupons").insert({
    code,
    name: data.name,
    description: data.description || null,
    discount_type: data.discount_type,
    discount_value: data.discount_value,
    currency: data.currency || "EUR",
    applicable_plans: data.applicable_plans || null,
    duration: data.duration || "once",
    duration_in_months: data.duration_in_months || null,
    max_uses: data.max_uses || null,
    valid_from: data.valid_from || new Date().toISOString(),
    expires_at: data.expires_at || null,
    is_active: true,
    stripe_coupon_id: stripeCoupon.id,
    created_by: user.id,
  });

  if (insertError) return { error: insertError.message };

  await logAdminAction(supabase, user.id, "coupon_created", "coupon", code, {
    name: data.name,
    discount_type: data.discount_type,
    discount_value: data.discount_value,
  });

  revalidatePath("/admin/coupons");
  return { success: true };
}

export async function toggleCouponActive(couponId: string, isActive: boolean) {
  const { error: authError, supabase, user } = await requireAdmin();
  if (authError || !supabase || !user) return { error: authError };

  const { error } = await supabase
    .from("coupons")
    .update({ is_active: isActive })
    .eq("id", couponId);

  if (error) return { error: error.message };

  await logAdminAction(
    supabase,
    user.id,
    isActive ? "coupon_activated" : "coupon_deactivated",
    "coupon",
    couponId
  );

  revalidatePath("/admin/coupons");
  return { success: true };
}

export async function deleteCoupon(couponId: string) {
  const { error: authError, supabase, user } = await requireAdmin();
  if (authError || !supabase || !user) return { error: authError };

  const { data: coupon } = await supabase
    .from("coupons")
    .select("stripe_coupon_id, code")
    .eq("id", couponId)
    .single();

  if (!coupon) return { error: "Coupon not found" };

  // Delete from Stripe
  if (coupon.stripe_coupon_id) {
    try {
      const { getStripe } = await import("@/lib/stripe/client");
      await getStripe().coupons.del(coupon.stripe_coupon_id);
    } catch (err) {
      console.error("[Coupon] Failed to delete Stripe coupon:", err);
    }
  }

  // Soft delete — deactivate to preserve redemption history
  const { error } = await supabase
    .from("coupons")
    .update({ is_active: false })
    .eq("id", couponId);

  if (error) return { error: error.message };

  await logAdminAction(supabase, user.id, "coupon_deleted", "coupon", couponId, {
    code: coupon.code,
  });

  revalidatePath("/admin/coupons");
  return { success: true };
}
