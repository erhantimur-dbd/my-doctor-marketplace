import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

function read(rel: string): string {
  return readFileSync(join(process.cwd(), rel), "utf8");
}

function stripComments(sql: string): string {
  return sql
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/--.*$/gm, "")
    .trim();
}

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    if (entry === "node_modules" || entry === ".next") continue;
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      walk(full, out);
      continue;
    }
    if (/\.(ts|tsx|js|jsx|sql)$/.test(entry)) out.push(full.slice(process.cwd().length + 1));
  }
  return out;
}

const migrationPath = "supabase/migrations/00139_drop_public_organizations_view.sql";

describe("00139 drop public_organizations", () => {
  const migration = read(migrationPath);
  const sql = stripComments(migration);

  it("is the next numbered migration after 00138 and does not take 00135", () => {
    expect(migrationPath).toBe("supabase/migrations/00139_drop_public_organizations_view.sql");
    const names = readdirSync(join(process.cwd(), "supabase/migrations"));
    expect(names).toContain("00138_customer_refund_codes.sql");
    expect(names.filter((name) => name.startsWith("00139_"))).toEqual([
      "00139_drop_public_organizations_view.sql",
    ]);
    expect(names.some((name) => name.startsWith("00135_"))).toBe(false);
    expect(names.some((name) => name.startsWith("00140_"))).toBe(false);
  });

  it("drops the trigger, the view, then the function, and nothing else", () => {
    const triggerAt = sql.indexOf("DROP TRIGGER IF EXISTS trg_public_organizations_readonly");
    const viewAt = sql.indexOf("DROP VIEW IF EXISTS public.public_organizations;");
    const fnAt = sql.indexOf("DROP FUNCTION IF EXISTS public.reject_public_organization_write();");
    expect(triggerAt).toBeGreaterThan(0);
    expect(viewAt).toBeGreaterThan(triggerAt);
    expect(fnAt).toBeGreaterThan(viewAt);
    expect(sql).toContain("ON public.public_organizations");
    expect(sql).toContain("c.relname = 'public_organizations'");
    expect(sql).not.toMatch(/\bALTER\b/);
    expect(sql).not.toMatch(/\bGRANT\b/);
    expect(sql).not.toMatch(/\bREVOKE\b/);
    expect(sql).not.toMatch(/\bCREATE\b/);
    expect(sql).not.toMatch(/security_invoker/);
    expect(sql).not.toMatch(/\bCASCADE\b/);
    expect(sql).not.toMatch(/public\.organizations\b/);
    expect(migration).toContain("reject_public_organization_write");
    expect(migration).toContain("trg_public_organizations_readonly");
  });

  it("has no remaining query of the view", () => {
    const hits = walk(process.cwd()).filter((file) => {
      if (file.startsWith("supabase/migrations/")) return false;
      if (file.endsWith(".test.ts")) return false;
      return read(file).includes('.from("public_organizations")')
        || read(file).includes(".from('public_organizations')");
    });
    expect(hits).toEqual([]);
  });
});
