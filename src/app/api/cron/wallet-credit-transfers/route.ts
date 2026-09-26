import { NextRequest, NextResponse } from "next/server";
import { authorizeCronRequest } from "@/lib/cron/authorize";
import { reconcileStalePendingCreditTransfers } from "@/lib/stripe/pending-credit-transfer";
import { log } from "@/lib/utils/logger";

/**
 * Every 15 minutes, reconcile doctor credit transfers still pending.
 * Fail-closed: CRON_SECRET must be set AND Authorization must match.
 */
export async function GET(request: NextRequest) {
  const denied = authorizeCronRequest(request);
  if (denied) return denied;

  try {
    const result = await reconcileStalePendingCreditTransfers();
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    log.error("[wallet-credit] pending transfer cron failed", { err });
    return NextResponse.json({ error: "Cron failed" }, { status: 500 });
  }
}
