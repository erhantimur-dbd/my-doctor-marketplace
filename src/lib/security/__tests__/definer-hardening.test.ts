import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  DEFINER_GRANT_ALLOWLIST,
  isAvailabilityGrantException,
  mayKeepAnonExecute,
} from "../definer-grant-allowlist";

const MIGRATIONS_DIR = join(process.cwd(), "supabase/migrations");

type FnState = {
  name: string;
  signature: string;
  securityDefiner: boolean;
  searchPath: string | null;
  anon: boolean;
  authenticated: boolean;
  publicGrant: boolean;
};

function statementsOf(sql: string): string[] {
  const out: string[] = [];
  let start = 0;
  let i = 0;
  let dollar: string | null = null;
  while (i < sql.length) {
    if (dollar) {
      if (sql.startsWith(dollar, i)) {
        i += dollar.length;
        dollar = null;
      } else {
        i++;
      }
      continue;
    }
    if (sql.startsWith("--", i)) {
      const nl = sql.indexOf("\n", i);
      i = nl === -1 ? sql.length : nl + 1;
      continue;
    }
    if (sql.startsWith("/*", i)) {
      const end = sql.indexOf("*/", i + 2);
      i = end === -1 ? sql.length : end + 2;
      continue;
    }
    if (sql[i] === "'") {
      i++;
      while (i < sql.length) {
        if (sql.startsWith("''", i)) {
          i += 2;
          continue;
        }
        if (sql[i] === "'") {
          i++;
          break;
        }
        i++;
      }
      continue;
    }
    const tag = sql.slice(i).match(/^\$[A-Za-z0-9_]*\$/);
    if (tag) {
      dollar = tag[0];
      i += tag[0].length;
      continue;
    }
    if (sql[i] === ";") {
      const statement = sql.slice(start, i).trim();
      if (statement) out.push(statement);
      i++;
      start = i;
      continue;
    }
    i++;
  }
  return out;
}

function shellOf(statement: string): string {
  const chars = statement.split("");
  let i = 0;
  const blank = (from: number, to: number) => {
    for (let j = from; j < to; j++) {
      if (chars[j] !== "\n") chars[j] = " ";
    }
  };
  while (i < chars.length) {
    if (chars[i] === "-" && chars[i + 1] === "-") {
      const start = i;
      i += 2;
      while (i < chars.length && chars[i] !== "\n") i++;
      blank(start, i);
      continue;
    }
    if (chars[i] === "/" && chars[i + 1] === "*") {
      const start = i;
      i += 2;
      while (i < chars.length && !(chars[i] === "*" && chars[i + 1] === "/")) i++;
      i = Math.min(chars.length, i + 2);
      blank(start, i);
      continue;
    }
    if (chars[i] === "'") {
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
    if (chars[i] === "$") {
      const tag = statement.slice(i).match(/^\$[A-Za-z0-9_]*\$/);
      if (tag) {
        const close = statement.indexOf(tag[0], i + tag[0].length);
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

function splitCommas(input: string): string[] {
  const parts: string[] = [];
  let current = "";
  let depth = 0;
  for (const ch of input) {
    if (ch === "(") depth++;
    else if (ch === ")") depth = Math.max(0, depth - 1);
    if (ch === "," && depth === 0) {
      parts.push(current.trim());
      current = "";
    } else {
      current += ch;
    }
  }
  if (current.trim()) parts.push(current.trim());
  return parts;
}

function normalizeType(part: string): string {
  let text = part.trim().replace(/\s+default\s+[\s\S]*$/i, "").trim();
  text = text.replace(/^(inout|variadic|in|out)\s+/i, "");
  const typeStart =
    /^(uuid|text|int|integer|bigint|smallint|boolean|bool|date|time|timestamp|timestamptz|numeric|jsonb|json|bytea|float|double|real|interval|void|character|varchar|citext|name|regclass|anyelement|anyarray)\b/i;
  if (!typeStart.test(text)) {
    text = text.replace(/^[A-Za-z_][A-Za-z0-9_]*\s+/, "");
  }
  text = text.toLowerCase().replace(/\s+/g, " ").trim();
  text = text.replace(/^integer\b/, "int").replace(/^int4\b/, "int");
  text = text.replace(/^int8\b/, "bigint").replace(/^int2\b/, "smallint");
  text = text.replace(/^bool\b/, "boolean");
  text = text.replace(/^timestamp with time zone\b/, "timestamptz");
  text = text.replace(/^character varying\b/, "varchar");
  text = text.replace(/^double precision\b/, "doubleprecision");
  return text.replace(/ /g, "");
}

function signatureFromArgs(args: string | undefined): string {
  if (!args) return "";
  const inner = args.trim().replace(/^\(/, "").replace(/\)$/, "").trim();
  if (!inner) return "";
  return splitCommas(inner).map(normalizeType).filter(Boolean).join(",");
}

function unqualified(ident: string): string {
  return ident.split(".").pop()!.replace(/"/g, "").toLowerCase();
}

type FnRef = { name: string; signature: string | null };

function functionRefs(clause: string): FnRef[] {
  const refs: FnRef[] = [];
  const re = /(?:public\.)?([A-Za-z_][A-Za-z0-9_]*)\s*(\((?:[^()]|\([^()]*\))*\))?/g;
  let match: RegExpExecArray | null;
  while ((match = re.exec(clause)) !== null) {
    const name = match[1].toLowerCase();
    if (["function", "all", "execute", "on", "from", "to", "public", "grant", "revoke"].includes(name)) {
      continue;
    }
    refs.push({
      name,
      signature: match[2] ? signatureFromArgs(match[2]) : null,
    });
  }
  return refs;
}

function rolesAfter(statement: string, keyword: "from" | "to"): Set<string> {
  const match = statement.match(new RegExp(`\\b${keyword}\\b([\\s\\S]*)$`, "i"));
  const roles = new Set<string>();
  if (!match) return roles;
  for (const role of match[1].split(",")) {
    const name = role.trim().toLowerCase().split(/\s+/)[0]?.replace(/;$/, "");
    if (name) roles.add(name);
  }
  return roles;
}

/**
 * Timestamp migrations are already applied on prod, so they are walked before
 * the numbered files. 00127 then sees get_available_dates_in_range and the
 * prod nextval_invoice_number. A fresh database runs numbered files first;
 * to_regprocedure guards no-op when the target is not there yet.
 */
function migrationFilenames(): string[] {
  const files = readdirSync(MIGRATIONS_DIR).filter((filename) => /^\d+_.*\.sql$/.test(filename));
  const historical = files.filter((filename) => /^20\d{12}_/.test(filename)).sort();
  const numbered = files.filter((filename) => !/^20\d{12}_/.test(filename)).sort();
  return [...historical, ...numbered];
}

function finalDefinerState(): Map<string, FnState> {
  const files = migrationFilenames();
  const fns = new Map<string, FnState>();

  const applyTo = (ref: FnRef, visit: (fn: FnState) => void) => {
    if (ref.signature === null) {
      for (const fn of fns.values()) {
        if (fn.name === ref.name) visit(fn);
      }
      return;
    }
    const key = `${ref.name}(${ref.signature})`;
    const fn = fns.get(key);
    if (fn) visit(fn);
  };

  const processStatement = (statement: string) => {
      const shell = shellOf(statement);
      if (/^\s*do\b/i.test(shell)) {
        const branchRe =
          /(?:IF|ELSIF)\s+to_regprocedure\(\s*'((?:''|[^'])*)'\s*\)\s+IS\s+NOT\s+NULL\s+THEN([\s\S]*?)(?=ELSIF|ELSE|END\s+IF)/gi;
        let branch: RegExpExecArray | null;
        while ((branch = branchRe.exec(statement)) !== null) {
          const ident = branch[1].replace(/''/g, "'");
          const refMatch = ident.match(/^(?:public\.)?([A-Za-z_][\w$]*)\s*(\(([\s\S]*)\))?$/i);
          if (!refMatch) continue;
          const name = refMatch[1].toLowerCase();
          const signature = refMatch[2] ? signatureFromArgs(refMatch[2]) : "";
          if (!fns.has(`${name}(${signature})`)) continue;
          const executeRe = /EXECUTE\s+'((?:''|[^'])*)'/gi;
          let executed: RegExpExecArray | null;
          while ((executed = executeRe.exec(branch[2])) !== null) {
            processStatement(executed[1].replace(/''/g, "'"));
          }
        }
        return;
      }
      const create = shell.match(
        /\bcreate\s+(?:or\s+replace\s+)?function\s+((?:"[^"]+"|[A-Za-z_][\w$]*)(?:\s*\.\s*(?:"[^"]+"|[A-Za-z_][\w$]*))?)\s*(\((?:[^()]|\([^()]*\))*\))?/i
      );
      if (create) {
        const name = unqualified(create[1]);
        const schema = create[1].includes(".")
          ? create[1].split(".")[0].replace(/"/g, "").toLowerCase()
          : "public";
        if (schema !== "public") return;
        const signature = signatureFromArgs(create[2]);
        const key = `${name}(${signature})`;
        const previous = fns.get(key);
        const path = shell.match(/\bset\s+search_path\s*=\s*([^]+?)\s*(?:as\b|language\b|$)/i);
        fns.set(key, {
          name,
          signature,
          securityDefiner: /\bsecurity\s+definer\b/i.test(shell),
          searchPath: path ? path[1].trim() : null,
          anon: previous?.anon ?? true,
          authenticated: previous?.authenticated ?? true,
          publicGrant: previous?.publicGrant ?? true,
        });
        return;
      }

      const drop = shell.match(
        /\bdrop\s+function\s+(?:if\s+exists\s+)?((?:public\.)?[A-Za-z_][\w$]*)\s*(\((?:[^()]|\([^()]*\))*\))?/i
      );
      if (drop) {
        const name = unqualified(drop[1]);
        if (drop[2]) fns.delete(`${name}(${signatureFromArgs(drop[2])})`);
        else {
          for (const key of [...fns.keys()]) {
            if (key.startsWith(`${name}(`)) fns.delete(key);
          }
        }
        return;
      }

      const alter = shell.match(
        /^\s*alter\s+function\s+((?:public\.)?[A-Za-z_][\w$]*)\s*(\((?:[^()]|\([^()]*\))*\))?([\s\S]*)$/i
      );
      if (alter) {
        const name = unqualified(alter[1]);
        const signature = alter[2] ? signatureFromArgs(alter[2]) : null;
        const actions = alter[3];
        const path = actions.match(/\bset\s+search_path\s*=\s*([\s\S]+?)\s*$/i);
        const invoker = /\bsecurity\s+invoker\b/i.test(actions);
        const definer = /\bsecurity\s+definer\b/i.test(actions);
        applyTo({ name, signature }, (fn) => {
          if (path) fn.searchPath = path[1].trim();
          if (invoker) fn.securityDefiner = false;
          if (definer) fn.securityDefiner = true;
        });
        return;
      }

      if (/^\s*revoke\b/i.test(shell) && /\b(execute|all)\b/i.test(shell)) {
        const onFn = shell.match(/\bon\s+function\s+([\s\S]*?)\s+from\b/i);
        if (!onFn) return;
        const roles = rolesAfter(shell, "from");
        for (const ref of functionRefs(onFn[1])) {
          applyTo(ref, (fn) => {
            if (roles.has("anon")) fn.anon = false;
            if (roles.has("authenticated")) fn.authenticated = false;
            if (roles.has("public")) fn.publicGrant = false;
          });
        }
        return;
      }

      if (/^\s*grant\b/i.test(shell) && /\bexecute\b/i.test(shell)) {
        const onFn = shell.match(/\bon\s+function\s+([\s\S]*?)\s+to\b/i);
        if (!onFn) return;
        const roles = rolesAfter(shell, "to");
        for (const ref of functionRefs(onFn[1])) {
          applyTo(ref, (fn) => {
            if (roles.has("anon")) fn.anon = true;
            if (roles.has("authenticated")) fn.authenticated = true;
            if (roles.has("public")) fn.publicGrant = true;
          });
        }
      }
  };

  for (const filename of files) {
    const sql = readFileSync(join(MIGRATIONS_DIR, filename), "utf8");
    for (const statement of statementsOf(sql)) processStatement(statement);
  }

  return fns;
}

function anonExecutable(fn: FnState): boolean {
  return fn.anon || fn.publicGrant;
}

describe("public SECURITY DEFINER final state", () => {
  const all = [...finalDefinerState().values()];
  const fns = all.filter((fn) => fn.securityDefiner);

  it("sets search_path on every public SECURITY DEFINER function", () => {
    const missing = fns.filter((fn) => !fn.searchPath).map((fn) => fn.name);
    expect(missing, missing.join("\n")).toEqual([]);
  });

  it("keeps anon EXECUTE only for availability RPCs and RLS invokers", () => {
    const unexpected = fns
      .filter((fn) => anonExecutable(fn))
      .filter((fn) => !mayKeepAnonExecute(fn.name))
      .map((fn) => fn.name);
    expect(unexpected, unexpected.join("\n")).toEqual([]);
  });

  it("does not revoke anon EXECUTE from availability RPCs", () => {
    const present = fns.filter((fn) => isAvailabilityGrantException(fn.name)).map((fn) => fn.name);
    expect(present).toEqual(
      expect.arrayContaining([
        ...DEFINER_GRANT_ALLOWLIST.availability,
        "get_gp_in_person_availability",
        "get_gp_video_today_slot_count",
      ])
    );
    const revoked = fns
      .filter((fn) => isAvailabilityGrantException(fn.name) && !anonExecutable(fn))
      .map((fn) => fn.name);
    expect(revoked, revoked.join("\n")).toEqual([]);
  });

  it("drops the unused seat-count RPCs", () => {
    const dropped = [
      "increment_used_seats(uuid)",
      "increment_used_seats(uuid,text)",
      "decrement_used_seats(uuid)",
      "decrement_used_seats(uuid,text)",
    ];
    const stillPresent = all
      .filter((fn) => dropped.includes(`${fn.name}(${fn.signature})`))
      .map((fn) => `${fn.name}(${fn.signature})`);
    expect(stillPresent, stillPresent.join("\n")).toEqual([]);
  });

  it("revokes anon and authenticated EXECUTE on the service-role hotfix RPCs", () => {
    const locked = [
      "credit_wallet_atomic",
      "debit_wallet_atomic",
      "redeem_gift_card_atomic",
      "claim_founding_member",
      "reserve_founding_spot",
      "release_founding_spot_reservation",
      "expire_clinic_invitations",
      "get_clinic_location_doctors",
    ];
    for (const name of locked) {
      const matches = fns.filter((fn) => fn.name === name);
      expect(matches.length, name).toBeGreaterThan(0);
      for (const fn of matches) {
        expect(anonExecutable(fn), name).toBe(false);
        expect(fn.authenticated, name).toBe(false);
      }
    }
    const claims = fns.filter((fn) => fn.name === "claim_founding_member");
    expect(claims.map((fn) => fn.signature)).toEqual(["uuid,timestamptz"]);

    const nextval = fns.find((fn) => fn.name === "nextval_invoice_number");
    expect(nextval).toBeTruthy();
    expect(anonExecutable(nextval!)).toBe(false);
    expect(nextval!.authenticated).toBe(true);

    for (const name of [
      "handle_new_user",
      "update_doctor_rating",
      "update_ticket_updated_at",
      "generate_booking_number",
    ]) {
      const fn = fns.find((item) => item.name === name);
      expect(fn, name).toBeTruthy();
      expect(anonExecutable(fn!), name).toBe(false);
    }
  });
});

type TriggerState = {
  name: string;
  table: string;
  timing: string;
  functionName: string;
};

function attachedTriggers(): Map<string, TriggerState> {
  const files = readdirSync(MIGRATIONS_DIR)
    .filter((filename) => /^\d+_.*\.sql$/.test(filename))
    .sort();
  const triggers = new Map<string, TriggerState>();
  for (const filename of files) {
    const sql = readFileSync(join(MIGRATIONS_DIR, filename), "utf8");
    for (const statement of statementsOf(sql)) {
      const shell = shellOf(statement);
      const drop = shell.match(
        /\bdrop\s+trigger\s+(?:if\s+exists\s+)?([A-Za-z_][\w$]*)\s+on\s+((?:auth|public)\.[A-Za-z_][\w$]*)/i
      );
      if (drop) {
        triggers.delete(drop[1].toLowerCase());
        continue;
      }
      const create = shell.match(
        /\bcreate\s+trigger\s+([A-Za-z_][\w$]*)\s+([\s\S]*?)\s+on\s+((?:auth|public)\.[A-Za-z_][\w$]*)\s+([\s\S]*?)\bexecute\s+(?:function|procedure)\s+(?:public\.)?([A-Za-z_][\w$]*)\s*\(/i
      );
      if (!create) continue;
      triggers.set(create[1].toLowerCase(), {
        name: create[1].toLowerCase(),
        timing: `${create[2]} ${create[4]}`.replace(/\s+/g, " ").trim().toLowerCase(),
        table: create[3].toLowerCase(),
        functionName: create[5].toLowerCase(),
      });
    }
  }
  return triggers;
}

describe("trigger functions stay attached", () => {
  const triggers = attachedTriggers();

  it("still fires handle_new_user, rating, ticket, and booking-number triggers", () => {
    expect(triggers.get("on_auth_user_created")).toMatchObject({
      table: "auth.users",
      functionName: "handle_new_user",
    });
    expect(triggers.get("on_auth_user_created")?.timing).toContain("after insert");
    expect(triggers.get("on_auth_user_created")?.timing).toContain("for each row");

    expect(triggers.get("trg_update_doctor_rating")).toMatchObject({
      table: "public.reviews",
      functionName: "update_doctor_rating",
    });
    expect(triggers.get("trg_update_doctor_rating")?.timing).toContain("for each row");

    expect(triggers.get("trigger_update_ticket_on_message")).toMatchObject({
      table: "public.support_messages",
      functionName: "update_ticket_updated_at",
    });
    expect(triggers.get("trigger_update_ticket_on_message")?.timing).toContain("for each row");

    expect(triggers.get("trg_generate_booking_number")).toMatchObject({
      table: "public.bookings",
      functionName: "generate_booking_number",
    });
    expect(triggers.get("trg_generate_booking_number")?.timing).toContain("before insert");
    expect(triggers.get("trg_generate_booking_number")?.timing).toContain("for each row");
  });
});

describe("get_org_bookings rejects a non-member", () => {
  const sql = readFileSync(
    join(MIGRATIONS_DIR, "00127_definer_hardening.sql"),
    "utf8"
  );
  const marker = "-- verbatim from prod migration 20260930161246 guard_get_org_bookings";
  const start = sql.indexOf(marker);
  const nextFn = sql.indexOf("CREATE OR REPLACE FUNCTION public.nextval_invoice_number", start);
  const body = sql.slice(start, nextFn);

  it("raises unless the caller is service_role or an active owner or admin", () => {
    expect(body).toContain("SET search_path = ''");
    expect(body).toContain("auth.role() IS DISTINCT FROM 'service_role'");
    expect(body).toContain("FROM public.organization_members");
    expect(body).toContain("om.user_id = auth.uid()");
    expect(body).toContain("om.role IN ('owner', 'admin')");
    expect(body).toContain("om.status = 'active'");
    expect(body).toContain("RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501'");
    const raiseAt = body.indexOf("RAISE EXCEPTION");
    const memberAt = body.indexOf("FROM public.organization_members");
    const bypassAt = body.indexOf("service_role");
    expect(bypassAt).toBeGreaterThan(0);
    expect(memberAt).toBeGreaterThan(bypassAt);
    expect(raiseAt).toBeGreaterThan(memberAt);
    expect(body).toContain("GRANT EXECUTE ON FUNCTION public.get_org_bookings");
    expect(body).toContain("TO authenticated");
  });
});

describe("autocomplete search functions are invokers", () => {
  const all = [...finalDefinerState().values()];
  const sql = readFileSync(
    join(MIGRATIONS_DIR, "00127_definer_hardening.sql"),
    "utf8"
  );

  it("sets SECURITY INVOKER, pins search_path, and keeps anon EXECUTE", () => {
    for (const name of ["search_allergies", "search_chronic_conditions"] as const) {
      expect(sql).toContain(`to_regprocedure('public.${name}(text, integer)') IS NOT NULL`);
      expect(sql).toContain(
        `ALTER FUNCTION public.${name}(text, integer) SECURITY INVOKER SET search_path = public, extensions`
      );
      expect(sql).not.toContain(`REVOKE EXECUTE ON FUNCTION public.${name}`);
      const repoOverload = all.find((item) => item.name === name && item.signature === "text");
      expect(repoOverload, name).toBeTruthy();
      expect(repoOverload!.securityDefiner, name).toBe(false);
      expect(repoOverload!.searchPath, name).toBe("public, extensions");
      expect(anonExecutable(repoOverload!), name).toBe(true);
      expect(repoOverload!.authenticated, name).toBe(true);
    }
  });
});

describe("prod-missing signatures are guarded", () => {
  const sql = readFileSync(join(MIGRATIONS_DIR, "00127_definer_hardening.sql"), "utf8");
  const all = [...finalDefinerState().values()];

  it("drops the repo-only 1-arg live-id overload and pins the 3-arg form", () => {
    expect(sql).toContain("DROP FUNCTION IF EXISTS public.get_live_available_doctor_ids(text)");
    expect(sql).not.toContain("p_specialty_slug TEXT DEFAULT NULL\n)");
    const live = all.filter((fn) => fn.name === "get_live_available_doctor_ids");
    expect(live.map((fn) => fn.signature)).toEqual(["text,text,int"]);
    expect(live[0].searchPath).toBe("''");
    expect(anonExecutable(live[0])).toBe(true);
  });

  it("pins get_available_dates_in_range only when that signature already exists", () => {
    expect(sql).toContain(
      "to_regprocedure('public.get_available_dates_in_range(uuid, date, date, text)') IS NOT NULL"
    );
    const fn = all.find((item) => item.name === "get_available_dates_in_range");
    expect(fn?.searchPath).toBe("''");
    expect(anonExecutable(fn!)).toBe(true);
  });

  it("revokes prevent_doctor_privileged_column_update and increment_coupon_uses when present", () => {
    expect(sql).toContain(
      "to_regprocedure('public.prevent_doctor_privileged_column_update()') IS NOT NULL"
    );
    expect(sql).toContain("to_regprocedure('public.increment_coupon_uses(uuid)') IS NOT NULL");
    for (const name of ["prevent_doctor_privileged_column_update", "increment_coupon_uses"]) {
      const fn = all.find((item) => item.name === name);
      expect(fn, name).toBeTruthy();
      expect(anonExecutable(fn!), name).toBe(false);
    }
    const coupon = all.find((item) => item.name === "increment_coupon_uses");
    expect(coupon?.authenticated).toBe(false);
  });
});
