import { NextResponse } from "next/server";
import { z } from "zod/v4";
import { createAdminClient } from "@/lib/supabase/admin";
import { rateLimit } from "@/lib/rate-limit";
import { log } from "@/lib/utils/logger";
import { patientWaitlistRow } from "@/lib/waitlist/patient-waitlist";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const patientWaitlistSchema = z.object({
  name: z.string().trim().min(2, "Please enter your name."),
  email: z.string().trim().email("Please enter a valid email address."),
});

/**
 * POST /api/waitlist/patient — coming-soon patient waitlist.
 *
 * Saves name and email on launch_notifications.
 * Contact details only — no percent-off column.
 * Called from public/coming-soon/index.html. API routes sit outside
 * the coming-soon middleware matcher.
 */
export async function POST(request: Request) {
  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip")?.trim() ||
    "unknown";

  const { limited } = await rateLimit(
    `waitlist:patient:${ip}`,
    5,
    15 * 60 * 1000
  );
  if (limited) {
    return NextResponse.json(
      { error: "Too many requests. Please try again later." },
      { status: 429 }
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const parsed = patientWaitlistSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message || "Invalid input" },
      { status: 400 }
    );
  }

  const row = patientWaitlistRow(parsed.data);
  const admin = createAdminClient();
  const { error } = await admin.from("launch_notifications").upsert(row, {
    onConflict: "email,region",
  });

  if (error) {
    log.error("Patient waitlist error:", { err: error });
    return NextResponse.json(
      { error: "Something went wrong. Please try again." },
      { status: 500 }
    );
  }

  return NextResponse.json({ success: true });
}
