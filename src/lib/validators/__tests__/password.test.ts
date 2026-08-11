import { describe, expect, it } from "vitest";
import {
  passwordMeetsServerMinimum,
  passwordSchema,
  passwordVarietyScore,
} from "@/lib/validators/password";

describe("password rules (client/server aligned)", () => {
  it("scores character variety", () => {
    expect(passwordVarietyScore("abcdefgh")).toBe(1);
    expect(passwordVarietyScore("Abcdefgh")).toBe(2);
    expect(passwordVarietyScore("Abcdefg1")).toBe(3);
    expect(passwordVarietyScore("Abcdef1!")).toBe(4);
  });

  it("meets server minimum only with length + 3 variety classes", () => {
    expect(passwordMeetsServerMinimum("short")).toBe(false);
    expect(passwordMeetsServerMinimum("alllowercase")).toBe(false);
    expect(passwordMeetsServerMinimum("Abcdefg1")).toBe(true);
    expect(passwordMeetsServerMinimum("abcdefgh")).toBe(false);
  });

  it("passwordSchema accepts medium+ passwords", () => {
    expect(passwordSchema.safeParse("Abcdefg1").success).toBe(true);
    expect(passwordSchema.safeParse("weakweak").success).toBe(false);
  });
});
