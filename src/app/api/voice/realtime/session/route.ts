import { NextRequest, NextResponse } from "next/server";
import { rateLimit } from "@/lib/rate-limit";
import {
  getXaiApiKey,
  isGrokVoiceEnabled,
  XAI_API_BASE,
  GROK_DEFAULT_VOICE_ID,
} from "@/lib/voice/xai";
import { buildRealtimeVoiceInstructions } from "@/lib/voice/realtime-instructions";
import {
  buildRealtimeFunctionTools,
  languageHintForLocale,
} from "@/lib/voice/realtime-tools";
import { log } from "@/lib/utils/logger";

export const maxDuration = 30;

const REALTIME_MODEL = "grok-voice-latest";
const TOKEN_TTL_SECONDS = 300;

/**
 * Mint a short-lived xAI ephemeral token for browser Realtime WebSocket.
 * Never returns the long-lived XAI_API_KEY to the client.
 *
 * @see https://docs.x.ai/developers/model-capabilities/audio/ephemeral-tokens
 */
export async function POST(request: NextRequest) {
  if (!isGrokVoiceEnabled()) {
    return NextResponse.json(
      {
        error:
          "Live voice is not configured. Set XAI_API_KEY in the environment.",
      },
      { status: 503 }
    );
  }

  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  const { limited, retryAfterMs } = await rateLimit(
    `voice-realtime-session:${ip}`,
    30,
    60 * 60 * 1000
  );
  if (limited) {
    return NextResponse.json(
      { error: "Voice session limit reached. Try again later." },
      {
        status: 429,
        headers: { "Retry-After": String(Math.ceil(retryAfterMs / 1000)) },
      }
    );
  }

  let locale = "en";
  try {
    const body = (await request.json()) as { locale?: string };
    if (body.locale) locale = body.locale;
  } catch {
    // empty body ok
  }

  const apiKey = getXaiApiKey()!;

  try {
    const res = await fetch(`${XAI_API_BASE}/realtime/client_secrets`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        expires_after: { seconds: TOKEN_TTL_SECONDS },
      }),
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => "");
      log.error("[voice/realtime/session] client_secrets failed", {
        status: res.status,
        errText: errText.slice(0, 300),
      });
      return NextResponse.json(
        { error: "Could not start live voice session" },
        { status: 502 }
      );
    }

    const data = (await res.json()) as {
      value?: string;
      client_secret?: string | { value?: string };
      expires_at?: number;
    };

    // xAI may return { value } or nested client_secret
    const token =
      data.value ||
      (typeof data.client_secret === "string"
        ? data.client_secret
        : data.client_secret?.value) ||
      "";

    if (!token) {
      log.error("[voice/realtime/session] missing token in response", {
        keys: Object.keys(data),
      });
      return NextResponse.json(
        { error: "Could not start live voice session" },
        { status: 502 }
      );
    }

    const instructions = buildRealtimeVoiceInstructions(locale);
    const tools = buildRealtimeFunctionTools();
    const languageHint = languageHintForLocale(locale);

    return NextResponse.json({
      token,
      expiresAt:
        data.expires_at ||
        Math.floor(Date.now() / 1000) + TOKEN_TTL_SECONDS,
      model: REALTIME_MODEL,
      voice: GROK_DEFAULT_VOICE_ID,
      instructions,
      tools,
      locale,
      languageHint,
      wsUrl: `wss://api.x.ai/v1/realtime?model=${REALTIME_MODEL}`,
    });
  } catch (err) {
    log.error("[voice/realtime/session] request failed", { err });
    return NextResponse.json(
      { error: "Live voice unavailable" },
      { status: 502 }
    );
  }
}
