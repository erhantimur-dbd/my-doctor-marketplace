import { NextRequest, NextResponse } from "next/server";
import { rateLimit } from "@/lib/rate-limit";
import {
  getXaiApiKey,
  GROK_DEFAULT_VOICE_ID,
  isGrokVoiceEnabled,
  localeToGrokLanguage,
  XAI_API_BASE,
} from "@/lib/voice/xai";

export const maxDuration = 30;

/**
 * Grok Text-to-Speech (xAI).
 * Body: { text, voice_id?, language? / locale? }.
 * Returns audio/mpeg. Text/audio not stored.
 * @see https://docs.x.ai/developers/model-capabilities/audio/voice
 */
export async function POST(request: NextRequest) {
  if (!isGrokVoiceEnabled()) {
    return NextResponse.json(
      {
        error:
          "Grok Voice TTS is not configured. Set XAI_API_KEY in the environment.",
      },
      { status: 503 }
    );
  }

  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  const { limited, retryAfterMs } = await rateLimit(
    `voice-tts:${ip}`,
    30,
    60 * 60 * 1000
  );
  if (limited) {
    return NextResponse.json(
      { error: "Voice rate limit reached. Try again later." },
      {
        status: 429,
        headers: { "Retry-After": String(Math.ceil(retryAfterMs / 1000)) },
      }
    );
  }

  try {
    const body = (await request.json()) as {
      text?: string;
      voice?: string;
      voice_id?: string;
      language?: string;
      locale?: string;
    };
    const text = (body.text || "").trim();
    if (!text) {
      return NextResponse.json({ error: "Missing text" }, { status: 400 });
    }
    if (text.length > 2000) {
      return NextResponse.json({ error: "Text too long" }, { status: 400 });
    }

    const apiKey = getXaiApiKey()!;
    const voiceId =
      body.voice_id || body.voice || GROK_DEFAULT_VOICE_ID;
    const language = localeToGrokLanguage(
      body.language || body.locale || "en"
    );

    const res = await fetch(`${XAI_API_BASE}/tts`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        text,
        voice_id: voiceId,
        language,
      }),
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => "");
      return NextResponse.json(
        { error: "Grok TTS failed", detail: errText.slice(0, 300) },
        { status: 502 }
      );
    }

    const audio = await res.arrayBuffer();
    const contentType =
      res.headers.get("content-type") || "audio/mpeg";
    return new NextResponse(audio, {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "no-store",
        "X-Voice-Provider": "grok",
      },
    });
  } catch {
    return NextResponse.json({ error: "TTS request failed" }, { status: 500 });
  }
}
