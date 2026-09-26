import { afterEach, describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  AUDIT_SYSTEM_ACTOR_ENV,
  configuredAuditSystemActorId,
  resolveAuditSystemActor,
} from "@/lib/audit/system-actor";

const ACTOR = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const ADMIN = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const original = process.env[AUDIT_SYSTEM_ACTOR_ENV];

afterEach(() => {
  if (original === undefined) delete process.env[AUDIT_SYSTEM_ACTOR_ENV];
  else process.env[AUDIT_SYSTEM_ACTOR_ENV] = original;
});

describe("configuredAuditSystemActorId", () => {
  it("accepts only a UUID", () => {
    expect(configuredAuditSystemActorId({ [AUDIT_SYSTEM_ACTOR_ENV]: ACTOR })).toBe(
      ACTOR
    );
    expect(
      configuredAuditSystemActorId({ [AUDIT_SYSTEM_ACTOR_ENV]: `  ${ACTOR}  ` })
    ).toBe(ACTOR);
    expect(configuredAuditSystemActorId({})).toBeNull();
    expect(
      configuredAuditSystemActorId({ [AUDIT_SYSTEM_ACTOR_ENV]: "not-a-uuid" })
    ).toBeNull();
  });
});

describe("resolveAuditSystemActor", () => {
  it("uses AUDIT_SYSTEM_ACTOR_ID and does not query profiles", async () => {
    process.env[AUDIT_SYSTEM_ACTOR_ENV] = ACTOR;
    const supabase = {
      from() {
        throw new Error("should not query");
      },
    } as unknown as SupabaseClient;

    await expect(resolveAuditSystemActor(supabase)).resolves.toEqual({
      actorId: ACTOR,
      via: "AUDIT_SYSTEM_ACTOR_ID",
    });
  });

  it("falls back to the oldest admin profile when the env var is unset", async () => {
    delete process.env[AUDIT_SYSTEM_ACTOR_ENV];
    const filters: Array<[string, unknown]> = [];
    const supabase = {
      from(table: string) {
        expect(table).toBe("profiles");
        return {
          select() {
            return this;
          },
          eq(col: string, val: unknown) {
            filters.push([col, val]);
            return this;
          },
          order() {
            return this;
          },
          limit() {
            return this;
          },
          maybeSingle: async () => ({ data: { id: ADMIN }, error: null }),
        };
      },
    } as unknown as SupabaseClient;

    await expect(resolveAuditSystemActor(supabase)).resolves.toEqual({
      actorId: ADMIN,
      via: "admin_profile_fallback",
    });
    expect(filters).toEqual([["role", "admin"]]);
  });

  it("returns null when no admin profile exists", async () => {
    delete process.env[AUDIT_SYSTEM_ACTOR_ENV];
    const supabase = {
      from() {
        return {
          select() {
            return this;
          },
          eq() {
            return this;
          },
          order() {
            return this;
          },
          limit() {
            return this;
          },
          maybeSingle: async () => ({ data: null, error: null }),
        };
      },
    } as unknown as SupabaseClient;

    await expect(resolveAuditSystemActor(supabase)).resolves.toBeNull();
  });
});
