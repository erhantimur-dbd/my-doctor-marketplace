import { describe, expect, it } from "vitest";
import { sanitizeLogData } from "@/lib/utils/logger";

describe("sanitizeLogData", () => {
  it("keeps numeric token counts and redacts secrets", () => {
    expect(
      sanitizeLogData({
        inputTokens: 12,
        outputTokens: 3,
        totalTokens: 15,
        token: "sk-live",
        apiKey: "secret",
        inputTokensNote: "patient said chest pain",
      })
    ).toEqual({
      inputTokens: 12,
      outputTokens: 3,
      totalTokens: 15,
      token: "[REDACTED]",
      apiKey: "[REDACTED]",
      inputTokensNote: "[REDACTED]",
    });
  });

  it("redacts a non-number stored under a Tokens name", () => {
    expect(sanitizeLogData({ inputTokens: "the raw query" })).toEqual({
      inputTokens: "[REDACTED]",
    });
  });
});
