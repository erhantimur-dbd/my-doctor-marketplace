import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";
export const revalidate = 0;

/**
 * GET /api/health — Health check endpoint for uptime monitoring.
 *
 * Returns 200 if the app + database are healthy, 503 otherwise.
 * Checks: Supabase DB connectivity, Stripe key presence, Resend key presence.
 */
export async function GET() {
  const start = Date.now();
  const checks: Record<string, { status: "ok" | "error"; ms?: number; error?: string }> = {};

  // 1. Database connectivity
  try {
    const dbStart = Date.now();
    const supabase = createAdminClient();
    const { error } = await supabase
      .from("profiles")
      .select("id", { count: "exact", head: true })
      .limit(1);

    if (error) throw new Error(error.message);
    checks.database = { status: "ok", ms: Date.now() - dbStart };
  } catch (err: any) {
    checks.database = { status: "error", error: "Database unreachable" };
  }

  // 2. External service keys configured
  checks.stripe = {
    status: process.env.STRIPE_SECRET_KEY ? "ok" : "error",
    ...(process.env.STRIPE_SECRET_KEY ? {} : { error: "STRIPE_SECRET_KEY not set" }),
  };

  checks.email = {
    status: process.env.RESEND_API_KEY ? "ok" : "error",
    ...(process.env.RESEND_API_KEY ? {} : { error: "RESEND_API_KEY not set" }),
  };

  checks.supabase = {
    status: process.env.SUPABASE_SERVICE_ROLE_KEY ? "ok" : "error",
    ...(process.env.SUPABASE_SERVICE_ROLE_KEY ? {} : { error: "SUPABASE_SERVICE_ROLE_KEY not set" }),
  };

  // Overall status
  const allOk = Object.values(checks).every((c) => c.status === "ok");
  const totalMs = Date.now() - start;

  return NextResponse.json(
    {
      status: allOk ? "healthy" : "degraded",
      timestamp: new Date().toISOString(),
      version: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) || "dev",
      uptime_ms: totalMs,
      checks,
    },
    { status: allOk ? 200 : 503 }
  );
}
