import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getStripe } from "@/lib/stripe/client";
import { authorizeCronRequest } from "@/lib/cron/authorize";
import { BOOKING_STATUSES } from "@/lib/constants/booking-status";
import { log } from "@/lib/utils/logger";

/**
 * Soft-expire unpaid bookings. Never hard-delete pending_payment rows —
 * a late Checkout completion would otherwise charge with no booking left.
 */
export async function GET(request: NextRequest) {
  const denied = authorizeCronRequest(request);
  if (denied) return denied;

  const supabase = createAdminClient();
  const stripe = getStripe();

  // 1. Patient-created bookings: soft-expire pending_payment older than 15 minutes
  const patientExpiryTime = new Date(Date.now() - 15 * 60 * 1000).toISOString();

  const { data: patientPending, error: patientSelectError } = await supabase
    .from("bookings")
    .select("id, stripe_checkout_session_id")
    .eq("status", BOOKING_STATUSES.PENDING_PAYMENT)
    .is("created_by_admin_id", null)
    .lt("created_at", patientExpiryTime);

  let patientExpiredCount = 0;
  if (patientPending && patientPending.length > 0) {
    for (const booking of patientPending) {
      if (booking.stripe_checkout_session_id) {
        try {
          await stripe.checkout.sessions.expire(
            booking.stripe_checkout_session_id
          );
        } catch {
          // Session may already be expired or completed
        }
      }
    }

    const ids = patientPending.map((b) => b.id);
    const { data: expired, error: patientError } = await supabase
      .from("bookings")
      .update({ status: BOOKING_STATUSES.EXPIRED })
      .in("id", ids)
      .eq("status", BOOKING_STATUSES.PENDING_PAYMENT)
      .select("id");

    if (patientError) {
      log.error("cleanup-expired patient soft-expire failed", {
        err: patientError,
      });
    }
    patientExpiredCount = expired?.length || 0;
  }

  // 2. Admin-created bookings: soft-expire where payment_link_expires_at passed
  const now = new Date().toISOString();

  const { data: adminExpired, error: adminError } = await supabase
    .from("bookings")
    .select("id, stripe_checkout_session_id")
    .eq("status", BOOKING_STATUSES.PENDING_PAYMENT)
    .not("created_by_admin_id", "is", null)
    .lt("payment_link_expires_at", now);

  let adminExpiredCount = 0;
  if (adminExpired && adminExpired.length > 0) {
    for (const booking of adminExpired) {
      if (booking.stripe_checkout_session_id) {
        try {
          await stripe.checkout.sessions.expire(
            booking.stripe_checkout_session_id
          );
        } catch {
          // Session may already be expired
        }
      }
    }

    const ids = adminExpired.map((b) => b.id);
    const { data: expired } = await supabase
      .from("bookings")
      .update({ status: BOOKING_STATUSES.EXPIRED })
      .in("id", ids)
      .eq("status", BOOKING_STATUSES.PENDING_PAYMENT)
      .select("id");

    adminExpiredCount = expired?.length || 0;
  }

  return NextResponse.json({
    patient_expired: patientExpiredCount,
    admin_expired: adminExpiredCount,
    patient_error: patientSelectError?.message || null,
    admin_error: adminError?.message || null,
  });
}
