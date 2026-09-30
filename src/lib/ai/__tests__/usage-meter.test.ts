import { readFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { log } from "@/lib/utils/logger";

const generateObject = vi.hoisted(() => vi.fn());
const streamText = vi.hoisted(() => vi.fn());

vi.mock("ai", () => ({
  generateObject,
  streamText,
}));

import {
  AI_SDK_MAX_RETRIES,
  aiUsagePayload,
  generateMeteredObject,
  meterNlSearch,
  meteredXaiFetch,
  recordAiUsage,
  streamMeteredText,
  voiceMeterFromSttJson,
} from "@/lib/ai/usage-meter";

const SECRET = "patient query chest pain secret";

function captureUsage() {
  const rows: Record<string, unknown>[] = [];
  vi.spyOn(log, "info").mockImplementation((message, data) => {
    if (message === "ai_usage" && data) rows.push(data);
  });
  return rows;
}

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  delete process.env.VERCEL_ENV;
});

describe("ai usage payload", () => {
  it("records feature, tokens, and VERCEL_ENV without content fields", () => {
    process.env.VERCEL_ENV = "preview";
    const payload = aiUsagePayload({
      feature: "symptom",
      outcome: "model",
      provider: "openai",
      model: "gpt-4o-mini",
      usage: {
        inputTokens: 10,
        outputTokens: 2,
        totalTokens: 12,
      },
    });
    expect(payload).toMatchObject({
      feature: "symptom",
      outcome: "model",
      billed: true,
      env: "preview",
      provider: "openai",
      model: "gpt-4o-mini",
      inputTokens: 10,
      outputTokens: 2,
      totalTokens: 12,
    });
    expect(JSON.stringify(payload)).not.toContain(SECRET);
  });

  it("drops provider raw payloads that can echo the prompt", () => {
    const usage = tokenShape();
    expect(usage).toEqual({
      inputTokens: 4,
      outputTokens: 1,
      totalTokens: 5,
    });
    const payload = aiUsagePayload({
      feature: "review_summary",
      outcome: "model",
      usage,
    });
    expect(JSON.stringify(payload)).not.toContain(SECRET);
    expect(payload).not.toHaveProperty("raw");
    expect(payload).not.toHaveProperty("prompt");
  });

  it("meters NL outcomes the same way as the unmerged NL helper, plus env", () => {
    process.env.VERCEL_ENV = "production";
    const rows = captureUsage();
    meterNlSearch("local");
    meterNlSearch("cache");
    meterNlSearch("model", { inputTokens: 8, outputTokens: 2, totalTokens: 10 });
    meterNlSearch("model_error");
    expect(rows.map((row) => [row.outcome, row.billed, row.totalTokens])).toEqual([
      ["local", false, 0],
      ["cache", false, 0],
      ["model", true, 10],
      ["model_error", true, 0],
    ]);
    for (const row of rows) {
      expect(row.feature).toBe("nl_search");
      expect(row.env).toBe("production");
      expect(row.provider).toBe("openai");
    }
    expect(rows[0]).not.toHaveProperty("model");
    expect(rows[1]).not.toHaveProperty("model");
    expect(rows[2]).toMatchObject({ model: "gpt-4o-mini" });
    expect(rows[3]).toMatchObject({ model: "gpt-4o-mini" });
  });

  it("reads STT duration and tokens and ignores the transcript", () => {
    const measured = voiceMeterFromSttJson({
      text: SECRET,
      transcript: SECRET,
      words: [{ text: "chest" }],
      channels: [{ text: SECRET }],
      duration: 3.25,
      usage: { input_tokens: 9, output_tokens: 1, total_tokens: 10 },
    });
    expect(measured.durationSeconds).toBe(3.25);
    expect(measured.usage).toEqual({
      inputTokens: 9,
      outputTokens: 1,
      totalTokens: 10,
    });
    expect(JSON.stringify(measured)).not.toContain(SECRET);
    expect(JSON.stringify(measured)).not.toContain("chest");
  });
});

describe("metered OpenAI calls", () => {
  it("forces maxRetries 0 and logs usage without the prompt", async () => {
    const rows = captureUsage();
    generateObject.mockResolvedValueOnce({
      object: { primarySpecialty: "dentistry" },
      usage: {
        inputTokens: 20,
        outputTokens: 4,
        totalTokens: 24,
        raw: { prompt: SECRET },
      },
    });

    const result = await generateMeteredObject("symptom", {
      model: {} as never,
      schema: {} as never,
      prompt: SECRET,
    });

    expect(AI_SDK_MAX_RETRIES).toBe(0);
    expect(generateObject).toHaveBeenCalledWith(
      expect.objectContaining({ maxRetries: 0, prompt: SECRET })
    );
    expect(result.object).toEqual({ primarySpecialty: "dentistry" });
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      feature: "symptom",
      outcome: "model",
      billed: true,
      inputTokens: 20,
      outputTokens: 4,
      totalTokens: 24,
    });
    expect(JSON.stringify(rows[0])).not.toContain(SECRET);
  });

  it("logs a billed model_error when generateObject throws", async () => {
    const rows = captureUsage();
    generateObject.mockRejectedValueOnce(new Error(SECRET));
    await expect(
      generateMeteredObject("review_summary", {
        model: {} as never,
        schema: {} as never,
        prompt: SECRET,
      })
    ).rejects.toThrow(SECRET);
    expect(rows[0]).toMatchObject({
      feature: "review_summary",
      outcome: "model_error",
      billed: true,
      totalTokens: 0,
    });
    expect(JSON.stringify(rows[0])).not.toContain(SECRET);
  });

  it("overrides a caller retry count on chat and logs total usage", async () => {
    const rows = captureUsage();
    streamText.mockImplementationOnce((options: { maxRetries?: number; prompt?: string }) => {
      expect(options.maxRetries).toBe(0);
      expect(options.prompt).toBe(SECRET);
      return {
        totalUsage: Promise.resolve({
          inputTokens: 3,
          outputTokens: 1,
          totalTokens: 4,
          raw: { text: SECRET },
        }),
      };
    });

    streamMeteredText("chat", {
      model: {} as never,
      prompt: SECRET,
      maxRetries: 5,
    });
    await vi.waitFor(() => {
      expect(rows).toHaveLength(1);
    });
    expect(rows[0]).toMatchObject({
      feature: "chat",
      outcome: "model",
      billed: true,
      totalTokens: 4,
    });
    expect(JSON.stringify(rows[0])).not.toContain(SECRET);
  });
});

describe("metered xAI fetch", () => {
  it("records STT duration and bytes, not the transcript or error body", async () => {
    const rows = captureUsage();
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        Response.json({
          text: SECRET,
          duration: 4.5,
          usage: { input_tokens: 1, output_tokens: 2, total_tokens: 3 },
        })
      )
    );

    const ok = await meteredXaiFetch({
      feature: "stt",
      url: "https://api.x.ai/v1/stt",
      init: { method: "POST", body: "audio-bytes" },
      inputBytes: 440,
    });
    const body = (await ok.readJson()) as { text?: string };
    expect(body.text).toBe(SECRET);
    expect(rows[0]).toMatchObject({
      feature: "stt",
      outcome: "http_ok",
      billed: true,
      provider: "xai",
      inputBytes: 440,
      durationSeconds: 4.5,
      inputTokens: 1,
      outputTokens: 2,
      totalTokens: 3,
    });
    expect(JSON.stringify(rows[0])).not.toContain(SECRET);

    rows.length = 0;
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(`echo ${SECRET}`, { status: 502 }))
    );
    const failed = await meteredXaiFetch({
      feature: "stt",
      url: "https://api.x.ai/v1/stt",
      init: { method: "POST" },
      inputBytes: 10,
    });
    expect(await failed.errorText()).toContain(SECRET);
    expect(rows[0]).toMatchObject({
      feature: "stt",
      outcome: "http_error",
      billed: false,
      httpStatus: 502,
      inputBytes: 10,
    });
    expect(JSON.stringify(rows[0])).not.toContain(SECRET);
  });

  it("records TTS character and audio sizes, not the spoken text", async () => {
    const rows = captureUsage();
    const spoken = "Please describe your symptoms in detail";
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(new Uint8Array([9, 8, 7, 6]), { status: 200 }))
    );
    const metered = await meteredXaiFetch({
      feature: "tts",
      url: "https://api.x.ai/v1/tts",
      init: {
        method: "POST",
        body: JSON.stringify({ text: spoken }),
      },
      inputChars: spoken.length,
    });
    const audio = await metered.readBytes();
    expect(audio.byteLength).toBe(4);
    expect(rows[0]).toMatchObject({
      feature: "tts",
      outcome: "http_ok",
      billed: true,
      inputChars: spoken.length,
      outputBytes: 4,
    });
    expect(JSON.stringify(rows[0])).not.toContain(spoken);
    expect(JSON.stringify(rows[0])).not.toContain("symptoms");
  });
});

describe("call sites", () => {
  it("wraps OpenAI and xAI calls, keeps launch flags off, and does not schedule review summaries", () => {
    const meter = read("src/lib/ai/usage-meter.ts");
    const ai = read("src/actions/ai.ts");
    const reviews = read("src/lib/ai/review-summarizer.ts");
    const chat = read("src/app/api/chat/route.ts");
    const stt = read("src/app/api/voice/stt/route.ts");
    const tts = read("src/app/api/voice/tts/route.ts");
    const launch = read("src/lib/launch/soft-launch.ts");
    const vercel = read("vercel.json");

    expect(meter).toContain("export const AI_SDK_MAX_RETRIES = 0");
    expect(meter).toContain("maxRetries: AI_SDK_MAX_RETRIES");
    expect(meter).not.toMatch(/maxRetries:\s*2/);

    expect(ai).toContain('generateMeteredObject("symptom"');
    expect(ai).toContain('generateMeteredObject("nl_search"');
    expect(ai).toContain('meterNlSearch("cache")');
    expect(ai).toContain("isSymptomAnalysisEnabled");
    expect(ai).not.toContain("generateObject(");
    expect(ai).not.toContain("substring(");

    expect(reviews).toContain('generateMeteredObject("review_summary"');
    expect(reviews).not.toContain("generateObject(");

    expect(chat.indexOf("isPublicChatEnabled")).toBeGreaterThan(-1);
    expect(chat.indexOf("isPublicChatEnabled")).toBeLessThan(
      chat.indexOf('streamMeteredText("chat"')
    );
    expect(chat).not.toContain("streamText(");

    expect(stt.indexOf("isPublicChatEnabled")).toBeLessThan(
      stt.indexOf('feature: "stt"')
    );
    expect(tts.indexOf("isPublicChatEnabled")).toBeLessThan(
      tts.indexOf('feature: "tts"')
    );
    expect(stt).toContain("meteredXaiFetch");
    expect(tts).toContain("meteredXaiFetch");
    expect(stt).not.toContain("await fetch(");
    expect(tts).not.toContain("await fetch(");

    expect(launch).toContain("export function isPublicChatEnabled(): boolean {\n  return false;\n}");
    expect(launch).toContain(
      "export function isSymptomAnalysisEnabled(): boolean {\n  return false;\n}"
    );
    expect(vercel).not.toContain("generate-review-summaries");
  });
});

function read(path: string): string {
  return readFileSync(join(process.cwd(), path), "utf8");
}

function tokenShape() {
  return voiceMeterFromSttJson({
    usage: { inputTokens: 4, outputTokens: 1, totalTokens: 5, raw: SECRET },
  }).usage;
}

describe("recordAiUsage", () => {
  it("emits an ai_usage line", () => {
    const rows = captureUsage();
    recordAiUsage({
      feature: "chat",
      outcome: "cache",
      billed: false,
    });
    expect(rows[0]).toMatchObject({
      feature: "chat",
      outcome: "cache",
      billed: false,
      inputTokens: 0,
    });
  });
});
