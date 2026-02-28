"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function validateCoupon(code: string, planId: string) {
  if (!code || code.trim().length < 3) {
    return { valid: false as const, error: "Invalid coupon code" };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { valid: false as const, error: "Not authenticated" };

  // Get doctor ID
  const { data: doctor } = await supabase
    .from("doctors")
    .select("id")
    .eq("profile_id", user.id)
    .single();
  if (!doctor) return { valid: false as const, error: "Not a doctor" };

  const adminSupabase = createAdminClient();

  const { data: coupon } = await adminSupabase
    .from("coupons")
    .select("*")
    .eq("code", code.toUpperCase().trim())
    .eq("is_active", true)
    .single();

  if (!coupon) return { valid: false as const, error: "Coupon not found or inactive" };

  // Check expiry
  if (coupon.expires_at && new Date(coupon.expires_at) < new Date()) {
    return { valid: false as const, error: "This coupon has expired" };
  }

  // Check valid_from
  if (new Date(coupon.valid_from) > new Date()) {
    return { valid: false as const, error: "This coupon is not yet active" };
  }

  // Check max uses
  if (coupon.max_uses !== null && coupon.current_uses >= coupon.max_uses) {
    return { valid: false as const, error: "This coupon has reached its usage limit" };
  }

  // Check applicable plans
  if (coupon.applicable_plans && !coupon.applicable_plans.includes(planId)) {
    return {
      valid: false as const,
      error: `This coupon is only valid for: ${coupon.applicable_plans.join(", ")}`,
    };
  }

  // Check if this doctor already used this coupon
  const { data: existingRedemption } = await adminSupabase
    .from("coupon_redemptions")
    .select("id")
    .eq("coupon_id", coupon.id)
    .eq("doctor_id", doctor.id)
    .maybeSingle();

  if (existingRedemption) {
    return { valid: false as const, error: "You have already used this coupon" };
  }

  return {
    valid: true as const,
    couponId: coupon.id,
    stripeCouponId: coupon.stripe_coupon_id,
    discount_type: coupon.discount_type as "percentage" | "fixed_amount",
    discount_value: coupon.discount_value as number,
    currency: coupon.currency as string,
    name: coupon.name as string,
    duration: coupon.duration as string,
    duration_in_months: coupon.duration_in_months as number | null,
  };
}

export async function recordCouponRedemption(
  couponId: string,
  doctorId: string,
  planId: string,
  stripeCheckoutSessionId?: string
) {
  const adminSupabase = createAdminClient();

  // Insert redemption record
  const { error: insertError } = await adminSupabase
    .from("coupon_redemptions")
    .insert({
      coupon_id: couponId,
      doctor_id: doctorId,
      plan_id: planId,
      stripe_checkout_session_id: stripeCheckoutSessionId || null,
    });

  if (insertError) {
    console.error("[Coupon] Failed to record redemption:", insertError);
    return;
  }

  // Increment current_uses atomically
  await adminSupabase.rpc("increment_coupon_uses", {
    p_coupon_id: couponId,
  });
}
