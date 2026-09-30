import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { authorizeCronRequest } from "@/lib/cron/authorize";
import {
  foundingFailureIsOurError,
  shouldSkipFoundingEnforcement,
} from "@/lib/payments/founding-our-error";

/**
 * Daily cron job for license enforcement state transitions:
 * - past_due > 7 days → grace_period (hidden from search, no new bookings)
 * - grace_period > 30 days → suspended (dashboard locked, billing only)
 * - cancelled > 90 days → flagged for cleanup (metadata marker)
 *
 * Schedule: Daily at 03:00 UTC via Vercel Cron or external scheduler
 * Endpoint: GET /api/cron/license-enforcement
 */
export async function GET(request: NextRequest) {
  const denied = authorizeCronRequest(request);
  if (denied) return denied;

  const supabase = createAdminClient();
  const now = new Date();
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const ninetyDaysAgo = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);

  let toGracePeriod = 0;
  let toSuspended = 0;
  let flaggedForCleanup = 0;

  // 1. past_due > 7 days → grace_period
  const { data: pastDueLicenses } = await supabase
    .from("licenses")
    .select("id, organization_id, current_period_end, tier, stripe_subscription_id")
    .eq("status", "past_due")
    .lt("current_period_end", sevenDaysAgo.toISOString());

  if (pastDueLicenses && pastDueLicenses.length > 0) {
    for (const license of pastDueLicenses) {
      if (await skipFoundingOurError(supabase, license)) continue;
      await supabase
        .from("licenses")
        .update({
          status: "grace_period",
          grace_period_start: now.toISOString(),
          updated_at: now.toISOString(),
        })
        .eq("id", license.id);
      toGracePeriod++;
    }
  }

  // 2. grace_period > 30 days → suspended
  const { data: graceLicenses } = await supabase
    .from("licenses")
    .select("id, organization_id, grace_period_start, tier, stripe_subscription_id")
    .eq("status", "grace_period")
    .lt("grace_period_start", thirtyDaysAgo.toISOString());

  if (graceLicenses && graceLicenses.length > 0) {
    for (const license of graceLicenses) {
      if (await skipFoundingOurError(supabase, license)) continue;
      await supabase
        .from("licenses")
        .update({
          status: "suspended",
          suspended_at: now.toISOString(),
          updated_at: now.toISOString(),
        })
        .eq("id", license.id);
      toSuspended++;
    }
  }

  // 3. cancelled > 90 days → flag for cleanup (metadata marker, no deletion)
  const { data: cancelledLicenses } = await supabase
    .from("licenses")
    .select("id, cancelled_at, metadata")
    .eq("status", "cancelled")
    .lt("cancelled_at", ninetyDaysAgo.toISOString());

  if (cancelledLicenses && cancelledLicenses.length > 0) {
    for (const license of cancelledLicenses) {
      const meta = (license.metadata as Record<string, unknown>) || {};
      if (!meta.flagged_for_cleanup) {
        await supabase
          .from("licenses")
          .update({
            metadata: { ...meta, flagged_for_cleanup: true, flagged_at: now.toISOString() },
            updated_at: now.toISOString(),
          })
          .eq("id", license.id);
        flaggedForCleanup++;
      }
    }
  }

  console.log(
    `[License Enforcement] grace_period: ${toGracePeriod}, suspended: ${toSuspended}, flagged: ${flaggedForCleanup}`
  );

  return NextResponse.json({
    processed: toGracePeriod + toSuspended + flaggedForCleanup,
    to_grace_period: toGracePeriod,
    to_suspended: toSuspended,
    flagged_for_cleanup: flaggedForCleanup,
    timestamp: now.toISOString(),
  });
}

async function skipFoundingOurError(
  supabase: ReturnType<typeof createAdminClient>,
  license: {
    tier?: string | null;
    organization_id?: string | null;
    stripe_subscription_id?: string | null;
  }
): Promise<boolean> {
  if (license.tier !== "founding") return false;
  let doctorId: string | null = null;
  if (license.organization_id) {
    const { data: doctor } = await supabase
      .from("doctors")
      .select("id")
      .eq("organization_id", license.organization_id)
      .limit(1)
      .maybeSingle();
    doctorId = doctor?.id ?? null;
  }
  const ourError = await foundingFailureIsOurError(supabase, {
    subscriptionId: license.stripe_subscription_id,
    doctorId,
  });
  return shouldSkipFoundingEnforcement(ourError);
}
