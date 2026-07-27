import { describe, expect, it } from "vitest";
import {
  canonicalizeAppHost,
  getConfiguredAppOrigin,
  resolveAppOrigin,
} from "../origin";

describe("canonicalizeAppHost", () => {
  it("maps production apex to www for all three TLDs", () => {
    expect(canonicalizeAppHost("mydoctors360.com")).toBe("www.mydoctors360.com");
    expect(canonicalizeAppHost("mydoctors360.co.uk")).toBe(
      "www.mydoctors360.co.uk"
    );
    expect(canonicalizeAppHost("mydoctors360.eu")).toBe("www.mydoctors360.eu");
  });

  it("keeps www and preview hosts", () => {
    expect(canonicalizeAppHost("www.mydoctors360.eu")).toBe(
      "www.mydoctors360.eu"
    );
    expect(canonicalizeAppHost("mydoctors360-git-main.vercel.app")).toBe(
      "mydoctors360-git-main.vercel.app"
    );
  });

  it("keeps localhost port; picks first x-forwarded-host value", () => {
    expect(canonicalizeAppHost("localhost:3000")).toBe("localhost:3000");
    expect(canonicalizeAppHost("www.mydoctors360.com, other")).toBe(
      "www.mydoctors360.com"
    );
  });
});

describe("resolveAppOrigin", () => {
  it("prefers forwarded host over host and uses https on brand domains", () => {
    expect(
      resolveAppOrigin({
        host: "localhost:3000",
        forwardedHost: "mydoctors360.co.uk",
        proto: "http",
      })
    ).toBe("https://www.mydoctors360.co.uk");
  });

  it("keeps request TLD (.eu vs .com)", () => {
    expect(
      resolveAppOrigin({
        host: "www.mydoctors360.eu",
        proto: "https",
      })
    ).toBe("https://www.mydoctors360.eu");
    expect(
      resolveAppOrigin({
        host: "www.mydoctors360.com",
        proto: "https",
      })
    ).toBe("https://www.mydoctors360.com");
  });

  it("uses localhost with http when no production host", () => {
    expect(
      resolveAppOrigin({
        host: "localhost:3000",
        proto: "http",
      })
    ).toBe("http://localhost:3000");
  });

  it("falls back when host missing", () => {
    const origin = resolveAppOrigin({
      host: null,
      fallback: "https://www.mydoctors360.com/",
    });
    expect(origin).toBe("https://www.mydoctors360.com");
  });
});

describe("getConfiguredAppOrigin", () => {
  it("returns a non-empty absolute URL without trailing slash", () => {
    const o = getConfiguredAppOrigin();
    expect(o.startsWith("http")).toBe(true);
    expect(o.endsWith("/")).toBe(false);
  });
});

describe("request-origin wiring (signup / billing)", () => {
  it("auth and license checkout use getRequestOrigin not env-only URLs", async () => {
    const { readFileSync } = await import("node:fs");
    const { join } = await import("node:path");
    const auth = readFileSync(
      join(process.cwd(), "src/actions/auth.ts"),
      "utf8"
    );
    const license = readFileSync(
      join(process.cwd(), "src/actions/license.ts"),
      "utf8"
    );
    expect(auth).toContain("getRequestOrigin");
    expect(license).toContain("getRequestOrigin");
    // Billing checkout must not hardcode env for success/cancel only
    const checkoutBlock = license.slice(
      license.indexOf("export async function createLicenseCheckout"),
      license.indexOf("export async function setProfessionalSeatCapacity")
    );
    expect(checkoutBlock).toContain("getRequestOrigin");
    expect(checkoutBlock).not.toMatch(
      /success_url:\s*`\$\{process\.env\.NEXT_PUBLIC_APP_URL\}/
    );
  });
});
