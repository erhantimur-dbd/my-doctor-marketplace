import { beforeEach, describe, expect, it, vi } from "vitest";

const upsert = vi.fn();

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    from: (table: string) => {
      if (table !== "doctor_waitlist") {
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

function post(body: unknown) {
  return POST(
    new Request("http://localhost/api/waitlist/doctor", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    })
  );
}

const ukDoctor = {
  name: "Dr Jane Smith",
  email: "jane@example.com",
  specialty: "general-practice",
  country: "GB",
};

describe("POST /api/waitlist/doctor", () => {
  beforeEach(() => {
    upsert.mockReset();
    upsert.mockResolvedValue({ error: null });
  });

  it("saves a United Kingdom doctor", async () => {
    const res = await post(ukDoctor);
    expect(res.status).toBe(200);
    expect(upsert).toHaveBeenCalledWith(
      expect.objectContaining({ country: "GB" }),
      { onConflict: "email" }
    );
  });

  it("rejects a country other than the United Kingdom and does not write a row", async () => {
    const res = await post({ ...ukDoctor, country: "IE" });
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toMatch(/United Kingdom/i);
    expect(upsert).not.toHaveBeenCalled();
  });
});
