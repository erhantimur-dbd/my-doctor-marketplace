import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { syncAllConnectedDoctors, setupCalendarWebhook } from "@/lib/google/sync";
import { syncAllMicrosoftDoctors, setupMicrosoftWebhook } from "@/lib/microsoft/sync";
import { syncAllCalDAVDoctors } from "@/lib/caldav/sync";

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Sync all providers in parallel
  const [google, microsoft, caldav] = await Promise.all([
    syncAllConnectedDoctors(),
    syncAllMicrosoftDoctors(),
    syncAllCalDAVDoctors(),
  ]);

  // Renew webhooks expiring within 1 hour
  const webhooksRenewed = await renewExpiringWebhooks();

  return NextResponse.json({
    google,
    microsoft,
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
