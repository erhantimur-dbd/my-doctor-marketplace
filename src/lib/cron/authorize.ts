import { timingSafeEqual } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";

function bearerMatches(auth: string | null, secret: string): boolean {
  const expected = `Bearer ${secret}`;
  const provided = auth ?? "";
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

/**
 * Fail-closed cron gate. A missing CRON_SECRET must never compare equal
 * to `Bearer undefined`.
 */
export function authorizeCronRequest(request: NextRequest): NextResponse | null {
  const secret = process.env.CRON_SECRET;
  const auth = request.headers.get("authorization");
  if (!secret || !bearerMatches(auth, secret)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return null;
}
