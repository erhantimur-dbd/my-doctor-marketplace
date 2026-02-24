import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  exchangeCodeForTokens,
  listCalendars,
} from "@/lib/google/calendar";
import {
  importGoogleCalendarEvents,
  setupCalendarWebhook,
} from "@/lib/google/sync";

/**
 * GET /api/calendar/google/callback
 * Handles Google OAuth2 callback, stores tokens, triggers initial sync
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const code = searchParams.get("code");
    const stateParam = searchParams.get("state");
    const error = searchParams.get("error");

    if (error) {
      console.error("Google OAuth error:", error);
      return NextResponse.redirect(
        new URL(
          "/en/doctor-dashboard/settings?calendar_error=auth_denied",
          request.url
        )
      );
    }

    if (!code || !stateParam) {
      return NextResponse.redirect(
        new URL(
          "/en/doctor-dashboard/settings?calendar_error=missing_params",
          request.url
        )
      );
    }

    // Decode state
    let state: { doctorId: string; userId: string };
    try {
      state = JSON.parse(
        Buffer.from(stateParam, "base64url").toString()
      );
    } catch {
      return NextResponse.redirect(
        new URL(
          "/en/doctor-dashboard/settings?calendar_error=invalid_state",
          request.url
        )
      );
    }

    // Verify the user is still authenticated
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user || user.id !== state.userId) {
      return NextResponse.redirect(
        new URL("/en/login", request.url)
      );
    }

    // Exchange code for tokens
    const tokens = await exchangeCodeForTokens(code);

    const expiresAt = new Date(
      Date.now() + tokens.expires_in * 1000
    ).toISOString();

    // Get primary calendar
    const calendars = await listCalendars(tokens.access_token);
    const primaryCalendar = calendars.find((c) => c.primary) || calendars[0];

    // Upsert calendar connection using admin client (bypasses RLS for service_role)
    const adminSupabase = createAdminClient();
    const { error: upsertError } = await adminSupabase
      .from("doctor_calendar_connections")
      .upsert(
        {
          doctor_id: state.doctorId,
          provider: "google",
          access_token: tokens.access_token,
          refresh_token: tokens.refresh_token,
          token_expires_at: expiresAt,
          calendar_id: primaryCalendar?.id || null,
          sync_enabled: true,
        },
        { onConflict: "doctor_id,provider" }
      );

    if (upsertError) {
      console.error("Failed to save calendar connection:", upsertError);
      return NextResponse.redirect(
        new URL(
          "/en/doctor-dashboard/settings?calendar_error=save_failed",
          request.url
        )
      );
    }

    // Trigger initial import sync (non-blocking — run in background)
    importGoogleCalendarEvents(state.doctorId).catch((err) =>
      console.error("Initial sync error:", err)
    );

    // Set up push notification webhook (non-blocking)
    setupCalendarWebhook(state.doctorId).catch((err) =>
      console.error("Webhook setup error:", err)
    );

    // Redirect back to settings with success
    return NextResponse.redirect(
      new URL(
        "/en/doctor-dashboard/settings?calendar_connected=true",
        request.url
      )
    );
  } catch (err) {
    console.error("Google Calendar callback error:", err);
    return NextResponse.redirect(
      new URL(
        "/en/doctor-dashboard/settings?calendar_error=unexpected",
        request.url
      )
    );
  }
}
