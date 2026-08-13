import { NextRequest, NextResponse } from "next/server";

/**
 * Fail-closed cron gate. A missing CRON_SECRET must never compare equal
 * to `Bearer undefined`.
 */
export function authorizeCronRequest(request: NextRequest): NextResponse | null {
  const secret = process.env.CRON_SECRET;
  const auth = request.headers.get("authorization");
  if (!secret || auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return null;
}
