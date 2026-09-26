import { NextRequest, NextResponse } from "next/server";
import { authorizeCronRequest } from "@/lib/cron/authorize";
import { runStripeRescheduleScenarios } from "@/lib/booking/stripe-reschedule-scenarios";

/**
 * One-shot Softsmoke Stripe test-mode scenarios for the reschedule
 * destination-charge follow-up. Gated by CRON_SECRET. Not scheduled in
 * vercel.json — call manually:
 *
 *   curl -H "Authorization: Bearer $CRON_SECRET" \
 *     https://<preview>/api/cron/stripe-reschedule-scenarios
 */
export async function GET(request: NextRequest) {
  const denied = authorizeCronRequest(request);
  if (denied) return denied;

  try {
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
