import { NextRequest, NextResponse } from "next/server";
import { isAIEnabled } from "@/lib/ai/provider";
import { rateLimit } from "@/lib/rate-limit";

export const maxDuration = 30;

/**
 * OpenAI TTS (Phase 1). Body: { text, voice? }.
 * Returns audio/mpeg stream. Text/audio not stored.
 */
export async function POST(request: NextRequest) {
  if (!isAIEnabled()) {
    return NextResponse.json(
      { error: "Voice TTS is not configured on this environment." },
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
    };
    const text = (body.text || "").trim();
    if (!text) {
      return NextResponse.json({ error: "Missing text" }, { status: 400 });
    }
    if (text.length > 2000) {
      return NextResponse.json({ error: "Text too long" }, { status: 400 });
    }

    const apiKey = process.env.OPENAI_API_KEY!;
    const res = await fetch("https://api.openai.com/v1/audio/speech", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "tts-1",
        voice: body.voice || "alloy",
        input: text,
        response_format: "mp3",
      }),
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => "");
      return NextResponse.json(
        { error: "TTS failed", detail: errText.slice(0, 200) },
        { status: 502 }
      );
    }

    const audio = await res.arrayBuffer();
    return new NextResponse(audio, {
      status: 200,
      headers: {
        "Content-Type": "audio/mpeg",
        "Cache-Control": "no-store",
      },
    });
  } catch {
    return NextResponse.json({ error: "TTS request failed" }, { status: 500 });
  }
}
