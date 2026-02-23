import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createAdminClient();

  // Delete bookings that have been in pending_payment for over 15 minutes
  const expiryTime = new Date(Date.now() - 15 * 60 * 1000).toISOString();

  const { data, error } = await supabase
    .from("bookings")
    .delete()
    .eq("status", "pending_payment")
    .lt("created_at", expiryTime)
    .select("id");

  return NextResponse.json({
    expired_bookings: data?.length || 0,
    error: error?.message || null,
  });
}
