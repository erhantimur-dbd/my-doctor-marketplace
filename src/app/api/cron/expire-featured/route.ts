import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Daily cron: clear paid Featured profile boosts after featured_until.
 *
 * Featured is a paid package visibility boost. When the boost window ends,
 * strip is_featured so search ranking and badges stay accurate.
 *
 * Schedule: daily (see vercel.json)
 * Endpoint: GET /api/cron/expire-featured
 * Auth: Authorization: Bearer $CRON_SECRET
 */
export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createAdminClient();
  const now = new Date().toISOString();

  const { data: expired, error } = await supabase
    .from("doctors")
    .update({
      is_featured: false,
      featured_until: null,
    })
    .eq("is_featured", true)
    .not("featured_until", "is", null)
    .lt("featured_until", now)
    .select("id, slug");

  if (error) {
    return NextResponse.json(
      { error: error.message, expired: 0 },
      { status: 500 }
    );
  }

  return NextResponse.json({
    expired: expired?.length || 0,
    doctor_ids: (expired || []).map((d) => d.id),
  });
}
