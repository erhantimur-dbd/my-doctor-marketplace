import { describe, expect, it } from "vitest";
import {
  canonicalizeAppHost,
  getConfiguredAppOrigin,
  isAllowedAppHost,
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

  it("ignores untrusted forwarded hosts", () => {
    expect(isAllowedAppHost("evil.com")).toBe(false);
    expect(isAllowedAppHost("attacker.vercel.app")).toBe(false);
    expect(
      resolveAppOrigin({
        host: "localhost:3000",
        forwardedHost: "evil.com",
        proto: "http",
        fallback: "https://www.mydoctors360.com",
      })
    ).toBe("http://localhost:3000");
    expect(
      resolveAppOrigin({
        host: "localhost:3000",
        forwardedHost: "attacker.vercel.app",
        proto: "http",
      })
    ).toBe("http://localhost:3000");
  });

  it("allows this deployment's Vercel host but not an attacker preview", () => {
    const prev = {
      VERCEL_URL: process.env.VERCEL_URL,
      VERCEL_BRANCH_URL: process.env.VERCEL_BRANCH_URL,
      VERCEL_PROJECT_PRODUCTION_URL: process.env.VERCEL_PROJECT_PRODUCTION_URL,
    };
    process.env.VERCEL_URL = "mydoctors360-abc.vercel.app";
    delete process.env.VERCEL_BRANCH_URL;
    delete process.env.VERCEL_PROJECT_PRODUCTION_URL;
    expect(isAllowedAppHost("mydoctors360-abc.vercel.app")).toBe(true);
    expect(isAllowedAppHost("attacker.vercel.app")).toBe(false);
    expect(
      resolveAppOrigin({
        host: "mydoctors360-git-main-team.vercel.app",
        proto: "https",
      })
    ).toBe("https://mydoctors360-git-main-team.vercel.app");
    if (prev.VERCEL_URL === undefined) delete process.env.VERCEL_URL;
    else process.env.VERCEL_URL = prev.VERCEL_URL;
    if (prev.VERCEL_BRANCH_URL === undefined) delete process.env.VERCEL_BRANCH_URL;
    else process.env.VERCEL_BRANCH_URL = prev.VERCEL_BRANCH_URL;
    if (prev.VERCEL_PROJECT_PRODUCTION_URL === undefined) {
      delete process.env.VERCEL_PROJECT_PRODUCTION_URL;
    } else {
      process.env.VERCEL_PROJECT_PRODUCTION_URL =
        prev.VERCEL_PROJECT_PRODUCTION_URL;
    }
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
