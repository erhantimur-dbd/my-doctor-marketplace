import { NextRequest, NextResponse } from "next/server";
import { rateLimit } from "@/lib/rate-limit";
import {
  getXaiApiKey,
  isGrokVoiceEnabled,
  localeToGrokLanguage,
  XAI_API_BASE,
} from "@/lib/voice/xai";

export const maxDuration = 30;

/**
 * Grok Speech-to-Text (xAI).
 * Accepts multipart form: audio file + optional locale.
 * Audio is processed by xAI and never stored by us.
 * @see https://docs.x.ai/developers/model-capabilities/audio/voice
 */
export async function POST(request: NextRequest) {
  if (!isGrokVoiceEnabled()) {
    return NextResponse.json(
      {
        error:
          "Grok Voice STT is not configured. Set XAI_API_KEY in the environment.",
      },
      { status: 503 }
    );
  }

  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  const { limited, retryAfterMs } = await rateLimit(
    `voice-stt:${ip}`,
    20,
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
    const form = await request.formData();
    const file = form.get("audio");
    const localeRaw = form.get("locale");
    const locale =
      typeof localeRaw === "string" && localeRaw ? localeRaw : "en";

    if (!(file instanceof Blob) || file.size === 0) {
      return NextResponse.json({ error: "Missing audio" }, { status: 400 });
    }
    if (file.size > 10 * 1024 * 1024) {
      return NextResponse.json({ error: "Audio too large" }, { status: 413 });
    }

    const apiKey = getXaiApiKey()!;
    const filename =
      file instanceof File && file.name ? file.name : "recording.webm";

    // Grok STT: multipart file upload to /v1/stt
    const grokForm = new FormData();
    grokForm.append("file", file, filename);
    // Optional language bias when supported by the API
    grokForm.append("language", localeToGrokLanguage(locale));

    const res = await fetch(`${XAI_API_BASE}/stt`, {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}` },
      body: grokForm,
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => "");
      return NextResponse.json(
        {
          error: "Grok transcription failed",
          detail: errText.slice(0, 300),
        },
        { status: 502 }
      );
    }

    const data = (await res.json()) as {
      text?: string;
      transcript?: string;
    };
    const text = (data.text || data.transcript || "").trim();
    // Explicit: we never persist audio or transcript server-side
    return NextResponse.json({ text, stored: false, provider: "grok" });
  } catch {
    return NextResponse.json(
      { error: "STT request failed" },
      { status: 500 }
    );
  }
}
