import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const read = (rel: string) => readFileSync(join(process.cwd(), rel), "utf8");

describe("public chat widget + API", () => {
  it("keeps POST /api/chat anonymous-friendly (rate-limited, no login 401)", () => {
    const route = read("src/app/api/chat/route.ts");
    expect(route).toContain("rateLimit");
    expect(route).toContain("Anonymous-friendly");
    expect(route).not.toContain("Authentication required");
    expect(route).not.toContain('createClient');
    expect(route).not.toMatch(/supabase\.auth\.getUser/);
  });

  it("mounts ChatWidget on the public locale layout without an auth gate", () => {
    const layout = read("src/app/[locale]/layout.tsx");
    expect(layout).toContain("<ChatWidget");
    expect(layout).not.toMatch(/user\s*\?\s*<ChatWidget/);
    const widget = read("src/components/chat/chat-widget.tsx");
    expect(widget).toContain("ChatWindow");
  });
});
