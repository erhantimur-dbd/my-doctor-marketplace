import { NextResponse } from "next/server";
import { AnalyticsEvent } from "@/lib/analytics/events";
import type { AnalyticsEventName } from "@/lib/analytics/events";
import { trackServer } from "@/lib/analytics/server";

export const dynamic = "force-dynamic";

const ALLOWED = new Set<string>([
  AnalyticsEvent.FoundingClaimStarted,
  AnalyticsEvent.WaitlistSubmit,
  AnalyticsEvent.PricingViewed,
]);

export async function POST(request: Request) {
  let body: {
    event?: string;
    props?: Record<string, unknown>;
    distinct_id?: string;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }
  const event = body.event;
  if (!event || !ALLOWED.has(event)) {
    return NextResponse.json({ error: "event_not_allowed" }, { status: 400 });
  }
  const props: Record<string, string | number | boolean | null | undefined> = {
    surface: "coming_soon",
  };
  if (body.props && typeof body.props === "object") {
    for (const [k, v] of Object.entries(body.props)) {
      if (
        typeof v === "string" ||
        typeof v === "number" ||
        typeof v === "boolean" ||
        v === null
      ) {
        props[k] = v;
      }
    }
  }
  const distinct =
    typeof body.distinct_id === "string" && !body.distinct_id.includes("@")
      ? body.distinct_id
      : "anonymous";
  await trackServer(distinct, event as AnalyticsEventName, props);
  return NextResponse.json({ ok: true });
}
