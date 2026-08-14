import { NextResponse } from "next/server";
import { z } from "zod/v4";
import { createAdminClient } from "@/lib/supabase/admin";
import { rateLimit } from "@/lib/rate-limit";
import { log } from "@/lib/utils/logger";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const doctorWaitlistSchema = z.object({
  name: z.string().min(2, "Name is required"),
  email: z.string().email("Valid email is required"),
  specialty: z.string().min(1, "Specialty is required"),
  country: z.string().min(2, "Country is required"),
});

/**
 * POST /api/waitlist/doctor — Founding doctor waitlist signup.
 *
 * Called from the static coming-soon landing page (public/coming-soon/index.html).
 * This route is excluded from the coming-soon middleware gate, so it works on
 * mydoctors360.com / .co.uk / .eu even while the rest of the app is gated.
 */
export async function POST(request: Request) {
  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip")?.trim() ||
    "unknown";

  // 5 submissions per IP per 15 minutes — blocks waitlist spam
  const { limited } = await rateLimit(`waitlist:doctor:${ip}`, 5, 15 * 60 * 1000);
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
    return NextResponse.json(
      { error: "Invalid request body" },
      { status: 400 }
    );
  }

  const parsed = doctorWaitlistSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message || "Invalid input" },
      { status: 400 }
    );
  }

  const admin = createAdminClient();
  const { error } = await admin.from("doctor_waitlist").upsert(
    {
      name: parsed.data.name,
      email: parsed.data.email.toLowerCase(),
      specialty: parsed.data.specialty,
      country: parsed.data.country,
    },
    { onConflict: "email" }
  );

  if (error) {
    log.error("Doctor waitlist error:", { err: error });
    return NextResponse.json(
      { error: "Something went wrong. Please try again." },
      { status: 500 }
    );
  }

  try {
      const { trackServer } = await import("@/lib/analytics/server");
      const { AnalyticsEvent } = await import("@/lib/analytics/events");
      void trackServer("anonymous", AnalyticsEvent.WaitlistSubmit, {
        surface: "coming_soon",
      });
    } catch { /* analytics no-op */ }
    return NextResponse.json({ success: true });
}
