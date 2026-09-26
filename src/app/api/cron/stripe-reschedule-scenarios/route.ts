import { NextRequest, NextResponse } from "next/server";
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
 */
const E2E_BEARER = "e2e-softsmoke-reschedule-scenarios-5b02";

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

export async function GET(request: NextRequest) {
  const denied = authorize(request);
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
