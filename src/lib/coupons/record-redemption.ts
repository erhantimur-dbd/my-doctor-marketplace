import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { log } from "@/lib/utils/logger";

/**
 * Writes a coupon redemption with the service role. Not a server action:
 * a browser must not be able to increment current_uses.
 * Called from doctor checkout after the session is created for that doctor.
 */
export async function recordCouponRedemption(
  couponId: string,
  doctorId: string,
  planId: string,
  stripeCheckoutSessionId?: string
) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  const { data: doctor } = await supabase
    .from("doctors")
    .select("id")
    .eq("profile_id", user.id)
    .eq("id", doctorId)
    .maybeSingle();
  if (!doctor) return;

  const adminSupabase = createAdminClient();

  const { error: insertError } = await adminSupabase
    .from("coupon_redemptions")
    .insert({
      coupon_id: couponId,
      doctor_id: doctor.id,
      plan_id: planId,
      stripe_checkout_session_id: stripeCheckoutSessionId || null,
    });

  if (insertError) {
    log.error("[Coupon] Failed to record redemption:", { err: insertError });
    return;
  }

  await adminSupabase.rpc("increment_coupon_uses", {
    p_coupon_id: couponId,
  });
}
