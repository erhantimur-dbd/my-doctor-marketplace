import { readFileSync } from "node:fs";
import { join } from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const PATIENT = "11111111-1111-4111-8111-111111111111";
const ADMIN = "22222222-2222-4222-8222-222222222222";

const MIGRATION = readFileSync(
  join(process.cwd(), "supabase/migrations/00146_profile_adult_confirmed_at.sql"),
  "utf8"
);

describe("clients cannot write profiles.adult_confirmed_at", () => {
  const db = new PGlite();

  beforeAll(async () => {
    await db.exec(`
      CREATE SCHEMA IF NOT EXISTS auth;

      CREATE OR REPLACE FUNCTION auth.role()
      RETURNS text
      LANGUAGE sql STABLE AS $$
        SELECT nullif(current_setting('request.jwt.claim.role', true), '')
      $$;

      CREATE OR REPLACE FUNCTION auth.uid()
      RETURNS uuid
      LANGUAGE sql STABLE AS $$
        SELECT nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
      $$;

      DO $$ BEGIN CREATE ROLE anon NOLOGIN; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
      DO $$ BEGIN CREATE ROLE authenticated NOLOGIN; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
      DO $$ BEGIN CREATE ROLE service_role NOLOGIN; EXCEPTION WHEN duplicate_object THEN NULL; END $$;

      GRANT USAGE ON SCHEMA auth TO anon, authenticated, service_role;
      GRANT EXECUTE ON FUNCTION auth.role() TO anon, authenticated, service_role;
      GRANT EXECUTE ON FUNCTION auth.uid() TO anon, authenticated, service_role;

      CREATE TABLE public.profiles (
        id uuid PRIMARY KEY,
        role text NOT NULL,
        first_name text NOT NULL DEFAULT '',
        email text NOT NULL DEFAULT ''
      );

      INSERT INTO public.profiles (id, role, first_name, email)
      VALUES
        ('${PATIENT}', 'patient', 'Ada', 'ada@example.com'),
        ('${ADMIN}', 'admin', 'Ops', 'ops@example.com');
    `);
    await db.exec(MIGRATION);
    await db.exec(`
      GRANT USAGE ON SCHEMA public TO authenticated, anon, service_role;
      GRANT SELECT, UPDATE ON public.profiles TO authenticated, anon, service_role;
      ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
      DROP POLICY IF EXISTS own_select ON public.profiles;
      CREATE POLICY own_select ON public.profiles
        FOR SELECT TO authenticated
        USING (id = auth.uid());
      DROP POLICY IF EXISTS own_update ON public.profiles;
      CREATE POLICY own_update ON public.profiles
        FOR UPDATE TO authenticated
        USING (id = auth.uid())
        WITH CHECK (id = auth.uid());
    `);
  });

  afterAll(async () => {
    await db.close();
  });

  async function asRole(role: string, sub: string) {
    await db.exec(`
      SELECT set_config('request.jwt.claim.role', '${role}', false);
      SELECT set_config('request.jwt.claim.sub', '${sub}', false);
    `);
  }

  it("lets a patient edit other columns and rejects adult_confirmed_at", async () => {
    await asRole("authenticated", PATIENT);
    await db.exec("SET ROLE authenticated");
    await db.exec(
      `UPDATE public.profiles SET first_name = 'Augusta' WHERE id = '${PATIENT}'`
    );
    await db.exec("RESET ROLE");
    const name = await db.query<{ first_name: string }>(
      `SELECT first_name FROM public.profiles WHERE id = $1`,
      [PATIENT]
    );
    expect(name.rows[0].first_name).toBe("Augusta");

    await asRole("authenticated", PATIENT);
    await db.exec("SET ROLE authenticated");
    await expect(
      db.exec(
        `UPDATE public.profiles SET adult_confirmed_at = now() WHERE id = '${PATIENT}'`
      )
    ).rejects.toThrow(/adult_confirmed_at/);
    await db.exec("RESET ROLE");
    const stamped = await db.query<{ adult_confirmed_at: string | null }>(
      `SELECT adult_confirmed_at FROM public.profiles WHERE id = $1`,
      [PATIENT]
    );
    expect(stamped.rows[0].adult_confirmed_at).toBeNull();
  });

  it("rejects an admin user JWT and an anon JWT", async () => {
    await asRole("authenticated", ADMIN);
    await expect(
      db.exec(`
        UPDATE public.profiles
          SET adult_confirmed_at = now()
          WHERE id = '${PATIENT}';
      `)
    ).rejects.toThrow(/adult_confirmed_at/);

    await asRole("anon", "");
    await expect(
      db.exec(`
        UPDATE public.profiles
          SET adult_confirmed_at = now()
          WHERE id = '${PATIENT}';
      `)
    ).rejects.toThrow(/adult_confirmed_at/);
  });

  it("lets the service role set adult_confirmed_at", async () => {
    await asRole("service_role", "");
    await db.exec(`
      UPDATE public.profiles
        SET adult_confirmed_at = '2026-10-02T12:00:00Z'
        WHERE id = '${PATIENT}';
    `);
    const stamped = await db.query<{ adult_confirmed_at: Date }>(
      `SELECT adult_confirmed_at FROM public.profiles WHERE id = $1`,
      [PATIENT]
    );
    expect(stamped.rows[0].adult_confirmed_at).toBeInstanceOf(Date);

    await asRole("authenticated", PATIENT);
    await db.exec("SET ROLE authenticated");
    await expect(
      db.exec(
        `UPDATE public.profiles SET adult_confirmed_at = NULL WHERE id = '${PATIENT}'`
      )
    ).rejects.toThrow(/adult_confirmed_at/);
    await db.exec("RESET ROLE");
  });
});
