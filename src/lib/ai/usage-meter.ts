import { generateObject, streamText, type FlexibleSchema, type InferSchema, type LanguageModel } from "ai";
import { log } from "@/lib/utils/logger";

/**
 * Shared cost meter for OpenAI and xAI.
 *
 * One `ai_usage` log line per outcome. There is no `ai_usage` table on main.
 * Production logger emits JSON. Counts only — never a query, review, transcript, or audio.
 *
 * PR #38 (unmerged) logs `nl_search` from a private helper with
 * `feature`, `outcome`, `billed`, and token counts. Call `meterNlSearch`
 * from here for local / cache / emergency lines. A model call should go
 * through `generateMeteredObject` once — that already records `model` /
 * `model_error` and forces `maxRetries` to 0. Do not also call
 * `meterNlSearch("model")` for the same attempt.
 *
 * Numeric `*Tokens` fields survive `sanitizeLogData`. A string under those
 * names is still redacted.
 */

/** AI SDK default is 2 (three billed attempts). One attempt. */
export const AI_SDK_MAX_RETRIES = 0;

export const OPENAI_MODEL_ID = "gpt-4o-mini";

export const AI_FEATURES = [
  "nl_search",
  "symptom",
  "review_summary",
  "chat",
  "stt",
  "tts",
] as const;

export type AiFeature = (typeof AI_FEATURES)[number];

/** `model` through `emergency` match PR #38. Voice HTTP uses the last two. */
export type AiUsageOutcome =
  | "model"
  | "model_error"
  | "local"
  | "cache"
  | "emergency"
  | "http_ok"
  | "http_error";

export type AiTokenUsage = {
  inputTokens?: number | null;
  outputTokens?: number | null;
  totalTokens?: number | null;
};

export type AiUsageEvent = {
  feature: AiFeature;
  outcome: AiUsageOutcome;
  /** Defaults to true for `model` and `model_error` only. */
  billed?: boolean;
  usage?: AiTokenUsage | null;
  provider?: "openai" | "xai";
  model?: string;
  /** Sizes and durations. Not content. */
  inputBytes?: number;
  outputBytes?: number;
  inputChars?: number;
  durationSeconds?: number;
  httpStatus?: number;
};

const MODEL_BILLED = new Set<AiUsageOutcome>(["model", "model_error"]);

export function deploymentEnv(): string {
  const vercel = process.env.VERCEL_ENV?.trim();
  if (vercel) return vercel;
  const nodeEnv = process.env.NODE_ENV?.trim();
  if (nodeEnv) return nodeEnv;
  return "unknown";
}

function count(value: number | null | undefined): number {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) return 0;
  return value;
}

/** Token counts only. Ignores `raw` and any other provider payload. */
export function tokenUsageFromUnknown(usage: unknown): AiTokenUsage {
  if (!usage || typeof usage !== "object") return {};
  const row = usage as Record<string, unknown>;
  const input =
    typeof row.inputTokens === "number"
      ? row.inputTokens
      : typeof row.promptTokens === "number"
        ? row.promptTokens
        : typeof row.input_tokens === "number"
          ? row.input_tokens
          : undefined;
  const output =
    typeof row.outputTokens === "number"
      ? row.outputTokens
      : typeof row.completionTokens === "number"
        ? row.completionTokens
        : typeof row.output_tokens === "number"
          ? row.output_tokens
          : undefined;
  const total =
    typeof row.totalTokens === "number"
      ? row.totalTokens
      : typeof row.total_tokens === "number"
        ? row.total_tokens
        : input != null && output != null
          ? input + output
          : undefined;
  return { inputTokens: input, outputTokens: output, totalTokens: total };
}

/**
 * STT JSON: `duration` and token usage only.
 * Drops `text`, `transcript`, `words`, and `channels`.
 */
export function voiceMeterFromSttJson(body: unknown): {
  usage: AiTokenUsage;
  durationSeconds?: number;
} {
  if (!body || typeof body !== "object") return { usage: {} };
  const row = body as Record<string, unknown>;
  const durationSeconds =
    typeof row.duration === "number" && Number.isFinite(row.duration) && row.duration >= 0
      ? row.duration
      : undefined;
  return {
    usage: tokenUsageFromUnknown(row.usage),
    durationSeconds,
  };
}

export function aiUsagePayload(event: AiUsageEvent): Record<string, unknown> {
  const provider =
    event.provider ??
    (event.feature === "stt" || event.feature === "tts" ? "xai" : "openai");
  const billed = event.billed ?? MODEL_BILLED.has(event.outcome);

  const payload: Record<string, unknown> = {
    feature: event.feature,
    outcome: event.outcome,
    billed,
    env: deploymentEnv(),
    provider,
    inputTokens: count(event.usage?.inputTokens),
    outputTokens: count(event.usage?.outputTokens),
    totalTokens: count(event.usage?.totalTokens),
  };

  if (event.model) payload.model = event.model;
  if (event.inputBytes != null) payload.inputBytes = count(event.inputBytes);
  if (event.outputBytes != null) payload.outputBytes = count(event.outputBytes);
  if (event.inputChars != null) payload.inputChars = count(event.inputChars);
  if (event.durationSeconds != null) {
    payload.durationSeconds = count(event.durationSeconds);
  }
  if (event.httpStatus != null) payload.httpStatus = count(event.httpStatus);

  return payload;
}

export function recordAiUsage(event: AiUsageEvent): void {
  log.info("ai_usage", aiUsagePayload(event));
}

/**
 * Drop-in for PR #38's NL meter. Adds `env` (`VERCEL_ENV`) and `provider`.
 * Use for outcomes that do not call the model (`local`, `cache`, `emergency`).
 */
export function meterNlSearch(
  outcome: "model" | "model_error" | "local" | "cache" | "emergency",
  usage?: AiTokenUsage
): void {
  const billed = outcome === "model" || outcome === "model_error";
  recordAiUsage({
    feature: "nl_search",
    outcome,
    usage,
    provider: "openai",
    ...(billed ? { model: OPENAI_MODEL_ID } : {}),
    billed,
  });
}

type OpenAiObjectFeature = "nl_search" | "symptom" | "review_summary";

export async function generateMeteredObject<SCHEMA extends FlexibleSchema<unknown>>(
  feature: OpenAiObjectFeature,
  options: {
    model: LanguageModel;
    schema: SCHEMA;
    prompt: string;
    system?: string;
    abortSignal?: AbortSignal;
  }
): Promise<{ object: InferSchema<SCHEMA>; usage: AiTokenUsage }> {
  try {
    const result = await generateObject({
      model: options.model,
      schema: options.schema,
      prompt: options.prompt,
      ...(options.system ? { system: options.system } : {}),
      ...(options.abortSignal ? { abortSignal: options.abortSignal } : {}),
      maxRetries: AI_SDK_MAX_RETRIES,
    });
    const usage = tokenUsageFromUnknown(result.usage);
    recordAiUsage({
      feature,
      outcome: "model",
      usage,
      provider: "openai",
      model: OPENAI_MODEL_ID,
      billed: true,
    });
    return { object: result.object as InferSchema<SCHEMA>, usage };
  } catch (error) {
    recordAiUsage({
      feature,
      outcome: "model_error",
      provider: "openai",
      model: OPENAI_MODEL_ID,
      billed: true,
    });
    throw error;
  }
}

export function streamMeteredText(
  feature: "chat",
  options: Parameters<typeof streamText>[0]
): ReturnType<typeof streamText> {
  const userOnError = options.onError;
  let result: ReturnType<typeof streamText>;
  try {
    result = streamText({
      ...options,
      maxRetries: AI_SDK_MAX_RETRIES,
      onError: (event) => {
        log.error("ai stream error", {
          feature,
          name: event.error instanceof Error ? event.error.name : "unknown",
        });
        return userOnError?.(event);
      },
    });
  } catch (error) {
    recordAiUsage({
      feature,
      outcome: "model_error",
      provider: "openai",
      model: OPENAI_MODEL_ID,
      billed: true,
    });
    throw error;
  }

  void Promise.resolve(result.totalUsage).then(
    (usage) => {
      recordAiUsage({
        feature,
        outcome: "model",
        usage: tokenUsageFromUnknown(usage),
        provider: "openai",
        model: OPENAI_MODEL_ID,
        billed: true,
      });
    },
    () => {
      recordAiUsage({
        feature,
        outcome: "model_error",
        provider: "openai",
        model: OPENAI_MODEL_ID,
        billed: true,
      });
    }
  );

  return result;
}

export type MeteredXaiResponse = {
  ok: boolean;
  status: number;
  contentType: string | null;
  /** Error body for the HTTP response to the client. Not written to the meter. */
  errorText: () => Promise<string>;
  readJson: () => Promise<unknown>;
  readBytes: () => Promise<ArrayBuffer>;
};

/**
 * One xAI STT/TTS fetch. Success is recorded when the body is read
 * (`readJson` for STT, `readBytes` for TTS). The meter stores byte counts,
 * character counts, duration, and token fields — not the body.
 */
export async function meteredXaiFetch(args: {
  feature: "stt" | "tts";
  url: string;
  init: RequestInit;
  inputBytes?: number;
  inputChars?: number;
}): Promise<MeteredXaiResponse> {
  const base = {
    feature: args.feature,
    provider: "xai" as const,
    inputBytes: args.inputBytes,
    inputChars: args.inputChars,
  };

  let response: Response;
  try {
    response = await fetch(args.url, args.init);
  } catch (error) {
    recordAiUsage({ ...base, outcome: "http_error", billed: false });
    throw error;
  }

  const contentType = response.headers.get("content-type");
  let consumed = false;
  const consumeGuard = () => {
    if (consumed) throw new Error("xAI response body already read");
    consumed = true;
  };

  if (!response.ok) {
    recordAiUsage({
      ...base,
      outcome: "http_error",
      billed: false,
      httpStatus: response.status,
    });
    return {
      ok: false,
      status: response.status,
      contentType,
      errorText: async () => {
        consumeGuard();
        try {
          return await response.text();
        } catch {
          return "";
        }
      },
      readJson: async () => {
        throw new Error("xAI error response");
      },
      readBytes: async () => {
        throw new Error("xAI error response");
      },
    };
  }

  return {
    ok: true,
    status: response.status,
    contentType,
    errorText: async () => "",
    readJson: async () => {
      consumeGuard();
      let body: unknown;
      try {
        body = await response.json();
      } catch {
        recordAiUsage({
          ...base,
          outcome: "http_ok",
          billed: true,
          httpStatus: response.status,
        });
        throw new Error("xAI response was not JSON");
      }
      const measured = voiceMeterFromSttJson(body);
      recordAiUsage({
        ...base,
        outcome: "http_ok",
        billed: true,
        httpStatus: response.status,
        usage: measured.usage,
        durationSeconds: measured.durationSeconds,
      });
      return body;
    },
    readBytes: async () => {
      consumeGuard();
      let audio: ArrayBuffer;
      try {
        audio = await response.arrayBuffer();
      } catch {
        recordAiUsage({
          ...base,
          outcome: "http_ok",
          billed: true,
          httpStatus: response.status,
        });
        throw new Error("xAI audio response could not be read");
      }
      recordAiUsage({
        ...base,
        outcome: "http_ok",
        billed: true,
        httpStatus: response.status,
        outputBytes: audio.byteLength,
      });
      return audio;
    },
  };
}
