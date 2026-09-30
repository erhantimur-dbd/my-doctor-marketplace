import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { setupCalendarWebhook } from "@/lib/google/sync";
import { setupMicrosoftWebhook } from "@/lib/microsoft/sync";
import { syncAllCalDAVDoctors } from "@/lib/caldav/sync";
import { authorizeCronRequest } from "@/lib/cron/authorize";

/**
 * CalDAV has no push channel, so it stays on this poll.
 * Google and Microsoft already import from their webhooks; listing the next
 * 30 days here burns Calendar/Graph quota and races those imports (delete
 * upcoming overrides, then die before the reinsert).
 *
 * 60s is enough for a sequential CalDAV pass plus channel renewal, and long
 * enough that a slow CalDAV delete is not cut off before the reinsert.
 */
export const maxDuration = 60;

export async function GET(request: NextRequest) {
  const denied = authorizeCronRequest(request);
  if (denied) return denied;

  const caldav = await syncAllCalDAVDoctors();

  // Renew Google/Microsoft channels expiring within 1 hour.
  const webhooksRenewed = await renewExpiringWebhooks();

  return NextResponse.json({
    caldav,
    webhooksRenewed,
  });
}

async function renewExpiringWebhooks(): Promise<number> {
  const supabase = createAdminClient();
  const oneHourFromNow = new Date(Date.now() + 60 * 60 * 1000).toISOString();

  // Find connections with webhooks expiring within 1 hour
  const { data: expiring } = await supabase
    .from("doctor_calendar_connections")
    .select("doctor_id, provider")
    .eq("sync_enabled", true)
    .not("webhook_channel_id", "is", null)
    .lt("webhook_expiration", oneHourFromNow);

  if (!expiring || expiring.length === 0) return 0;

  let renewed = 0;
  for (const conn of expiring) {
    try {
      if (conn.provider === "google") {
        await setupCalendarWebhook(conn.doctor_id);
        renewed++;
      } else if (conn.provider === "microsoft") {
        await setupMicrosoftWebhook(conn.doctor_id);
        renewed++;
      }
      // CalDAV has no webhooks
    } catch (err) {
      console.error(`Webhook renewal failed for ${conn.provider} doctor ${conn.doctor_id}:`, err);
    }
  }

  return renewed;
}
