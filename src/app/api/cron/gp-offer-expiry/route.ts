import { NextRequest, NextResponse } from "next/server";
import { expireGpOffersAndRefund } from "@/lib/gp/reassign";
import { authorizeCronRequest } from "@/lib/cron/authorize";

/**
 * Expire pending GP alternate-slot offers and refund patients.
 * Fail-closed: CRON_SECRET must be set AND Authorization must match.
 */
export async function GET(request: NextRequest) {
  const denied = authorizeCronRequest(request);
  if (denied) return denied;

  try {
    const { processed } = await expireGpOffersAndRefund();
    return NextResponse.json({ ok: true, processed });
  } catch (err) {
    console.error("gp-offer-expiry cron failed:", err);
    return NextResponse.json({ error: "Cron failed" }, { status: 500 });
  }
}
