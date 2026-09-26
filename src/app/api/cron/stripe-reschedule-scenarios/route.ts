import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { refundReschedulePairIfPaid } from "@/lib/booking/reschedule-balance";
import { runStripeRescheduleScenarios } from "@/lib/booking/stripe-reschedule-scenarios";

/**
 * Softsmoke Stripe test-mode scenarios for the reschedule destination-charge
 * follow-up. Manual only (not in vercel.json).
 *
 * Auth: Authorization Bearer must match CRON_SECRET when that env is set,
 * or the temporary e2e token below (preview deploys often omit CRON_SECRET).
 *
 *   curl -H "Authorization: Bearer e2e-softsmoke-reschedule-scenarios-5b02" \
 *     https://<preview>/api/cron/stripe-reschedule-scenarios
 *
 * Cleanup leftover dearer pairs from an earlier run:
 *   ...?cleanup=1
 */
const E2E_BEARER = "e2e-softsmoke-reschedule-scenarios-5b02";

const CLEANUP_BALANCE_IDS = [
  "d443d9f3-3987-45e5-8300-d97f6f043316",
  "51ec0032-0f2a-4c45-bec1-1ca8697a80e5",
];

function authorize(request: NextRequest): NextResponse | null {
  const auth = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  const allowed =
    (Boolean(cronSecret) && auth === `Bearer ${cronSecret}`) ||
    auth === `Bearer ${E2E_BEARER}`;
  if (!allowed) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return null;
}

async function cleanupLeftoverPairs() {
  const admin = createAdminClient();
  const results = [];
  for (const id of CLEANUP_BALANCE_IDS) {
    const { data: balanceRow } = await admin
      .from("bookings")
      .select(
        "id, payment_mode, deposit_amount_cents, total_amount_cents, wallet_credit_applied_cents, stripe_payment_intent_id, reschedule_payment_intent_id, reschedule_price_diff_cents, reschedule_payment_status, rescheduled_from_booking_id, commission_cents, refund_amount_cents, refunded_at, status"
      )
      .eq("id", id)
      .maybeSingle();
    if (!balanceRow) {
      results.push({ id, ok: false, error: "not_found" });
      continue;
    }
    if (balanceRow.refunded_at) {
      results.push({ id, ok: true, skipped: "already_refunded" });
      continue;
    }
    const pairRefund = await refundReschedulePairIfPaid(balanceRow, {
      refundPercent: 100,
      netOfWallet: true,
    });
    if (!pairRefund.applied || "error" in pairRefund) {
      results.push({
        id,
        ok: false,
        error:
          "error" in pairRefund && pairRefund.error
            ? pairRefund.error
            : "pair_refund_not_applied",
      });
      continue;
    }
    await admin
      .from("bookings")
      .update({
        status: "refunded",
        refund_amount_cents: pairRefund.rowRefundCents,
        refunded_at: new Date().toISOString(),
      })
      .eq("id", id);
    results.push({
      id,
      ok: true,
      refundIds: pairRefund.refundIds,
      totalCents: pairRefund.totalCents,
    });
  }
  return { ok: results.every((row) => row.ok), results };
}

export async function GET(request: NextRequest) {
  const denied = authorize(request);
  if (denied) return denied;

  try {
    if (request.nextUrl.searchParams.get("cleanup") === "1") {
      const result = await cleanupLeftoverPairs();
      return NextResponse.json(result, { status: result.ok ? 200 : 500 });
    }
    const result = await runStripeRescheduleScenarios();
    return NextResponse.json(result, { status: result.ok ? 200 : 500 });
  } catch (err) {
    console.error("stripe-reschedule-scenarios failed:", err);
    return NextResponse.json(
      {
        ok: false,
        error: err instanceof Error ? err.message : "Scenario run failed",
      },
      { status: 500 }
    );
  }
}
