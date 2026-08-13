import { describe, expect, it } from "vitest";
import {
  isSafeRelativePath,
  sanitizeAuthLocale,
} from "@/lib/auth/return-cookie";

describe("isSafeRelativePath", () => {
  it("accepts same-origin paths including query and hash", () => {
    expect(isSafeRelativePath("/en/dashboard")).toBe(true);
    expect(isSafeRelativePath("/en/doctors/jane/book?date=2026-08-13")).toBe(
      true
    );
    expect(isSafeRelativePath("/en/login#form")).toBe(true);
  });

  it("rejects protocol-relative and backslash open redirects", () => {
    expect(isSafeRelativePath("//evil.com")).toBe(false);
    expect(isSafeRelativePath("/\\evil.com")).toBe(false);
    expect(isSafeRelativePath("/\\\\evil.com")).toBe(false);
    expect(isSafeRelativePath("/\tevil.com")).toBe(false);
    expect(isSafeRelativePath("/\nevil.com")).toBe(false);
  });

  it("rejects encoded slashes, @, and non-relative values", () => {
    expect(isSafeRelativePath("/%2f/evil.com")).toBe(false);
    expect(isSafeRelativePath("/%5cevil.com")).toBe(false);
    expect(isSafeRelativePath("/@evil.com")).toBe(false);
    expect(isSafeRelativePath("https://evil.com")).toBe(false);
    expect(isSafeRelativePath("")).toBe(false);
    expect(isSafeRelativePath("dashboard")).toBe(false);
  });
});

describe("sanitizeAuthLocale", () => {
  it("returns a known locale as-is", () => {
    expect(sanitizeAuthLocale("en")).toBe("en");
    expect(sanitizeAuthLocale("de")).toBe("de");
    expect(sanitizeAuthLocale("ja")).toBe("ja");
  });

  it("falls back instead of interpolating attacker-controlled locale", () => {
    expect(sanitizeAuthLocale("/evil.com")).toBe("en");
    expect(sanitizeAuthLocale("//evil.com")).toBe("en");
    expect(sanitizeAuthLocale("en/../../evil.com")).toBe("en");
    expect(sanitizeAuthLocale("")).toBe("en");
    expect(sanitizeAuthLocale(null)).toBe("en");
    expect(sanitizeAuthLocale(undefined)).toBe("en");
  });

  it("honours an explicit fallback when provided", () => {
    expect(sanitizeAuthLocale("nope", "de")).toBe("de");
  });
});

describe("auth actions use the shipped helpers", () => {
  it("login/register interpolate only sanitized locale and safe paths", async () => {
    const { readFileSync } = await import("node:fs");
    const { join } = await import("node:path");
    const auth = readFileSync(join(process.cwd(), "src/actions/auth.ts"), "utf8");
    expect(auth).toContain("sanitizeAuthLocale");
    expect(auth).toContain("isSafeRelativePath");
    expect(auth).not.toMatch(
      /startsWith\("\/"\) && !redirectTo\.startsWith\("\/\/"\)/
    );
    const accept = readFileSync(
      join(process.cwd(), "src/app/[locale]/(auth)/accept-terms/actions.ts"),
      "utf8"
    );
    expect(accept).toContain("sanitizeAuthLocale");
    expect(accept).toContain("isSafeRelativePath");
    expect(auth).toMatch(/formData\.get\("accepted"\)/);
    expect(auth).toContain("TERMS_VERSION");
    expect(auth).not.toMatch(/terms_version:\s*"2026-03-17"/);
  });
});
