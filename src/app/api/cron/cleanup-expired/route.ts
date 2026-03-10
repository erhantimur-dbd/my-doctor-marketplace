import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getStripe } from "@/lib/stripe/client";

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createAdminClient();

  // 1. Patient-created bookings: delete pending_payment older than 15 minutes
  const patientExpiryTime = new Date(Date.now() - 15 * 60 * 1000).toISOString();

  const { data: patientExpired, error: patientError } = await supabase
    .from("bookings")
    .delete()
    .eq("status", "pending_payment")
    .is("created_by_admin_id", null)
    .lt("created_at", patientExpiryTime)
    .select("id");

  // 2. Admin-created bookings: delete pending_payment where payment_link_expires_at has passed
  const now = new Date().toISOString();

  const { data: adminExpired, error: adminError } = await supabase
    .from("bookings")
    .select("id, stripe_checkout_session_id")
    .eq("status", "pending_payment")
    .not("created_by_admin_id", "is", null)
    .lt("payment_link_expires_at", now);

  let adminDeletedCount = 0;
  if (adminExpired && adminExpired.length > 0) {
    // Expire any active Stripe sessions
    for (const booking of adminExpired) {
      if (booking.stripe_checkout_session_id) {
        try {
          await getStripe().checkout.sessions.expire(booking.stripe_checkout_session_id);
        } catch {
          // Session may already be expired
        }
      }
    }

    const ids = adminExpired.map((b) => b.id);
    const { data: deleted } = await supabase
      .from("bookings")
      .delete()
      .in("id", ids)
      .select("id");

    adminDeletedCount = deleted?.length || 0;
  }

  return NextResponse.json({
    patient_expired: patientExpired?.length || 0,
    admin_expired: adminDeletedCount,
    patient_error: patientError?.message || null,
    admin_error: adminError?.message || null,
  });
}
