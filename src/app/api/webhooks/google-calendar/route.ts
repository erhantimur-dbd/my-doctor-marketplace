import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { importGoogleCalendarEvents } from "@/lib/google/sync";

/**
 * POST /api/webhooks/google-calendar
 * Handles Google Calendar push notifications.
 * When a doctor's calendar changes, Google sends a POST here.
 * We trigger an import sync for that doctor.
 */
export async function POST(request: NextRequest) {
  try {
    // Google sends these headers with push notifications
    const channelId = request.headers.get("x-goog-channel-id");
    const resourceId = request.headers.get("x-goog-resource-id");
    const resourceState = request.headers.get("x-goog-resource-state");

    // Ignore sync messages (initial subscription confirmation)
    if (resourceState === "sync") {
      return NextResponse.json({ status: "ok" });
    }

    if (!channelId || !resourceId) {
      return NextResponse.json(
        { error: "Missing channel headers" },
        { status: 400 }
      );
    }

    // Find the doctor connection by webhook channel ID
    const supabase = createAdminClient();
    const { data: connection } = await supabase
      .from("doctor_calendar_connections")
      .select("doctor_id")
      .eq("webhook_channel_id", channelId)
      .eq("webhook_resource_id", resourceId)
      .single();

    if (!connection) {
      // Unknown webhook — may have been disconnected
      return NextResponse.json({ status: "ignored" });
    }

    // Trigger import sync for this doctor
    const result = await importGoogleCalendarEvents(connection.doctor_id);

    if (!result.success) {
      console.error(
        `Webhook sync failed for doctor ${connection.doctor_id}:`,
        result.error
      );
    }

    return NextResponse.json({
      status: "ok",
      eventsProcessed: result.eventsProcessed,
    });
  } catch (err) {
    console.error("Google Calendar webhook error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
