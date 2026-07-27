import { NextRequest, NextResponse } from "next/server";
import { rateLimit } from "@/lib/rate-limit";
import { executeRealtimeTool } from "@/lib/voice/realtime-tools";
import type { DoctorsSearchFilters } from "@/lib/voice/search-url";
import { log } from "@/lib/utils/logger";

export const maxDuration = 30;

/**
 * Execute marketplace tools for a Grok Realtime function call.
 * Called from the browser when the voice agent requests search/FAQ/booking draft.
 */
export async function POST(request: NextRequest) {
  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  const { limited, retryAfterMs } = await rateLimit(
    `voice-tools:${ip}`,
    60,
    60 * 60 * 1000
  );
  if (limited) {
    return NextResponse.json(
      { error: "Tool rate limit reached" },
      {
        status: 429,
        headers: { "Retry-After": String(Math.ceil(retryAfterMs / 1000)) },
      }
    );
  }

  let body: {
    name?: string;
    arguments?: Record<string, unknown> | string;
    locale?: string;
    currentFilters?: DoctorsSearchFilters;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const name = body.name?.trim();
  if (!name) {
    return NextResponse.json({ error: "name is required" }, { status: 400 });
  }

  let args: Record<string, unknown> = {};
  if (typeof body.arguments === "string") {
    try {
      args = JSON.parse(body.arguments) as Record<string, unknown>;
    } catch {
      return NextResponse.json(
        { error: "arguments must be valid JSON" },
        { status: 400 }
      );
    }
  } else if (body.arguments && typeof body.arguments === "object") {
    args = body.arguments;
  }

  const locale = body.locale || "en";

  try {
    const result = await executeRealtimeTool(
      name,
      args,
      locale,
      body.currentFilters
    );
    return NextResponse.json({ ok: true, name, result });
  } catch (err) {
    log.error("[voice/tools] execute failed", { name, err });
    return NextResponse.json(
      { ok: false, error: "Tool execution failed" },
      { status: 500 }
    );
  }
}
