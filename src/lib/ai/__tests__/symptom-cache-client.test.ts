import { readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";

const SRC = join(process.cwd(), "src");

type CacheCall = {
  file: string;
  fn: string;
  op: string;
  client: string;
};

function walk(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === "node_modules") continue;
      out.push(...walk(path));
      continue;
    }
    if (/\.(ts|tsx)$/.test(entry.name) && !/\.test\.(ts|tsx)$/.test(entry.name)) {
      out.push(path);
    }
  }
  return out;
}

function functionAt(src: string, index: number): { name: string; body: string } {
  const starts = [
    ...src.matchAll(/(?:^|\n)(?:export\s+)?(?:async\s+)?function\s+([A-Za-z0-9_]+)/g),
  ];
  let chosen: { name: string; start: number } | null = null;
  for (const match of starts) {
    const start = match.index ?? 0;
    if (start <= index) chosen = { name: match[1], start };
  }
  if (!chosen) {
    return { name: "<module>", body: src };
  }
  const next = starts.find((match) => (match.index ?? 0) > index);
  const end = next?.index ?? src.length;
  return { name: chosen.name, body: src.slice(chosen.start, end) };
}

function clientForCall(before: string): string | null {
  if (/createAdminClient\(\)\s*$/.test(before)) return "createAdminClient()";
  const ident = before.match(/([A-Za-z_][A-Za-z0-9_]*)\s*$/);
  if (!ident) return null;
  const name = ident[1];
  const assignRe = new RegExp(
    `(?:const|let|var)\\s+${name}\\s*=\\s*(?:await\\s+)?([^;\\n]+)`,
    "g"
  );
  let rhs: string | null = null;
  for (const match of before.matchAll(assignRe)) rhs = match[1];
  if (!rhs) return null;
  const isAdmin = /(?<![A-Za-z0-9_])createAdminClient\s*\(/.test(rhs);
  const isUser =
    /(?<![A-Za-z0-9_])createClient\s*\(/.test(rhs) ||
    /(?<![A-Za-z0-9_])createServerClient\s*\(/.test(rhs) ||
    /(?<![A-Za-z0-9_])createBrowserClient\s*\(/.test(rhs);
  if (isAdmin && !isUser) return "createAdminClient()";
  return rhs.trim();
}

function cacheCalls(): CacheCall[] {
  const calls: CacheCall[] = [];
  const fromRe = /\.from\(\s*(['"])ai_symptom_cache\1\s*\)/g;
  for (const path of walk(SRC)) {
    const src = readFileSync(path, "utf8");
    const file = relative(process.cwd(), path);
    if (src.includes("ai_symptom_cache")) {
      const stray = src.replace(/\.from\(\s*(['"])ai_symptom_cache\1\s*\)/g, "");
      expect(stray, `${file} mentions ai_symptom_cache outside .from()`).not.toContain(
        "ai_symptom_cache"
      );
    }
    for (const match of src.matchAll(fromRe)) {
      const index = match.index ?? 0;
      const fn = functionAt(src, index);
      const client = clientForCall(src.slice(0, index));
      const after = src.slice(index, index + 160);
      const op = after.match(/\.(select|insert|update|upsert|delete)\s*\(/)?.[1] ?? "unknown";
      calls.push({
        file,
        fn: fn.name,
        op,
        client: client ?? "unknown",
      });
    }
  }
  return calls;
}

describe("ai_symptom_cache service-role client", () => {
  it("queries the cache only through createAdminClient and never writes input_text", () => {
    const calls = cacheCalls();
    expect(calls).toEqual([
      {
        file: "src/actions/ai.ts",
        fn: "analyzeSymptoms",
        op: "select",
        client: "createAdminClient()",
      },
      {
        file: "src/actions/ai.ts",
        fn: "analyzeSymptoms",
        op: "upsert",
        client: "createAdminClient()",
      },
    ]);

    for (const call of calls) {
      expect(call.client, `${call.file} ${call.fn} ${call.op}`).toBe("createAdminClient()");
    }

    const src = readFileSync(join(SRC, "actions/ai.ts"), "utf8");
    const fn = functionAt(src, src.indexOf('.from("ai_symptom_cache")'));
    expect(fn.name).toBe("analyzeSymptoms");
    expect(fn.body).toContain("createAdminClient()");
    expect(fn.body).not.toMatch(/(?<![A-Za-z0-9_])createClient\s*\(/);
    expect(fn.body).not.toMatch(/input_text\s*:/);
    expect(fn.body).toContain("input_hash:");
    expect(fn.body).toContain("locale,");
    expect(fn.body).toContain("result:");
    expect(fn.body).toContain("expires_at:");
  });
});
