import { describe, expect, it, afterEach } from "vitest";
import { NextRequest } from "next/server";
import { authorizeCronRequest } from "@/lib/cron/authorize";

function req(auth: string | null): NextRequest {
  const headers = new Headers();
  if (auth) headers.set("authorization", auth);
  return new NextRequest("http://localhost/api/cron/test", { headers });
}

describe("authorizeCronRequest", () => {
  const prev = process.env.CRON_SECRET;

  afterEach(() => {
    if (prev === undefined) delete process.env.CRON_SECRET;
    else process.env.CRON_SECRET = prev;
  });

  it("rejects when CRON_SECRET is unset even if caller sends Bearer undefined", async () => {
    delete process.env.CRON_SECRET;
    const denied = authorizeCronRequest(req("Bearer undefined"));
    expect(denied).not.toBeNull();
    expect(denied!.status).toBe(401);
  });

  it("rejects a missing or wrong Authorization header", async () => {
    process.env.CRON_SECRET = "correct-secret";
    expect(authorizeCronRequest(req(null))?.status).toBe(401);
    expect(authorizeCronRequest(req("Bearer wrong"))?.status).toBe(401);
  });

  it("allows a matching Bearer token", () => {
    process.env.CRON_SECRET = "correct-secret";
    expect(authorizeCronRequest(req("Bearer correct-secret"))).toBeNull();
  });
});

describe("cron routes use the fail-closed helper", () => {
  it("every cron route imports authorizeCronRequest", async () => {
    const { readdirSync, readFileSync, statSync } = await import("node:fs");
    const { join } = await import("node:path");
    const root = join(process.cwd(), "src/app/api/cron");
    const routes: string[] = [];
    for (const name of readdirSync(root)) {
      const route = join(root, name, "route.ts");
      try {
        if (statSync(route).isFile()) routes.push(route);
      } catch {
        /* skip */
      }
    }
    expect(routes.length).toBeGreaterThanOrEqual(12);
    for (const file of routes) {
      const src = readFileSync(file, "utf8");
      expect(src, file).toContain("authorizeCronRequest");
      expect(src, file).not.toMatch(
        /authHeader !== `Bearer \$\{process\.env\.CRON_SECRET\}`/
      );
    }
  });
});
