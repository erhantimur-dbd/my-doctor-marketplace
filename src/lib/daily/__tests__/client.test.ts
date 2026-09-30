import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createRoom, setRoomPrivate } from "@/lib/daily/client";

const calls: { url: string; init: RequestInit | undefined }[] = [];

beforeEach(() => {
  calls.length = 0;
  process.env.DAILY_API_KEY = "test-daily-key";
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init?: RequestInit) => {
      calls.push({ url: String(url), init });
      return new Response(
        JSON.stringify({
          id: "room-1",
          name: "md-bk-1",
          url: "https://md360.daily.co/md-bk-1",
          created_at: "2026-09-26T00:00:00.000Z",
          config: {},
          privacy: "private",
        }),
        { status: 200, headers: { "content-type": "application/json" } }
      );
    })
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("createRoom", () => {
  it("creates a private room and keeps the existing expiry", async () => {
    const expiresAt = 1_800_000_000;
    await createRoom({
      name: "md-bk-1",
      expiresAt,
      maxParticipants: 2,
    });

    expect(calls).toHaveLength(1);
    expect(calls[0]?.url).toBe("https://api.daily.co/v1/rooms");
    expect(calls[0]?.init?.method).toBe("POST");
    expect(calls[0]?.init?.headers).toMatchObject({
      Authorization: "Bearer test-daily-key",
    });
    const body = JSON.parse(String(calls[0]?.init?.body));
    expect(body.privacy).toBe("private");
    expect(body.properties.exp).toBe(expiresAt);
    expect(body.properties.max_participants).toBe(2);
    expect(body.properties.enable_knocking).toBe(false);
    expect(body.privacy).not.toBe("public");
  });
});

describe("setRoomPrivate", () => {
  it("updates an existing room to private and disables knocking", async () => {
    await setRoomPrivate("md-bk public");
    expect(calls[0]?.url).toBe(
      "https://api.daily.co/v1/rooms/md-bk%20public"
    );
    expect(calls[0]?.init?.method).toBe("POST");
    const body = JSON.parse(String(calls[0]?.init?.body));
    expect(body).toEqual({
      privacy: "private",
      properties: { enable_knocking: false },
    });
  });
});
