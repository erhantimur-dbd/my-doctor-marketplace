import { NextRequest, NextResponse } from "next/server";
import { streamText, convertToModelMessages, stepCountIs, type UIMessage } from "ai";
import { aiModel, isAIEnabled } from "@/lib/ai/provider";
import { buildChatTools } from "@/lib/chat/tools";
import { buildSystemPrompt } from "@/lib/chat/system-prompt";
import { rateLimit } from "@/lib/rate-limit";
import { log } from "@/lib/utils/logger";

// Streamed tool-calling can take a few seconds; give it breathing room.
export const maxDuration = 30;

export async function POST(request: NextRequest) {
  if (!isAIEnabled()) {
    return NextResponse.json(
      { error: "AI chat is not configured on this environment." },
      { status: 503 }
    );
  }

  // Soft rate limit: 30 messages per hour per IP. Anonymous-friendly but
  // enough headroom for a real triage + search conversation without blowing
  // OpenAI spend open to scrapers.
  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  const { limited, retryAfterMs } = await rateLimit(
    `chat:${ip}`,
    30,
    60 * 60 * 1000
  );
  if (limited) {
    const retryAfter = Math.ceil(retryAfterMs / 1000);
    return NextResponse.json(
      {
        error:
          "You've reached the hourly chat limit. Please try again a bit later.",
        retryAfter,
      },
      {
        status: 429,
        headers: { "Retry-After": retryAfter.toString() },
      }
    );
  }

  let body: { messages?: UIMessage[]; locale?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { messages, locale = "en" } = body;

  if (!Array.isArray(messages) || messages.length === 0) {
    return NextResponse.json(
      { error: "messages array is required" },
      { status: 400 }
    );
  }

  try {
    const modelMessages = await convertToModelMessages(messages);
    const result = streamText({
      model: aiModel,
      system: buildSystemPrompt(locale),
      messages: modelMessages,
      tools: buildChatTools(locale),
      // Multi-step: allow analyzeSymptoms → searchDoctors → final text in one turn.
      stopWhen: stepCountIs(5),
    });

    return result.toUIMessageStreamResponse();
  } catch (err) {
    log.error("[chat] streamText error:", { err });
    return NextResponse.json(
      { error: "Chat is temporarily unavailable. Please try again." },
      { status: 500 }
    );
  }
}
