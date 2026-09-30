import { beforeEach, describe, expect, it, vi } from "vitest";

const upsert = vi.fn();

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    from: (table: string) => {
      if (table !== "launch_notifications") {
        throw new Error(`unexpected table ${table}`);
      }
      return { upsert };
    },
  }),
}));

vi.mock("@/lib/rate-limit", () => ({
  rateLimit: vi.fn(async () => ({
    limited: false,
    remaining: 4,
    retryAfterMs: 0,
  })),
}));

vi.mock("@/lib/utils/logger", () => ({
  log: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

import { POST } from "./route";
import { rateLimit } from "@/lib/rate-limit";

function post(body: unknown) {
  return POST(
    new Request("http://localhost/api/waitlist/patient", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-forwarded-for": "203.0.113.10",
      },
      body: JSON.stringify(body),
    })
  );
}

describe("POST /api/waitlist/patient", () => {
  beforeEach(() => {
    upsert.mockReset();
    upsert.mockResolvedValue({ error: null });
    vi.mocked(rateLimit).mockResolvedValue({
      limited: false,
      remaining: 4,
      retryAfterMs: 0,
    });
  });

  it("saves name and email on launch_notifications and does not store a discount", async () => {
    const res = await post({ name: "Ada Patient", email: "Ada@Example.com" });
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ success: true });
    expect(upsert).toHaveBeenCalledWith(
      {
        name: "Ada Patient",
        email: "ada@example.com",
        region: "marketplace",
      },
      { onConflict: "email,region" }
    );
    const payload = upsert.mock.calls[0][0] as Record<string, unknown>;
    expect(payload).not.toHaveProperty("discount_percent");
    expect(payload).not.toHaveProperty("entitlement_kind");
  });

  it("returns an error for an empty email and does not write a row", async () => {
    const res = await post({ name: "Ada Patient", email: "" });
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toMatch(/email/i);
    expect(upsert).not.toHaveBeenCalled();
  });

  it("returns an error when storage fails", async () => {
    upsert.mockResolvedValue({ error: { message: "db down" } });
    const res = await post({ name: "Ada Patient", email: "ada@example.com" });
    expect(res.status).toBe(500);
    const json = await res.json();
    expect(json.error).toMatch(/something went wrong/i);
    expect(json.success).toBeUndefined();
  });
});
