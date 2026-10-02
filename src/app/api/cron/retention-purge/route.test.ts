import { afterEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const rpc = vi.fn();
const from = vi.fn();

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({ from, rpc }),
}));

vi.mock("@/lib/daily/client", () => ({
  deleteRoom: vi.fn(),
}));

import { GET } from "./route";

const envBackup = process.env.CRON_SECRET;

afterEach(() => {
  process.env.CRON_SECRET = envBackup;
  rpc.mockReset();
  from.mockReset();
});

function request() {
  return new NextRequest("http://localhost/api/cron/retention-purge", {
    headers: { authorization: "Bearer test-secret" },
  });
}

function settings(mode: string) {
  from.mockImplementation((table: string) => {
    if (table === "platform_settings") {
      return {
        select: () => ({
          eq: () => ({
            maybeSingle: async () => ({ data: { value: { mode } }, error: null }),
          }),
        }),
      };
    }
    return {
      select: () => ({
        is: () => ({
          limit: async () => ({ data: [], error: null }),
        }),
      }),
    };
  });
}

describe("retention purge cron", () => {
  it("returns 401 when CRON_SECRET is missing", async () => {
    delete process.env.CRON_SECRET;
    const response = await GET(request());
    expect(response.status).toBe(401);
    expect(rpc).not.toHaveBeenCalled();
  });

  it("counts only while the setting is dry_run", async () => {
    process.env.CRON_SECRET = "test-secret";
    settings("dry_run");
    rpc.mockResolvedValue({ data: { mode: "dry_run", dry_run: true }, error: null });

    const response = await GET(request());

    expect(response.status).toBe(200);
    expect(rpc).toHaveBeenCalledWith("purge_expired_retention", {
      p_dry_run: true,
      p_limit: 500,
    });
  });

  it("does not apply when the setting is off", async () => {
    process.env.CRON_SECRET = "test-secret";
    settings("off");
    rpc.mockResolvedValue({ data: { mode: "off" }, error: null });

    await GET(request());

    expect(rpc).toHaveBeenCalledWith("purge_expired_retention", {
      p_dry_run: true,
      p_limit: 500,
    });
  });

  it("passes apply only when the setting says apply", async () => {
    process.env.CRON_SECRET = "test-secret";
    settings("apply");
    rpc.mockResolvedValue({ data: { mode: "apply", dry_run: false }, error: null });

    await GET(request());

    expect(rpc).toHaveBeenCalledWith("purge_expired_retention", {
      p_dry_run: false,
      p_limit: 500,
    });
  });
});
