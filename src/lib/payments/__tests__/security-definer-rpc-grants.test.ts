import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const MIGRATIONS_DIR = join(process.cwd(), "supabase/migrations");
const FROM_MIGRATION = 124;

const OFFSET_RPCS = [
  "reserve_correction_offset",
  "release_reserved_offset_holds",
  "apply_reserved_offset_holds",
  "restore_offset_for_refund",
] as const;

type MigrationSource = {
  filename: string;
  sql: string;
};

/**
 * Blank comments and dollar-quoted bodies so CREATE/REVOKE parsing only sees
 * the statement shell. SECURITY DEFINER after `$$ ... $$` stays visible.
 */
function maskNonCode(sql: string): string {
  const chars = sql.split("");
  let i = 0;

  const blank = (from: number, to: number) => {
    for (let j = from; j < to; j++) {
      if (chars[j] !== "\n") chars[j] = " ";
    }
  };

  while (i < chars.length) {
    const c = chars[i];
    const next = chars[i + 1];
    if (c === "-" && next === "-") {
      const start = i;
      i += 2;
      while (i < chars.length && chars[i] !== "\n") i++;
      blank(start, i);
      continue;
    }
    if (c === "/" && next === "*") {
      const start = i;
      i += 2;
      while (i < chars.length && !(chars[i] === "*" && chars[i + 1] === "/")) i++;
      i = Math.min(chars.length, i + 2);
      blank(start, i);
      continue;
    }
    if (c === "'") {
      i++;
      while (i < chars.length) {
        if (chars[i] === "'" && chars[i + 1] === "'") {
          i += 2;
          continue;
        }
        if (chars[i] === "'") {
          i++;
          break;
        }
        i++;
      }
      continue;
    }
    if (c === "$") {
      const tag = sql.slice(i).match(/^\$[A-Za-z0-9_]*\$/);
      if (tag) {
        const close = sql.indexOf(tag[0], i + tag[0].length);
        if (close === -1) break;
        blank(i + tag[0].length, close);
        i = close + tag[0].length;
        continue;
      }
    }
    i++;
  }

  return chars.join("");
}

function unqualifiedName(ident: string): string {
  const parts = ident.split(".").map((part) => part.trim().replace(/^"|"$/g, ""));
  return parts[parts.length - 1].toLowerCase();
}

function securityDefinerFunctions(sql: string): string[] {
  const names: string[] = [];
  for (const statement of maskNonCode(sql).split(";")) {
    if (!/\bcreate\s+(?:or\s+replace\s+)?function\b/i.test(statement)) continue;
    if (!/\bsecurity\s+definer\b/i.test(statement)) continue;
    const match = statement.match(
      /\bcreate\s+(?:or\s+replace\s+)?function\s+((?:"[^"]+"|[A-Za-z_][\w$]*)(?:\s*\.\s*(?:"[^"]+"|[A-Za-z_][\w$]*))?)/i
    );
    if (!match) continue;
    names.push(unqualifiedName(match[1]));
  }
  return names;
}

function hasExecuteRevoke(sql: string, fn: string, role: "anon" | "authenticated"): boolean {
  const fnRe = new RegExp(`\\b${fn.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i");
  const orderRe = new RegExp(
    `\\brevoke\\b[\\s\\S]*?\\bexecute\\b[\\s\\S]*?\\bfrom\\b[\\s\\S]*?\\b${role}\\b`,
    "i"
  );
  return maskNonCode(sql)
    .split(";")
    .some((statement) => fnRe.test(statement) && orderRe.test(statement));
}

/** Function names that lack a same-or-later REVOKE EXECUTE from anon or authenticated. */
function functionsMissingExecuteRevoke(migrations: MigrationSource[]): string[] {
  const missing: string[] = [];
  migrations.forEach((migration, index) => {
    const laterSql = migrations
      .slice(index)
      .map((item) => item.sql)
      .join("\n");
    for (const name of securityDefinerFunctions(migration.sql)) {
      const roles = (["anon", "authenticated"] as const).filter(
        (role) => !hasExecuteRevoke(laterSql, name, role)
      );
      if (roles.length > 0) missing.push(name);
    }
  });
  return missing;
}

function migrationsFrom(minNumber: number): MigrationSource[] {
  return readdirSync(MIGRATIONS_DIR)
    .filter((filename) => /^\d+_.*\.sql$/.test(filename))
    .map((filename) => ({
      filename,
      number: Number(filename.slice(0, filename.indexOf("_"))),
    }))
    .filter((row) => row.number >= minNumber)
    .sort((a, b) => a.filename.localeCompare(b.filename))
    .map(({ filename }) => ({
      filename,
      sql: readFileSync(join(MIGRATIONS_DIR, filename), "utf8"),
    }));
}

describe("SECURITY DEFINER functions revoke EXECUTE from anon and authenticated", () => {
  it("covers every SECURITY DEFINER function defined from migration 00124 onward", () => {
    const migrations = migrationsFrom(FROM_MIGRATION);
    const defined = migrations.flatMap((migration) =>
      securityDefinerFunctions(migration.sql)
    );

    expect(migrations.some((migration) => migration.filename.startsWith("00124_"))).toBe(
      true
    );
    expect(defined).toEqual(expect.arrayContaining([...OFFSET_RPCS]));
    expect(defined).not.toContain("reject_payment_correction_audit_mutation");
    expect(defined).not.toContain("payment_correction_approvals_guard");

    const missing = functionsMissingExecuteRevoke(migrations);
    expect(
      missing,
      missing
        .map((name) => `${name}: missing REVOKE EXECUTE FROM anon or authenticated`)
        .join("\n")
    ).toEqual([]);
  });

  it("fails with the function name when anon or authenticated still has EXECUTE", () => {
    const defined = `
      CREATE FUNCTION public.example_rpc(p_id uuid)
      RETURNS void
      LANGUAGE plpgsql
      SECURITY DEFINER
      AS $$ BEGIN PERFORM 1; END; $$;
      REVOKE ALL ON FUNCTION public.example_rpc(uuid) FROM PUBLIC;
      GRANT EXECUTE ON FUNCTION public.example_rpc(uuid) TO service_role;
    `;
    const missing = functionsMissingExecuteRevoke([
      { filename: "00124_example.sql", sql: defined },
    ]);
    expect(missing).toEqual(["example_rpc"]);
  });

  it("accepts REVOKE EXECUTE in the same migration or a later one", () => {
    const defined = `
      CREATE OR REPLACE FUNCTION public.example_rpc(p_id uuid)
      RETURNS void
      LANGUAGE plpgsql
      SECURITY DEFINER
      SET search_path = public
      AS $$ BEGIN PERFORM 1; END; $$;
    `;
    const revoked = `
      -- Supabase default privileges
      REVOKE EXECUTE ON FUNCTION public.example_rpc(uuid) FROM anon, authenticated;
    `;
    expect(
      functionsMissingExecuteRevoke([
        { filename: "00124_example.sql", sql: defined + revoked },
      ])
    ).toEqual([]);
    expect(
      functionsMissingExecuteRevoke([
        { filename: "00124_example.sql", sql: defined },
        { filename: "00126_revoke.sql", sql: revoked },
      ])
    ).toEqual([]);
  });

  it("accepts one REVOKE EXECUTE listing several functions", () => {
    const defined = OFFSET_RPCS.map(
      (name) => `
        CREATE FUNCTION public.${name}(p_id uuid)
        RETURNS void
        LANGUAGE plpgsql
        SECURITY DEFINER
        AS $$ BEGIN PERFORM 1; END; $$;
      `
    ).join("\n");
    const revoked = `
      REVOKE EXECUTE ON FUNCTION public.reserve_correction_offset(uuid,uuid,int), public.release_reserved_offset_holds(uuid[]), public.apply_reserved_offset_holds(uuid), public.restore_offset_for_refund(uuid,text,int,int) FROM anon, authenticated;
    `;
    expect(
      functionsMissingExecuteRevoke([
        { filename: "00124_example.sql", sql: defined },
        { filename: "00126_revoke.sql", sql: revoked },
      ])
    ).toEqual([]);
  });

  it("does not let an earlier revoke cover a function defined later", () => {
    const revoked = `
      REVOKE EXECUTE ON FUNCTION public.example_rpc(uuid) FROM anon, authenticated;
    `;
    const defined = `
      CREATE FUNCTION public.example_rpc(p_id uuid) RETURNS void
      AS $$ BEGIN PERFORM 1; END; $$
      LANGUAGE plpgsql SECURITY DEFINER;
    `;
    expect(
      functionsMissingExecuteRevoke([
        { filename: "00124_revoke.sql", sql: revoked },
        { filename: "00126_define.sql", sql: defined },
      ])
    ).toEqual(["example_rpc"]);
  });
});
