import { NextRequest, NextResponse } from "next/server";
import { isAIEnabled } from "@/lib/ai/provider";
import { rateLimit } from "@/lib/rate-limit";
import { localeToBcp47 } from "@/lib/voice/locale";

export const maxDuration = 30;

/**
 * OpenAI Whisper speech-to-text.
 * Accepts multipart form: audio file + optional locale.
 * Audio is processed and never stored.
 */
export async function POST(request: NextRequest) {
  if (!isAIEnabled()) {
    return NextResponse.json(
      { error: "Voice STT is not configured on this environment." },
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
    // Cap ~10MB
    if (file.size > 10 * 1024 * 1024) {
      return NextResponse.json({ error: "Audio too large" }, { status: 413 });
    }

    const apiKey = process.env.OPENAI_API_KEY!;
    const whisperForm = new FormData();
    const filename =
      file instanceof File && file.name ? file.name : "recording.webm";
    whisperForm.append("file", file, filename);
    whisperForm.append("model", "whisper-1");
    whisperForm.append("language", localeToBcp47(locale).slice(0, 2));

    const res = await fetch("https://api.openai.com/v1/audio/transcriptions", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}` },
      body: whisperForm,
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => "");
      return NextResponse.json(
        { error: "Transcription failed", detail: errText.slice(0, 200) },
        { status: 502 }
      );
    }

    const data = (await res.json()) as { text?: string };
    const text = (data.text || "").trim();
    // Explicit: we never persist audio or transcript server-side
    return NextResponse.json({ text, stored: false });
  } catch {
    return NextResponse.json(
      { error: "STT request failed" },
      { status: 500 }
    );
  }
}
