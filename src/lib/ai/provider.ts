import { openai } from "@ai-sdk/openai";
import { OPENAI_MODEL_ID } from "@/lib/ai/usage-meter";

/**
 * gpt-4o-mini. Call sites use `generateMeteredObject` / `streamMeteredText`,
 * which record usage and set `maxRetries` to 0 (SDK default is 2).
 */
export const aiModel = openai(OPENAI_MODEL_ID);

/**
 * Check whether the AI features are enabled (API key configured).
 */
export function isAIEnabled(): boolean {
  return !!process.env.OPENAI_API_KEY;
}

export {
  AI_SDK_MAX_RETRIES,
  generateMeteredObject,
  meterNlSearch,
  recordAiUsage,
  streamMeteredText,
} from "@/lib/ai/usage-meter";
