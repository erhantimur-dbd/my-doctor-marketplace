import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  exchangeCodeForTokens,
  listCalendars,
} from "@/lib/microsoft/calendar";
import {
  importMicrosoftCalendarEvents,
  setupMicrosoftWebhook,
} from "@/lib/microsoft/sync";

/**
 * GET /api/calendar/microsoft/callback
 * Handles Microsoft OAuth2 callback, stores tokens, triggers initial sync
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const code = searchParams.get("code");
    const stateParam = searchParams.get("state");
    const error = searchParams.get("error");

    if (error) {
      console.error("Microsoft OAuth error:", error);
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

    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user || user.id !== state.userId) {
      return NextResponse.redirect(new URL("/en/login", request.url));
    }

    const tokens = await exchangeCodeForTokens(code);

    const expiresAt = new Date(
      Date.now() + tokens.expires_in * 1000
    ).toISOString();

    // Get default calendar
    const calendars = await listCalendars(tokens.access_token);
    const defaultCalendar =
      calendars.find((c) => c.isDefaultCalendar) || calendars[0];

    const adminSupabase = createAdminClient();
    const { error: upsertError } = await adminSupabase
      .from("doctor_calendar_connections")
      .upsert(
        {
          doctor_id: state.doctorId,
          provider: "microsoft",
          access_token: tokens.access_token,
          refresh_token: tokens.refresh_token,
          token_expires_at: expiresAt,
          calendar_id: defaultCalendar?.id || null,
          sync_enabled: true,
        },
        { onConflict: "doctor_id,provider" }
      );

    if (upsertError) {
      console.error("Failed to save Microsoft calendar connection:", upsertError);
      return NextResponse.redirect(
        new URL(
          "/en/doctor-dashboard/settings?calendar_error=save_failed",
          request.url
        )
      );
    }

    // Trigger initial sync (non-blocking)
    importMicrosoftCalendarEvents(state.doctorId).catch((err) =>
      console.error("Microsoft initial sync error:", err)
    );

    // Set up webhook (non-blocking)
    setupMicrosoftWebhook(state.doctorId).catch((err) =>
      console.error("Microsoft webhook setup error:", err)
    );

    return NextResponse.redirect(
      new URL(
        "/en/doctor-dashboard/settings?microsoft_calendar_connected=true",
        request.url
      )
    );
  } catch (err) {
    console.error("Microsoft Calendar callback error:", err);
    return NextResponse.redirect(
      new URL(
        "/en/doctor-dashboard/settings?calendar_error=unexpected",
        request.url
      )
    );
  }
}
