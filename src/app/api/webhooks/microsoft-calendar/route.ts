import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { importMicrosoftCalendarEvents } from "@/lib/microsoft/sync";

/**
 * POST /api/webhooks/microsoft-calendar
 * Handles Microsoft Graph push notifications for calendar changes.
 *
 * Microsoft sends a validation request first (with validationToken query param),
 * then sends change notifications as POST with JSON body.
 */
export async function POST(request: NextRequest) {
  const { searchParams } = new URL(request.url);

  // Microsoft validation handshake — must echo validationToken
  const validationToken = searchParams.get("validationToken");
  if (validationToken) {
    return new NextResponse(validationToken, {
      status: 200,
      headers: { "Content-Type": "text/plain" },
    });
  }

  try {
    const body = await request.json();
    const notifications = body.value || [];

    for (const notification of notifications) {
      // Verify client state
      if (notification.clientState !== "mydoctors360-calendar-sync") continue;

      const subscriptionId = notification.subscriptionId;

      // Find doctor by webhook subscription ID
      const supabase = createAdminClient();
      const { data: connection } = await supabase
        .from("doctor_calendar_connections")
        .select("doctor_id")
        .eq("webhook_channel_id", subscriptionId)
        .eq("provider", "microsoft")
        .single();

      if (!connection) continue;

      // Trigger import sync
      await importMicrosoftCalendarEvents(connection.doctor_id).catch((err) =>
        console.error(
          `Microsoft sync failed for doctor ${connection.doctor_id}:`,
          err
        )
      );
    }

    return NextResponse.json({ status: "ok" });
  } catch (err) {
    console.error("Microsoft Calendar webhook error:", err);
    return NextResponse.json({ error: "Webhook processing failed" }, { status: 500 });
  }
}
