import { describe, expect, it, vi } from "vitest";
import { lockLegacyDailyRooms } from "@/lib/daily/lock-legacy-rooms";

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

describe("lockLegacyDailyRooms", () => {
  it("pages rooms, locks only md-* names, and skips the rest", async () => {
    const calls: { url: string; method: string; body: string }[] = [];
    const fetchImpl = vi.fn(async (url: string | URL, init?: RequestInit) => {
      const href = String(url);
      calls.push({
        url: href,
        method: init?.method || "GET",
        body: String(init?.body ?? ""),
      });
      if (href.includes("/rooms/md-")) {
        return jsonResponse({ privacy: "private" });
      }
      if (href.includes("starting_after=room-2")) {
        return jsonResponse({
          data: [
            { id: "room-3", name: "md-bk-3" },
            { id: "room-4", name: "lobby" },
          ],
        });
      }
      return jsonResponse({
        data: [
          { id: "room-1", name: "md-bk-1" },
          { id: "room-2", name: "sales-demo" },
        ],
      });
    });
    const lines: string[] = [];

    const result = await lockLegacyDailyRooms({
      apiKey: "test-daily-key",
      dryRun: false,
      pageSize: 2,
      fetchImpl: fetchImpl as unknown as typeof fetch,
      log: (line) => lines.push(line),
    });

    expect(result.matched).toEqual(["md-bk-1", "md-bk-3"]);
    expect(result.locked).toBe(2);
    expect(result.skipped).toBe(2);
    const posts = calls.filter((call) => call.method === "POST");
    expect(posts.map((call) => call.url)).toEqual([
      "https://api.daily.co/v1/rooms/md-bk-1",
      "https://api.daily.co/v1/rooms/md-bk-3",
    ]);
    expect(JSON.parse(posts[0]!.body)).toEqual({
      privacy: "private",
      properties: { enable_knocking: false },
    });
    expect(lines.join("\n")).toContain("md-bk-1");
    expect(lines.join("\n")).toContain("matched=2 locked=2 skipped=2");
    expect(lines.join("\n")).not.toContain("test-daily-key");
    expect(lines.join("\n")).not.toContain("daily.co/");
  });

  it("dry-run logs md-* names and does not post", async () => {
    const fetchImpl = vi.fn(async () =>
      jsonResponse({
        data: [{ id: "room-1", name: "md-bk-1" }],
      })
    );
    const lines: string[] = [];
    const result = await lockLegacyDailyRooms({
      apiKey: "test-daily-key",
      dryRun: true,
      fetchImpl: fetchImpl as unknown as typeof fetch,
      log: (line) => lines.push(line),
    });

    expect(result.locked).toBe(0);
    expect(result.matched).toEqual(["md-bk-1"]);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(lines[0]).toContain("dry-run md-bk-1");
  });
});
