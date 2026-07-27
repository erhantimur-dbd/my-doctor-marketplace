import { NextRequest, NextResponse } from "next/server";
import { expireGpOffersAndRefund } from "@/lib/gp/reassign";

/**
 * Expire pending GP alternate-slot offers and refund patients.
 * Protect with CRON_SECRET (same as other /api/cron routes).
 */
export async function GET(request: NextRequest) {
  const auth = request.headers.get("authorization");
  const secret = process.env.CRON_SECRET;
  if (secret && auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { processed } = await expireGpOffersAndRefund();
    return NextResponse.json({ ok: true, processed });
  } catch (err) {
    console.error("gp-offer-expiry cron failed:", err);
    return NextResponse.json({ error: "Cron failed" }, { status: 500 });
  }
}
