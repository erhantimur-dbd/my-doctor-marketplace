import { openai } from "@ai-sdk/openai";

export const aiModel = openai("gpt-4o-mini");

/**
 * Check whether the AI features are enabled (API key configured).
 */
export function isAIEnabled(): boolean {
  return !!process.env.OPENAI_API_KEY;
}
