import { describe, expect, it } from "vitest";
import {
  isAdminEmailDenied,
  parseAdminEmails,
} from "@/lib/admin/allowlist";

describe("parseAdminEmails", () => {
  it("splits, trims, lowercases, and drops empties", () => {
    expect(parseAdminEmails("  A@X.com, b@x.com ,")).toEqual([
      "a@x.com",
      "b@x.com",
    ]);
    expect(parseAdminEmails("")).toEqual([]);
    expect(parseAdminEmails(null)).toEqual([]);
    expect(parseAdminEmails(undefined)).toEqual([]);
  });
});

describe("isAdminEmailDenied", () => {
  it("fail-closes in production when the allowlist is empty", () => {
    expect(
      isAdminEmailDenied("admin@mydoctors360.com", {
        allowlist: [],
        isProduction: true,
      })
    ).toBe(true);
  });

  it("allows role-only access in non-production when the allowlist is empty", () => {
    expect(
      isAdminEmailDenied("admin@mydoctors360.com", {
        allowlist: [],
        isProduction: false,
      })
    ).toBe(false);
  });

  it("enforces the allowlist in production and in development when configured", () => {
    const allowlist = parseAdminEmails("alice@x.com, Bob@X.com");
    expect(
      isAdminEmailDenied("alice@x.com", { allowlist, isProduction: true })
    ).toBe(false);
    expect(
      isAdminEmailDenied("BOB@x.com", { allowlist, isProduction: false })
    ).toBe(false);
    expect(
      isAdminEmailDenied("eve@x.com", { allowlist, isProduction: true })
    ).toBe(true);
    expect(
      isAdminEmailDenied("eve@x.com", { allowlist, isProduction: false })
    ).toBe(true);
    expect(
      isAdminEmailDenied(null, { allowlist, isProduction: true })
    ).toBe(true);
  });
});
