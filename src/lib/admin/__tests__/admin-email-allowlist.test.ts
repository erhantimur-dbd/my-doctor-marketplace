import { describe, expect, it } from "vitest";
import { adminEmailGateError } from "@/lib/admin/admin-email-allowlist";

describe("adminEmailGateError", () => {
  it("denies every caller in production when ADMIN_EMAILS is empty", () => {
    const env = { VERCEL_ENV: "production", NODE_ENV: "production", ADMIN_EMAILS: "" };
    expect(adminEmailGateError("admin@example.com", env)).toBe("Not authorized");
    expect(adminEmailGateError(null, env)).toBe("Not authorized");
  });

  it("denies an email that is not on the allowlist", () => {
    const env = {
      NODE_ENV: "production",
      ADMIN_EMAILS: "ops@example.com, other@example.com",
    };
    expect(adminEmailGateError("stranger@example.com", env)).toBe("Not authorized");
  });

  it("allows an allowlisted email regardless of case and spaces", () => {
    const env = {
      VERCEL_ENV: "production",
      ADMIN_EMAILS: " Ops@Example.com , other@example.com ",
    };
    expect(adminEmailGateError("ops@example.com", env)).toBeNull();
  });

  it("allows role-only checks outside production when the list is empty", () => {
    const env = { NODE_ENV: "test", VERCEL_ENV: "preview", ADMIN_EMAILS: "" };
    expect(adminEmailGateError("anyone@example.com", env)).toBeNull();
  });
});
