import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getMicrosoftAuthUrl } from "@/lib/microsoft/calendar";

/**
 * GET /api/calendar/microsoft/connect
 * Initiates Microsoft OAuth2 flow for calendar sync.
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.redirect(new URL("/en/login", request.url));
    }

    const { data: doctor } = await supabase
      .from("doctors")
      .select("id")
      .eq("profile_id", user.id)
      .single();

    if (!doctor) {
      return NextResponse.json(
        { error: "Only doctors can connect Microsoft Calendar" },
        { status: 403 }
      );
    }

    const state = Buffer.from(
      JSON.stringify({ doctorId: doctor.id, userId: user.id })
    ).toString("base64url");

    const authUrl = getMicrosoftAuthUrl(state);
    return NextResponse.redirect(authUrl);
  } catch (error) {
    console.error("Microsoft Calendar connect error:", error);
    return NextResponse.json(
      { error: "Failed to initiate Microsoft Calendar connection" },
      { status: 500 }
    );
  }
}
