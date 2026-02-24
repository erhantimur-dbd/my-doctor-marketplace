import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getGoogleAuthUrl } from "@/lib/google/calendar";

/**
 * GET /api/calendar/google/connect
 * Initiates Google OAuth2 flow for calendar sync.
 * Requires authenticated doctor.
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.redirect(
        new URL("/en/login", request.url)
      );
    }

    // Verify the user is a doctor
    const { data: doctor } = await supabase
      .from("doctors")
      .select("id")
      .eq("profile_id", user.id)
      .single();

    if (!doctor) {
      return NextResponse.json(
        { error: "Only doctors can connect Google Calendar" },
        { status: 403 }
      );
    }

    // Create state token with doctor ID for the callback
    const state = Buffer.from(
      JSON.stringify({ doctorId: doctor.id, userId: user.id })
    ).toString("base64url");

    const authUrl = getGoogleAuthUrl(state);
    return NextResponse.redirect(authUrl);
  } catch (error) {
    console.error("Google Calendar connect error:", error);
    return NextResponse.json(
      { error: "Failed to initiate Google Calendar connection" },
      { status: 500 }
    );
  }
}
