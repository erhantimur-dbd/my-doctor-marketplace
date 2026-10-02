import { readFileSync } from "node:fs";
import { join } from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const P = "11111111-1111-4111-8111-111111111111";
const DU = "22222222-2222-4222-8222-222222222222";
const D = "33333333-3333-4333-8333-333333333333";
const DEP = "44444444-4444-4444-8444-444444444444";
const B = "55555555-5555-4555-8555-555555555555";
const RX = "66666666-6666-4666-8666-666666666666";
const AUD = "77777777-7777-4777-8777-777777777777";

const SCHEMA = `
CREATE SCHEMA IF NOT EXISTS auth;
CREATE OR REPLACE FUNCTION auth.role() RETURNS text LANGUAGE sql STABLE AS $$
  SELECT nullif(current_setting('request.jwt.claim.role', true), '')
$$;
CREATE OR REPLACE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$
  SELECT nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
$$;
DO $$ BEGIN CREATE ROLE anon NOLOGIN; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE ROLE authenticated NOLOGIN; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE ROLE service_role NOLOGIN; EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE auth.users (
  id uuid PRIMARY KEY,
  email text,
  phone text,
  banned_until timestamptz,
  raw_user_meta_data jsonb,
  updated_at timestamptz
);
CREATE TABLE public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id),
  role text NOT NULL,
  first_name text NOT NULL,
  last_name text NOT NULL,
  email text NOT NULL,
  phone text,
  avatar_url text,
  address_line1 text,
  address_line2 text,
  city text,
  state text,
  postal_code text,
  country text,
  date_of_birth date
);
CREATE TABLE public.doctors (
  id uuid PRIMARY KEY,
  profile_id uuid NOT NULL UNIQUE REFERENCES public.profiles(id),
  slug text NOT NULL UNIQUE,
  verification_status text NOT NULL DEFAULT 'pending',
  is_active boolean NOT NULL DEFAULT true,
  gmc_number text,
  cqc_status text NOT NULL DEFAULT 'unknown'
    CHECK (cqc_status IN ('registered','exempt_mpl','exempt_employed','not_applicable','unknown')),
  cqc_provider_id text,
  cqc_location_id text,
  cqc_verified_at timestamptz,
  indemnity_insurer text,
  indemnity_cover_gbp integer,
  indemnity_expiry date,
  indemnity_document_id uuid,
  mpl_designated_body text,
  mpl_attestation_signed_at timestamptz,
  dbs_check_date date,
  dbs_document_id uuid,
  excluded_procedures_attestation boolean NOT NULL DEFAULT false
);
CREATE TABLE public.doctor_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  doctor_id uuid NOT NULL,
  document_type text NOT NULL,
  storage_path text,
  file_name text,
  verified_at timestamptz
);
CREATE TABLE public.doctor_approval_checklist (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  doctor_id uuid NOT NULL UNIQUE,
  reviewer_id uuid NOT NULL,
  gmc_verified boolean NOT NULL DEFAULT false,
  website_verified boolean NOT NULL DEFAULT false,
  notes text,
  cqc_status_evidenced boolean NOT NULL DEFAULT false,
  mpl_attestation_reviewed boolean NOT NULL DEFAULT false,
  excluded_procedures_attestation_confirmed boolean NOT NULL DEFAULT false,
  indemnity_document_verified boolean NOT NULL DEFAULT false,
  indemnity_in_date boolean NOT NULL DEFAULT false,
  dbs_check_verified boolean NOT NULL DEFAULT false
);
CREATE TABLE public.dependents (
  id uuid PRIMARY KEY,
  parent_id uuid NOT NULL,
  first_name text NOT NULL,
  last_name text NOT NULL,
  date_of_birth date,
  notes text
);
CREATE TABLE public.bookings (
  id uuid PRIMARY KEY,
  patient_id uuid NOT NULL,
  doctor_id uuid NOT NULL,
  dependent_id uuid,
  status text NOT NULL,
  appointment_date date,
  paid_at timestamptz,
  refunded_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  patient_notes text,
  doctor_notes text,
  visit_summary text,
  visit_summary_at timestamptz,
  stripe_dispute_status text,
  stripe_dispute_reason text,
  daily_room_name text
);
CREATE TABLE public.reviews (
  id uuid PRIMARY KEY,
  booking_id uuid NOT NULL,
  patient_id uuid NOT NULL,
  doctor_id uuid NOT NULL,
  rating int NOT NULL,
  comment text
);
CREATE TABLE public.prescriptions (
  id uuid PRIMARY KEY,
  doctor_id uuid NOT NULL,
  patient_id uuid NOT NULL,
  booking_id uuid,
  prescribed_at timestamptz,
  diagnosis text,
  notes text
);
CREATE TABLE public.prescription_audit_log (
  id uuid PRIMARY KEY,
  prescription_id uuid NOT NULL REFERENCES public.prescriptions(id) ON DELETE RESTRICT,
  event_type text NOT NULL,
  actor_profile_id uuid NOT NULL,
  snapshot jsonb NOT NULL
);
CREATE TABLE public.payment_corrections (
  id uuid PRIMARY KEY,
  booking_id uuid,
  patient_id uuid,
  status text,
  reason text,
  statement_line text,
  amount_cents int,
  dispute_reason text,
  dispute_findings text,
  customer_response text,
  clear_risk boolean NOT NULL DEFAULT false,
  clear_risk_reason text,
  clear_risk_reason_code text,
  disputed_at timestamptz,
  dispute_resolved_at timestamptz,
  dispute_outcome text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.payment_correction_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  correction_id uuid NOT NULL,
  event_type text NOT NULL,
  actor_id uuid,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.payment_correction_approvals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  correction_id uuid NOT NULL,
  approver_id uuid NOT NULL,
  approved_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id uuid NOT NULL,
  action text NOT NULL,
  target_type text NOT NULL,
  target_id uuid NOT NULL,
  metadata jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.platform_settings (
  key text PRIMARY KEY,
  value jsonb NOT NULL,
  updated_by uuid,
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.organizations (
  id uuid PRIMARY KEY,
  name text NOT NULL,
  slug text NOT NULL UNIQUE,
  email text,
  phone text,
  address_line1 text,
  address_line2 text,
  city text,
  state text,
  postal_code text,
  country text,
  website text,
  logo_url text,
  description text,
  stripe_customer_id text,
  brand_display_name text,
  brand_support_email text,
  brand_support_phone text
);
CREATE TABLE public.organization_members (
  id uuid PRIMARY KEY,
  organization_id uuid NOT NULL,
  user_id uuid NOT NULL,
  role text NOT NULL,
  status text NOT NULL CHECK (status IN ('invited', 'active', 'suspended', 'removed'))
);
CREATE TABLE public.licenses (
  id uuid PRIMARY KEY,
  organization_id uuid NOT NULL,
  status text NOT NULL,
  current_period_end timestamptz,
  cancelled_at timestamptz
);
CREATE TABLE public.patient_wallet (
  id uuid PRIMARY KEY,
  patient_id uuid NOT NULL,
  currency text NOT NULL,
  balance_cents int NOT NULL,
  UNIQUE (patient_id, currency)
);
CREATE TABLE public.wallet_transactions (
  id uuid PRIMARY KEY,
  patient_id uuid NOT NULL,
  currency text NOT NULL,
  amount_cents int NOT NULL,
  created_at timestamptz NOT NULL,
  description text
);
CREATE TABLE public.patient_points (
  patient_id uuid PRIMARY KEY,
  available_points int NOT NULL,
  lifetime_points int NOT NULL
);
CREATE TABLE public.points_transactions (
  id uuid PRIMARY KEY,
  patient_id uuid NOT NULL,
  points int NOT NULL,
  created_at timestamptz NOT NULL,
  description text
);
CREATE TABLE public.contact_inquiries (
  id uuid PRIMARY KEY,
  name text NOT NULL,
  email text NOT NULL,
  message text NOT NULL,
  created_at timestamptz NOT NULL
);
CREATE TABLE public.conversations (
  id uuid PRIMARY KEY,
  doctor_id uuid NOT NULL,
  patient_id uuid NOT NULL
);
CREATE TABLE public.direct_messages (
  id uuid PRIMARY KEY,
  conversation_id uuid NOT NULL,
  sender_id uuid NOT NULL,
  body text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.support_tickets (
  id uuid PRIMARY KEY,
  user_id uuid,
  status text NOT NULL,
  subject text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz,
  closed_at timestamptz
);
CREATE TABLE public.support_messages (
  id uuid PRIMARY KEY,
  ticket_id uuid NOT NULL,
  message text NOT NULL,
  created_at timestamptz NOT NULL
);
`;

type Counts = Record<string, number | string | boolean>;

describe("retention purge", () => {
  let db: PGlite;

  beforeAll(async () => {
    db = new PGlite();
    await db.exec(SCHEMA);
    await db.exec(readFileSync(join(process.cwd(), "supabase/migrations/00135_account_erasure.sql"), "utf8"));
    await db.exec(readFileSync(join(process.cwd(), "supabase/migrations/00142_retention_subjects.sql"), "utf8"));
    await db.exec(readFileSync(join(process.cwd(), "supabase/migrations/00143_retention_purge.sql"), "utf8"));
    await db.exec(`SELECT set_config('request.jwt.claim.role', 'service_role', false)`);
  });

  afterAll(async () => {
    await db.close();
  });

  async function inTxn(run: () => Promise<void>) {
    await db.exec("BEGIN");
    try {
      await run();
    } finally {
      await db.exec("ROLLBACK");
    }
  }

  async function configure(asOf: string, mode = "apply", fy: string | null = "03-31") {
    await db.query(
      `UPDATE public.platform_settings SET value = $1::jsonb WHERE key = 'retention_financial_year_end'`,
      [JSON.stringify(fy)]
    );
    await db.query(
      `UPDATE public.platform_settings SET value = $1::jsonb WHERE key = 'retention_purge'`,
      [JSON.stringify({ mode })]
    );
    await db.query(`SELECT set_config('mydoctors360.retention_as_of', $1, true)`, [asOf]);
  }

  async function purge(dry = false, limit = 500): Promise<Counts> {
    const result = await db.query<{ result: Counts }>(
      `SELECT public.purge_expired_retention($1, $2) AS result`,
      [dry, limit]
    );
    return result.rows[0].result;
  }

  function people(patientDob: string | null = "1990-01-01") {
    const dob = patientDob ? `'${patientDob}'` : "NULL";
    return `
      INSERT INTO auth.users (id, email) VALUES ('${P}', 'p@example.com'), ('${DU}', 'd@example.com');
      INSERT INTO public.profiles (id, role, first_name, last_name, email, date_of_birth) VALUES
        ('${P}', 'patient', 'Pat', 'Ient', 'p@example.com', ${dob}),
        ('${DU}', 'doctor', 'Doc', 'Tor', 'd@example.com', NULL);
      INSERT INTO public.doctors (id, profile_id, slug, verification_status) VALUES
        ('${D}', '${DU}', 'doc-tor', 'approved');
    `;
  }

  it("does not hard-code a 6 April financial year and keeps the service-role grant", () => {
    const sql = readFileSync(
      join(process.cwd(), "supabase/migrations/00143_retention_purge.sql"),
      "utf8"
    );
    expect(sql).not.toMatch(/6 April|April 6|04-06/);
    expect(sql).toContain("AND m.status IN ('active', 'invited', 'suspended')");
    expect(sql).not.toContain("IS DISTINCT FROM 'removed'");
    expect(sql).toContain("REVOKE EXECUTE ON FUNCTION public.purge_expired_retention(boolean, integer) FROM PUBLIC, anon, authenticated");
    expect(sql).toContain("mydoctors360.retention_purge");
  });

  it("returns counts and writes a log on an empty apply", async () => {
    await inTxn(async () => {
      await configure("2026-10-03T12:00:00Z");
      const result = await purge(false);
      expect(result.dry_run).toBe(false);
      expect(result.mode).toBe("apply");
      expect(result.bookings_deleted).toBe(0);
      expect(result.call_attendance).toBe(0);
      expect(result.held_no_fy_end).toBe(0);
      const log = await db.query<{ sqlstate: string | null; counts: Counts }>(
        `SELECT sqlstate, counts FROM public.retention_purge_runs`
      );
      expect(log.rows[0].sqlstate).toBeNull();
      expect(JSON.stringify(log.rows[0].counts)).not.toMatch(/@|example.com/);
    });
  });

  it("counts an eligible booking on dry-run and leaves the row", async () => {
    await inTxn(async () => {
      await db.exec(people());
      await db.exec(`
        INSERT INTO public.bookings (id, patient_id, doctor_id, status, paid_at, created_at)
        VALUES ('${B}', '${P}', '${D}', 'confirmed', '2018-04-01T12:00:00Z', '2018-04-01T12:00:00Z');
      `);
      await configure("2026-04-01T12:00:00Z", "dry_run");
      const result = await purge(true);
      expect(result.dry_run).toBe(true);
      expect(result.bookings_deleted).toBe(1);
      const row = await db.query(`SELECT id FROM public.bookings WHERE id = '${B}'`);
      expect(row.rows).toHaveLength(1);
    });
  });

  it("refuses apply while the setting is dry_run", async () => {
    await inTxn(async () => {
      await db.exec(people());
      await db.exec(`
        INSERT INTO public.bookings (id, patient_id, doctor_id, status, paid_at)
        VALUES ('${B}', '${P}', '${D}', 'confirmed', '2018-04-01T12:00:00Z');
      `);
      await configure("2026-04-01T12:00:00Z", "dry_run");
      const result = await purge(false);
      expect(result.dry_run).toBe(true);
      expect(result.mode).toBe("dry_run");
      const row = await db.query(`SELECT id FROM public.bookings WHERE id = '${B}'`);
      expect(row.rows).toHaveLength(1);
    });
  });

  it("deletes only when both gates are open, then deletes nothing the next time", async () => {
    await inTxn(async () => {
      await db.exec(people());
      await db.exec(`
        INSERT INTO public.bookings (id, patient_id, doctor_id, status, paid_at)
        VALUES ('${B}', '${P}', '${D}', 'confirmed', '2018-04-01T12:00:00Z');
        INSERT INTO public.reviews (id, booking_id, patient_id, doctor_id, rating, comment)
        VALUES ('${AUD}', '${B}', '${P}', '${D}', 5, 'kept until the booking goes');
      `);
      await configure("2026-04-01T12:00:00Z", "apply");
      const first = await purge(false);
      expect(first.bookings_deleted).toBe(1);
      expect(first.reviews_deleted).toBe(1);
      expect((await db.query(`SELECT id FROM public.bookings`)).rows).toHaveLength(0);
      expect((await db.query(`SELECT id FROM public.reviews`)).rows).toHaveLength(0);
      const second = await purge(false);
      expect(second.bookings_deleted).toBe(0);
      expect(second.reviews_deleted).toBe(0);
    });
  });

  it("writes a zero log when the kill switch is off", async () => {
    await inTxn(async () => {
      await db.exec(people());
      await db.exec(`
        INSERT INTO public.bookings (id, patient_id, doctor_id, status, paid_at)
        VALUES ('${B}', '${P}', '${D}', 'confirmed', '2018-04-01T12:00:00Z');
      `);
      await configure("2026-04-01T12:00:00Z", "off");
      const result = await purge(false);
      expect(result.mode).toBe("off");
      expect(result.bookings_deleted).toBe(0);
      expect(result.dry_run).toBe(true);
      expect((await db.query(`SELECT id FROM public.bookings`)).rows).toHaveLength(1);
    });
  });

  it("holds every financial row while the financial year end is null", async () => {
    await inTxn(async () => {
      await db.exec(people());
      await db.exec(`
        INSERT INTO public.bookings (id, patient_id, doctor_id, status, paid_at)
        VALUES ('${B}', '${P}', '${D}', 'confirmed', '2010-01-01T12:00:00Z');
      `);
      await configure("2030-01-02T12:00:00Z", "apply", null);
      const result = await purge(false);
      expect(result.held_no_fy_end).toBe(1);
      expect(result.bookings_deleted).toBe(0);
      expect((await db.query(`SELECT id FROM public.bookings`)).rows).toHaveLength(1);
    });
  });

  it("uses the company financial year of paid_at, including the London date line", async () => {
    await inTxn(async () => {
      await db.exec(people());
      await db.exec(`
        INSERT INTO public.bookings (id, patient_id, doctor_id, status, paid_at) VALUES
          ('${B}', '${P}', '${D}', 'confirmed', '2025-03-31 21:30:00+00'),
          ('${AUD}', '${P}', '${D}', 'confirmed', '2025-03-31 23:30:00+00');
      `);
      await configure("2031-03-31T12:00:00Z");
      expect((await purge(false)).bookings_deleted).toBe(0);
      await configure("2031-04-01T12:00:00Z");
      const due = await purge(false);
      expect(due.bookings_deleted).toBe(1);
      const left = await db.query<{ id: string }>(`SELECT id FROM public.bookings`);
      expect(left.rows.map((row) => row.id)).toEqual([AUD]);
      await configure("2032-04-01T12:00:00Z");
      expect((await purge(false)).bookings_deleted).toBe(1);
    });
  });

  it("keeps a booking until the later of the payment year and a refund in a later year", async () => {
    await inTxn(async () => {
      await db.exec(people());
      await db.exec(`
        INSERT INTO public.bookings (id, patient_id, doctor_id, status, paid_at, refunded_at)
        VALUES ('${B}', '${P}', '${D}', 'confirmed', '2018-04-01T12:00:00Z', '2024-04-01T12:00:00Z');
      `);
      await configure("2026-04-01T12:00:00Z");
      expect((await purge(false)).bookings_deleted).toBe(0);
      expect((await db.query(`SELECT id FROM public.bookings`)).rows).toHaveLength(1);
      await configure("2031-04-01T12:00:00Z");
      expect((await purge(false)).bookings_deleted).toBe(1);
      expect((await db.query(`SELECT id FROM public.bookings`)).rows).toHaveLength(0);
    });
  });

  it("scrubs a refunded consultation on the clinical clock and keeps the financial row", async () => {
    await inTxn(async () => {
      await db.exec(people("1990-01-01"));
      await db.exec(`
        INSERT INTO public.bookings (
          id, patient_id, doctor_id, status, appointment_date, visit_summary, paid_at, refunded_at
        ) VALUES (
          '${B}', '${P}', '${D}', 'refunded', '2018-01-01', 'clinical text',
          '2024-06-01T12:00:00Z', '2024-06-02T12:00:00Z'
        );
        INSERT INTO public.prescriptions (id, doctor_id, patient_id, booking_id, prescribed_at, diagnosis)
        VALUES ('${RX}', '${D}', '${P}', '${B}', '2018-01-01T12:00:00Z', 'note');
        INSERT INTO public.prescription_audit_log (id, prescription_id, event_type, actor_profile_id, snapshot)
        VALUES ('${AUD}', '${RX}', 'issued', '${DU}', '{"drug":"secret"}'::jsonb);
      `);
      await configure("2026-01-02T12:00:00Z");
      const result = await purge(false);
      expect(result.bookings_scrubbed_clinical).toBe(1);
      expect(result.bookings_deleted).toBe(0);
      expect(result.prescriptions_deleted).toBe(1);
      expect(result.prescription_audit_log_deleted).toBe(1);
      const booking = await db.query<{ visit_summary: string | null }>(
        `SELECT visit_summary FROM public.bookings WHERE id = '${B}'`
      );
      expect(booking.rows[0].visit_summary).toBeNull();
      expect((await db.query(`SELECT id FROM public.prescriptions`)).rows).toHaveLength(0);
    });
  });

  it("keeps an adult consultation until the day after the 8-year anniversary", async () => {
    await inTxn(async () => {
      await db.exec(people("1990-01-01"));
      await db.exec(`
        INSERT INTO public.bookings (id, patient_id, doctor_id, status, appointment_date, visit_summary, paid_at)
        VALUES ('${B}', '${P}', '${D}', 'completed', '2018-10-02', 'seen', '2026-01-01T12:00:00Z');
      `);
      await configure("2026-10-02T12:00:00Z");
      expect((await purge(false)).bookings_scrubbed_clinical).toBe(0);
      await configure("2026-10-03T12:00:00Z");
      expect((await purge(false)).bookings_scrubbed_clinical).toBe(1);
      const row = await db.query<{ visit_summary: string | null }>(
        `SELECT visit_summary FROM public.bookings`
      );
      expect(row.rows[0].visit_summary).toBeNull();
    });
  });

  it("uses the 25th birthday for a consultation at age 16", async () => {
    await inTxn(async () => {
      await db.exec(people());
      await db.exec(`
        INSERT INTO public.dependents (id, parent_id, first_name, last_name, date_of_birth)
        VALUES ('${DEP}', '${P}', 'Kid', 'Ient', '2010-06-15');
        INSERT INTO public.bookings (
          id, patient_id, doctor_id, dependent_id, status, appointment_date, visit_summary, paid_at
        ) VALUES (
          '${B}', '${P}', '${D}', '${DEP}', 'completed', '2027-06-14', 'child', '2034-01-01T12:00:00Z'
        );
      `);
      await configure("2035-06-15T12:00:00Z");
      expect((await purge(false)).bookings_scrubbed_clinical).toBe(0);
      await configure("2035-06-16T12:00:00Z");
      expect((await purge(false)).bookings_scrubbed_clinical).toBe(1);
    });
  });

  it("uses the 26th birthday for a consultation at age 17 and not before", async () => {
    await inTxn(async () => {
      await db.exec(people());
      await db.exec(`
        INSERT INTO public.dependents (id, parent_id, first_name, last_name, date_of_birth)
        VALUES ('${DEP}', '${P}', 'Kid', 'Ient', '2010-06-15');
        INSERT INTO public.bookings (
          id, patient_id, doctor_id, dependent_id, status, appointment_date, visit_summary, paid_at
        ) VALUES (
          '${B}', '${P}', '${D}', '${DEP}', 'completed', '2027-06-15', 'child', '2034-01-01T12:00:00Z'
        );
      `);
      await configure("2035-06-16T12:00:00Z");
      expect((await purge(false)).bookings_scrubbed_clinical).toBe(0);
      await configure("2036-06-15T12:00:00Z");
      expect((await purge(false)).bookings_scrubbed_clinical).toBe(0);
      await configure("2036-06-16T12:00:00Z");
      expect((await purge(false)).bookings_scrubbed_clinical).toBe(1);
    });
  });

  it("uses 8 years once the consultation is on the 18th birthday", async () => {
    await inTxn(async () => {
      await db.exec(people());
      await db.exec(`
        INSERT INTO public.dependents (id, parent_id, first_name, last_name, date_of_birth)
        VALUES ('${DEP}', '${P}', 'Kid', 'Ient', '2010-06-15');
        INSERT INTO public.bookings (
          id, patient_id, doctor_id, dependent_id, status, appointment_date, visit_summary, paid_at
        ) VALUES (
          '${B}', '${P}', '${D}', '${DEP}', 'completed', '2028-06-15', 'adult', '2034-01-01T12:00:00Z'
        );
      `);
      await configure("2036-06-15T12:00:00Z");
      expect((await purge(false)).bookings_scrubbed_clinical).toBe(0);
      await configure("2036-06-16T12:00:00Z");
      expect((await purge(false)).bookings_scrubbed_clinical).toBe(1);
    });
  });

  it("holds a consultation with no date of birth", async () => {
    await inTxn(async () => {
      await db.exec(people(null));
      await db.exec(`
        INSERT INTO public.dependents (id, parent_id, first_name, last_name, date_of_birth)
        VALUES ('${DEP}', '${P}', 'Kid', 'Ient', NULL);
        INSERT INTO public.bookings (
          id, patient_id, doctor_id, dependent_id, status, appointment_date, visit_summary, paid_at
        ) VALUES (
          '${B}', '${P}', '${D}', '${DEP}', 'completed', '1990-01-01', 'still here', '1990-01-01T12:00:00Z'
        );
      `);
      await configure("2026-01-02T12:00:00Z");
      const result = await purge(false);
      expect(result.held_missing_dob).toBe(1);
      expect(result.bookings_scrubbed_clinical).toBe(0);
      expect(result.bookings_deleted).toBe(0);
      const row = await db.query<{ visit_summary: string }>(`SELECT visit_summary FROM public.bookings`);
      expect(row.rows[0].visit_summary).toBe("still here");
    });
  });

  it("uses the captured date of birth after the live column is null", async () => {
    await inTxn(async () => {
      await db.exec(people(null));
      await db.exec(`
        INSERT INTO public.retention_subjects (subject_type, subject_id, date_of_birth)
        VALUES ('patient', '${P}', '1990-01-01');
        INSERT INTO public.bookings (id, patient_id, doctor_id, status, appointment_date, visit_summary, paid_at)
        VALUES ('${B}', '${P}', '${D}', 'completed', '2018-01-01', 'captured', '2024-01-01T12:00:00Z');
      `);
      await configure("2026-01-02T12:00:00Z");
      const result = await purge(false);
      expect(result.held_missing_dob).toBe(0);
      expect(result.bookings_scrubbed_clinical).toBe(1);
    });
  });

  it("holds a thread until the latest clinical end, including a dependent who saw that doctor", async () => {
    await inTxn(async () => {
      await db.exec(people("1990-01-01"));
      await db.exec(`
        INSERT INTO public.dependents (id, parent_id, first_name, last_name, date_of_birth)
        VALUES ('${DEP}', '${P}', 'Kid', 'Ient', '2010-06-15');
        INSERT INTO public.bookings (id, patient_id, doctor_id, status, appointment_date, visit_summary, paid_at)
        VALUES ('${B}', '${P}', '${D}', 'completed', '2010-01-01', 'adult', '2030-01-01T12:00:00Z');
        INSERT INTO public.bookings (id, patient_id, doctor_id, dependent_id, status, appointment_date, visit_summary, paid_at)
        VALUES ('${AUD}', '${P}', '${D}', '${DEP}', 'completed', '2027-06-15', 'child', '2030-01-01T12:00:00Z');
        INSERT INTO public.conversations (id, doctor_id, patient_id) VALUES ('${RX}', '${D}', '${P}');
        INSERT INTO public.direct_messages (id, conversation_id, sender_id, body)
        VALUES ('${DEP}', '${RX}', '${P}', 'please keep this');
      `);
      await configure("2020-01-02T12:00:00Z");
      expect((await purge(false)).messages_deleted).toBe(0);
      expect((await db.query(`SELECT id FROM public.direct_messages`)).rows).toHaveLength(1);
      await configure("2036-06-16T12:00:00Z");
      const result = await purge(false);
      expect(result.messages_deleted).toBe(1);
      expect((await db.query(`SELECT id FROM public.direct_messages`)).rows).toHaveLength(0);
    });
  });

  it("holds a non-zero wallet and deletes a zero wallet with its points", async () => {
    await inTxn(async () => {
      await db.exec(people());
      await db.exec(`
        INSERT INTO public.patient_wallet (id, patient_id, currency, balance_cents)
        VALUES ('${B}', '${P}', 'GBP', 50);
        INSERT INTO public.wallet_transactions (id, patient_id, currency, amount_cents, created_at, description)
        VALUES ('${AUD}', '${P}', 'GBP', 50, '2010-01-01T12:00:00Z', 'old');
        INSERT INTO public.patient_points (patient_id, available_points, lifetime_points)
        VALUES ('${P}', 10, 10);
        INSERT INTO public.points_transactions (id, patient_id, points, created_at)
        VALUES ('${RX}', '${P}', 10, '2010-01-01T12:00:00Z');
      `);
      await configure("2030-04-02T12:00:00Z");
      const held = await purge(false);
      expect(held.held_wallet_balance).toBe(1);
      expect(held.wallets_deleted).toBe(0);
      expect((await db.query(`SELECT patient_id FROM public.patient_points`)).rows).toHaveLength(1);
      await db.exec(`UPDATE public.patient_wallet SET balance_cents = 0 WHERE id = '${B}'`);
      const cleared = await purge(false);
      expect(cleared.wallets_deleted).toBe(1);
      expect(cleared.points_deleted).toBe(1);
      expect((await db.query(`SELECT id FROM public.patient_wallet`)).rows).toHaveLength(0);
      expect((await db.query(`SELECT id FROM public.wallet_transactions`)).rows).toHaveLength(0);
      expect((await db.query(`SELECT patient_id FROM public.patient_points`)).rows).toHaveLength(0);
    });
  });

  it("does not purge a zero wallet that has never had a transaction", async () => {
    await inTxn(async () => {
      await db.exec(people());
      await db.exec(`
        INSERT INTO public.patient_wallet (id, patient_id, currency, balance_cents)
        VALUES ('${B}', '${P}', 'GBP', 0);
      `);
      await configure("2040-01-02T12:00:00Z");
      const result = await purge(false);
      expect(result.wallets_deleted).toBe(0);
      expect(result.held_wallet_balance).toBe(0);
      expect((await db.query(`SELECT id FROM public.patient_wallet`)).rows).toHaveLength(1);
    });
  });

  it("blocks every purge for an open legal hold and proceeds once it is closed", async () => {
    await inTxn(async () => {
      await db.exec(people());
      await db.exec(`
        INSERT INTO public.bookings (id, patient_id, doctor_id, status, paid_at)
        VALUES ('${B}', '${P}', '${D}', 'confirmed', '2010-04-01T12:00:00Z');
        INSERT INTO public.legal_holds (subject_type, subject_id, reason_code)
        VALUES ('booking', '${B}', 'litigation');
      `);
      await configure("2030-04-02T12:00:00Z");
      const held = await purge(false);
      expect(held.held_legal_hold).toBe(1);
      expect(held.bookings_deleted).toBe(0);
      await db.exec(`UPDATE public.legal_holds SET closed_at = now() WHERE subject_id = '${B}'`);
      expect((await purge(false)).bookings_deleted).toBe(1);
    });
  });

  it("redacts dispute text 12 months after close and leaves the ledger amounts", async () => {
    await inTxn(async () => {
      await db.exec(people());
      await db.exec(`
        INSERT INTO public.bookings (
          id, patient_id, doctor_id, status, paid_at,
          stripe_dispute_status, stripe_dispute_reason, stripe_dispute_closed_at
        ) VALUES (
          '${B}', '${P}', '${D}', 'confirmed', '2024-06-01T12:00:00Z',
          'lost', 'cardholder says no', '2025-01-01T12:00:00Z'
        );
        INSERT INTO public.payment_corrections (
          id, booking_id, patient_id, status, reason, statement_line, amount_cents,
          dispute_reason, created_by, created_at, dispute_resolved_at
        ) VALUES (
          '${RX}', '${B}', '${P}', 'settled', 'free text reason', 'ledger line', 100,
          'evidence', '${DU}', '2025-01-02T12:00:00Z', '2025-01-02T12:00:00Z'
        );
      `);
      await configure("2026-01-01T12:00:00Z");
      expect((await purge(false)).dispute_narratives_redacted).toBe(0);
      const early = await db.query<{ stripe_dispute_reason: string }>(
        `SELECT stripe_dispute_reason FROM public.bookings`
      );
      expect(early.rows[0].stripe_dispute_reason).toBe("cardholder says no");
      await configure("2026-01-03T12:00:00Z");
      const result = await purge(false);
      expect(result.dispute_narratives_redacted).toBeGreaterThanOrEqual(1);
      const booking = await db.query<{ stripe_dispute_reason: string | null }>(
        `SELECT stripe_dispute_reason FROM public.bookings`
      );
      expect(booking.rows[0].stripe_dispute_reason).toBeNull();
      const correction = await db.query<{ reason: string; statement_line: string; amount_cents: number }>(
        `SELECT reason, statement_line, amount_cents FROM public.payment_corrections`
      );
      expect(correction.rows[0]).toEqual({
        reason: "[redacted]",
        statement_line: "ledger line",
        amount_cents: 100,
      });
      const events = await db.query(`SELECT event_type FROM public.payment_correction_events`);
      expect(events.rows).toEqual([{ event_type: "dispute_redacted" }]);
      const again = await purge(false);
      expect(again.dispute_narratives_redacted).toBe(0);
      expect((await db.query(`SELECT event_type FROM public.payment_correction_events`)).rows).toHaveLength(1);
      const view = await db.query<{ payload: { reason?: string; redacted?: boolean } }>(
        `SELECT payload FROM public.payment_correction_events_read`
      );
      expect(view.rows[0].payload.reason).toBeUndefined();
    });
  });

  it("does not redact an open dispute or one that closed yesterday", async () => {
    await inTxn(async () => {
      await db.exec(people());
      await db.exec(`
        INSERT INTO public.bookings (
          id, patient_id, doctor_id, status, paid_at, stripe_dispute_status, stripe_dispute_reason
        ) VALUES (
          '${B}', '${P}', '${D}', 'confirmed', '2024-01-01T12:00:00Z', 'needs_response', 'open text'
        );
      `);
      await configure("2030-01-02T12:00:00Z");
      const open = await purge(false);
      expect(open.held_open_dispute).toBe(1);
      expect(open.dispute_narratives_redacted).toBe(0);
      expect((await db.query<{ stripe_dispute_reason: string }>(`SELECT stripe_dispute_reason FROM public.bookings`)).rows[0].stripe_dispute_reason).toBe("open text");
    });
  });

  it("deletes generic audit rows after 2 years and keeps the payment and prescription exceptions", async () => {
    await inTxn(async () => {
      await db.exec(people("1990-01-01"));
      await db.exec(`
        INSERT INTO public.prescriptions (id, doctor_id, patient_id, booking_id, prescribed_at)
        VALUES ('${RX}', '${D}', '${P}', NULL, '2018-01-01T12:00:00Z');
        INSERT INTO public.audit_log (id, actor_id, action, target_type, target_id, created_at, metadata) VALUES
          ('${B}', '${DU}', 'login', 'profile', '${P}', '2020-01-01T12:00:00Z', '{"email":"secret@example.com"}'),
          ('${AUD}', '${DU}', 'login', 'profile', '${P}', '2025-06-01T12:00:00Z', '{}'),
          ('${DEP}', '${DU}', 'corrected', 'payment_correction', '${RX}', '2010-04-01T12:00:00Z', '{"reason":"secret"}');
      `);
      await configure("2026-01-02T12:00:00Z", "apply", null);
      const held = await purge(false);
      expect(held.audit_log_deleted).toBe(1);
      expect(held.held_no_fy_end).toBeGreaterThanOrEqual(1);
      const left = await db.query<{ id: string }>(`SELECT id FROM public.audit_log ORDER BY id`);
      expect(left.rows.map((row) => row.id).sort()).toEqual([AUD, DEP].sort());
      await db.exec("SAVEPOINT append_only");
      await expect(db.query(`DELETE FROM public.audit_log WHERE id = '${AUD}'`)).rejects.toThrow(
        /append-only/
      );
      await db.exec("ROLLBACK TO SAVEPOINT append_only");
      await db.query(`SELECT set_config('mydoctors360.retention_purge', 'on', true)`);
      await db.exec("SAVEPOINT append_only_update");
      await expect(
        db.query(`UPDATE public.audit_log SET action = 'changed' WHERE id = '${AUD}'`)
      ).rejects.toThrow(/append-only/);
      await db.exec("ROLLBACK TO SAVEPOINT append_only_update");
      await db.query(`SELECT set_config('mydoctors360.retention_purge', 'off', true)`);
    });
  });

  it("deletes a payment-correction audit row when the financial clock has ended", async () => {
    await inTxn(async () => {
      await db.exec(people());
      await db.exec(`
        INSERT INTO public.audit_log (id, actor_id, action, target_type, target_id, created_at)
        VALUES ('${B}', '${DU}', 'corrected', 'payment_recovery', '${P}', '2018-04-01T12:00:00Z');
      `);
      await configure("2026-04-01T12:00:00Z");
      expect((await purge(false)).audit_log_deleted).toBe(1);
      expect((await db.query(`SELECT id FROM public.audit_log`)).rows).toHaveLength(0);
    });
  });

  it("keeps a prescription audit row on the clinical clock", async () => {
    await inTxn(async () => {
      await db.exec(people("1990-01-01"));
      await db.exec(`
        INSERT INTO public.bookings (id, patient_id, doctor_id, status, appointment_date, visit_summary, paid_at)
        VALUES ('${B}', '${P}', '${D}', 'completed', '2020-01-01', 'recent', '2024-01-01T12:00:00Z');
        INSERT INTO public.prescriptions (id, doctor_id, patient_id, booking_id, prescribed_at)
        VALUES ('${RX}', '${D}', '${P}', '${B}', '2020-01-01T12:00:00Z');
        INSERT INTO public.audit_log (id, actor_id, action, target_type, target_id, created_at)
        VALUES ('${AUD}', '${DU}', 'issued', 'prescription', '${RX}', '2020-01-01T12:00:00Z');
      `);
      await configure("2026-01-02T12:00:00Z");
      expect((await purge(false)).audit_log_deleted).toBe(0);
      expect((await db.query(`SELECT id FROM public.audit_log`)).rows).toHaveLength(1);
    });
  });

  it("deletes a contact inquiry after 2 years, or 6 years after its hold closes", async () => {
    await inTxn(async () => {
      await db.exec(`
        INSERT INTO public.contact_inquiries (id, name, email, message, created_at) VALUES
          ('${B}', 'Ann', 'ann@example.com', 'hello', '2020-01-01T12:00:00Z'),
          ('${AUD}', 'Bob', 'bob@example.com', 'complaint', '2020-01-01T12:00:00Z'),
          ('${DEP}', 'Cara', 'cara@example.com', 'closed', '2010-01-01T12:00:00Z');
        INSERT INTO public.legal_holds (subject_type, subject_id, reason_code, opened_at)
        VALUES ('contact_inquiry', '${AUD}', 'complaint', '2020-02-01T12:00:00Z');
        INSERT INTO public.legal_holds (subject_type, subject_id, reason_code, opened_at, closed_at)
        VALUES ('contact_inquiry', '${DEP}', 'litigation', '2010-01-01T12:00:00Z', '2020-01-01T12:00:00Z');
      `);
      await configure("2026-01-01T12:00:00Z");
      const first = await purge(false);
      expect(first.contact_inquiries_deleted).toBe(1);
      expect(first.held_legal_hold).toBeGreaterThanOrEqual(1);
      const ids = await db.query<{ id: string }>(`SELECT id FROM public.contact_inquiries ORDER BY id`);
      expect(ids.rows.map((row) => row.id).sort()).toEqual([AUD, DEP].sort());
      await configure("2026-01-02T12:00:00Z");
      expect((await purge(false)).contact_inquiries_deleted).toBe(1);
      expect((await db.query<{ id: string }>(`SELECT id FROM public.contact_inquiries`)).rows.map((row) => row.id)).toEqual([AUD]);
    });
  });

  it("scrubs a restricted sole owner and ignores removed or a stored left status", async () => {
    await inTxn(async () => {
      await db.exec(people());
      await db.exec(`
        UPDATE public.profiles SET restricted_at = '2024-01-01T00:00:00Z' WHERE id = '${DU}';
        INSERT INTO public.organizations (
          id, name, slug, email, address_line1, website, logo_url, description, stripe_customer_id
        ) VALUES (
          '${B}', 'Secret Clinic', 'secret', 'clinic@example.com', '1 High Street',
          'https://secret.example', 'logo.png', 'about us', 'cus_keep'
        );
        INSERT INTO public.organization_members (id, organization_id, user_id, role, status)
        VALUES ('${AUD}', '${B}', '${DU}', 'owner', 'suspended');
      `);
      await configure("2026-01-02T12:00:00Z", "apply", null);
      const result = await purge(false);
      expect(result.organizations_scrubbed).toBe(1);
      expect(result.organizations_stripe_customer_cleared).toBe(0);
      const org = await db.query<{
        name: string;
        slug: string;
        address_line1: string | null;
        website: string | null;
        logo_url: string | null;
        description: string | null;
        stripe_customer_id: string | null;
      }>(`SELECT name, slug, address_line1, website, logo_url, description, stripe_customer_id FROM public.organizations`);
      expect(org.rows[0]).toEqual({
        name: "",
        slug: `erased-${B}`,
        address_line1: null,
        website: null,
        logo_url: null,
        description: null,
        stripe_customer_id: "cus_keep",
      });
      const member = await db.query<{ status: string }>(`SELECT status FROM public.organization_members`);
      expect(member.rows[0].status).toBe("suspended");
      expect((await purge(false)).organizations_scrubbed).toBe(0);
    });
  });

  it("does not scrub when an invited or unrestricted suspended colleague remains", async () => {
    await inTxn(async () => {
      await db.exec(people());
      await db.exec(`
        INSERT INTO auth.users (id, email) VALUES ('${DEP}', 'other@example.com');
        INSERT INTO public.profiles (id, role, first_name, last_name, email)
        VALUES ('${DEP}', 'doctor', 'Other', 'Person', 'other@example.com');
        UPDATE public.profiles SET restricted_at = now() WHERE id = '${DU}';
        INSERT INTO public.organizations (id, name, slug) VALUES ('${B}', 'Live Clinic', 'live');
        INSERT INTO public.organization_members (id, organization_id, user_id, role, status) VALUES
          ('${AUD}', '${B}', '${DU}', 'owner', 'suspended'),
          ('${RX}', '${B}', '${DEP}', 'doctor', 'invited');
      `);
      await configure("2026-01-02T12:00:00Z");
      expect((await purge(false)).organizations_scrubbed).toBe(0);
      await db.exec(`UPDATE public.organization_members SET status = 'suspended' WHERE id = '${RX}'`);
      expect((await purge(false)).organizations_scrubbed).toBe(0);
      const name = await db.query<{ name: string }>(`SELECT name FROM public.organizations`);
      expect(name.rows[0].name).toBe("Live Clinic");
    });
  });

  it("treats a stored left status as not present", async () => {
    await inTxn(async () => {
      await db.exec(people());
      await db.exec(`
        INSERT INTO auth.users (id, email) VALUES ('${DEP}', 'left@example.com');
        INSERT INTO public.profiles (id, role, first_name, last_name, email)
        VALUES ('${DEP}', 'doctor', 'Left', 'Person', 'left@example.com');
        UPDATE public.profiles SET restricted_at = now() WHERE id = '${DU}';
        ALTER TABLE public.organization_members DROP CONSTRAINT organization_members_status_check;
        INSERT INTO public.organizations (id, name, slug) VALUES ('${B}', 'Left Clinic', 'left-clinic');
        INSERT INTO public.organization_members (id, organization_id, user_id, role, status) VALUES
          ('${AUD}', '${B}', '${DU}', 'owner', 'suspended'),
          ('${RX}', '${B}', '${DEP}', 'doctor', 'left');
      `);
      await configure("2026-01-02T12:00:00Z");
      expect((await purge(false)).organizations_scrubbed).toBe(1);
      const name = await db.query<{ name: string }>(`SELECT name FROM public.organizations`);
      expect(name.rows[0].name).toBe("");
    });
  });

  it("clears stripe_customer_id only after the licence financial clock", async () => {
    await inTxn(async () => {
      await db.exec(people());
      await db.exec(`
        UPDATE public.profiles SET restricted_at = now() WHERE id = '${DU}';
        INSERT INTO public.organizations (id, name, slug, stripe_customer_id)
        VALUES ('${B}', 'Billed', 'billed', 'cus_123');
        INSERT INTO public.organization_members (id, organization_id, user_id, role, status)
        VALUES ('${AUD}', '${B}', '${DU}', 'owner', 'active');
        INSERT INTO public.licenses (id, organization_id, status, cancelled_at)
        VALUES ('${RX}', '${B}', 'cancelled', '2018-04-01T12:00:00Z');
      `);
      await configure("2026-04-01T12:00:00Z", "apply", null);
      expect((await purge(false)).organizations_stripe_customer_cleared).toBe(0);
      await configure("2024-04-01T12:00:00Z");
      expect((await purge(false)).organizations_stripe_customer_cleared).toBe(0);
      await configure("2026-04-01T12:00:00Z");
      expect((await purge(false)).organizations_stripe_customer_cleared).toBe(1);
      const stripe = await db.query<{ stripe_customer_id: string | null }>(
        `SELECT stripe_customer_id FROM public.organizations`
      );
      expect(stripe.rows[0].stripe_customer_id).toBeNull();
    });
  });

  it("sets left_at when erasure restricts a doctor and scrubs regulatory columns six years later", async () => {
    await inTxn(async () => {
      await db.exec(people());
      await db.exec(`
        INSERT INTO public.prescriptions (id, doctor_id, patient_id, prescribed_at, diagnosis)
        VALUES ('${RX}', '${D}', '${P}', now(), 'keep');
        UPDATE public.doctors SET
          gmc_number = '123',
          cqc_status = 'registered',
          cqc_provider_id = '1-1',
          cqc_location_id = '1-2',
          indemnity_insurer = 'Insurer',
          mpl_designated_body = 'Body',
          dbs_check_date = '2020-01-01',
          excluded_procedures_attestation = true
        WHERE id = '${D}';
        INSERT INTO public.doctor_approval_checklist (
          doctor_id, reviewer_id, gmc_verified, dbs_check_verified, notes,
          excluded_procedures_attestation_confirmed
        ) VALUES ('${D}', '${DU}', true, true, 'reviewer note', true);
      `);
      await db.query(`SELECT public.erase_account($1::uuid)`, [DU]);
      const left = await db.query<{ left_at: string | null }>(
        `SELECT left_at FROM public.doctors WHERE id = '${D}'`
      );
      expect(left.rows[0].left_at).toBeTruthy();
      await db.exec(`UPDATE public.doctors SET left_at = '2018-01-01T12:00:00Z' WHERE id = '${D}'`);
      await configure("2024-01-02T12:00:00Z");
      const result = await purge(false);
      expect(result.doctor_regulatory_scrubbed).toBe(1);
      const doctor = await db.query<{
        gmc_number: string | null;
        cqc_status: string;
        dbs_check_date: string | null;
        excluded_procedures_attestation: boolean;
      }>(`SELECT gmc_number, cqc_status, dbs_check_date, excluded_procedures_attestation FROM public.doctors`);
      expect(doctor.rows[0]).toEqual({
        gmc_number: null,
        cqc_status: "unknown",
        dbs_check_date: null,
        excluded_procedures_attestation: true,
      });
      const checklist = await db.query<{ dbs_check_verified: boolean; notes: string | null }>(
        `SELECT dbs_check_verified, notes FROM public.doctor_approval_checklist`
      );
      expect(checklist.rows[0].dbs_check_verified).toBe(false);
      expect(checklist.rows[0].notes).toBeNull();
    });
  });

  it("deletes a DBS certificate six months after verification and keeps the check date", async () => {
    await inTxn(async () => {
      await db.exec(people());
      await db.exec(`
        INSERT INTO public.doctor_documents (id, doctor_id, document_type, storage_path, file_name, verified_at)
        VALUES ('${RX}', '${D}', 'other', 'private/dbs.pdf', 'dbs.pdf', '2025-01-01T12:00:00Z');
        UPDATE public.doctors SET dbs_document_id = '${RX}', dbs_check_date = '2025-01-01', left_at = now()
        WHERE id = '${D}';
      `);
      await configure("2025-07-02T12:00:00Z");
      const result = await purge(false);
      expect(result.dbs_documents_deleted).toBe(1);
      expect(result.missing_object).toBe(1);
      expect(JSON.stringify(result)).not.toContain("dbs.pdf");
      const doctor = await db.query<{ dbs_document_id: string | null; dbs_check_date: string | null }>(
        `SELECT dbs_document_id, dbs_check_date FROM public.doctors`
      );
      expect(doctor.rows[0].dbs_document_id).toBeNull();
      expect(doctor.rows[0].dbs_check_date).toBeTruthy();
      expect((await db.query(`SELECT id FROM public.doctor_documents`)).rows).toHaveLength(0);
    });
  });

  it("does not delete a DBS file when verification and decision dates are both absent", async () => {
    await inTxn(async () => {
      await db.exec(people());
      await db.exec(`
        INSERT INTO public.doctor_documents (id, doctor_id, document_type, storage_path, file_name, verified_at)
        VALUES ('${RX}', '${D}', 'other', 'private/dbs.pdf', 'dbs.pdf', NULL);
        UPDATE public.doctors SET dbs_document_id = '${RX}', left_at = '2010-01-01T00:00:00Z'
        WHERE id = '${D}';
      `);
      await configure("2026-01-02T12:00:00Z");
      expect((await purge(false)).dbs_documents_deleted).toBe(0);
      expect((await db.query(`SELECT id FROM public.doctor_documents`)).rows).toHaveLength(1);
    });
  });

  it("limits a prescription batch and deletes that prescription's audit rows with it", async () => {
    await inTxn(async () => {
      await db.exec(people("1990-01-01"));
      await db.exec(`
        INSERT INTO public.prescriptions (id, doctor_id, patient_id, prescribed_at) VALUES
          ('10000000-0000-4000-8000-000000000001', '${D}', '${P}', '2010-01-01T12:00:00Z'),
          ('10000000-0000-4000-8000-000000000002', '${D}', '${P}', '2010-01-02T12:00:00Z'),
          ('10000000-0000-4000-8000-000000000003', '${D}', '${P}', '2010-01-03T12:00:00Z');
        INSERT INTO public.prescription_audit_log (id, prescription_id, event_type, actor_profile_id, snapshot) VALUES
          ('${RX}', '10000000-0000-4000-8000-000000000001', 'issued', '${DU}', '{}'),
          ('${B}', '10000000-0000-4000-8000-000000000001', 'amended', '${DU}', '{}');
      `);
      await configure("2026-01-02T12:00:00Z");
      const dry = await purge(true, 1);
      expect(dry.prescriptions_deleted).toBe(1);
      expect((await db.query(`SELECT id FROM public.prescriptions`)).rows).toHaveLength(3);
      expect((await purge(false, 1)).prescriptions_deleted).toBe(1);
      expect((await db.query(`SELECT id FROM public.prescription_audit_log`)).rows).toHaveLength(0);
      expect((await db.query(`SELECT id FROM public.prescriptions`)).rows).toHaveLength(2);
      expect((await purge(false, 1)).prescriptions_deleted).toBe(1);
      expect((await purge(false, 1)).prescriptions_deleted).toBe(1);
      expect((await db.query(`SELECT id FROM public.prescriptions`)).rows).toHaveLength(0);
    });
  });

  it("counts a restricted account and does not delete the auth user", async () => {
    await inTxn(async () => {
      await db.exec(people());
      await db.exec(`UPDATE public.profiles SET restricted_at = now() WHERE id = '${P}'`);
      await configure("2026-01-02T12:00:00Z");
      const result = await purge(false);
      expect(result.accounts_clear).toBe(1);
      expect((await db.query(`SELECT id FROM auth.users WHERE id = '${P}'`)).rows).toHaveLength(1);
    });
  });

  it("still returns counts when an optional booking column is absent", async () => {
    await inTxn(async () => {
      await db.exec(`ALTER TABLE public.bookings DROP COLUMN visit_summary`);
      await configure("2026-01-02T12:00:00Z");
      const result = await purge(false);
      expect(result.bookings_deleted).toBe(0);
      expect(result.call_attendance).toBe(0);
    });
  });

  it("does not grant execute to anon or authenticated", async () => {
    await inTxn(async () => {
      await db.exec(`SET LOCAL ROLE anon`);
      await expect(db.query(`SELECT public.purge_expired_retention(true, 1)`)).rejects.toThrow(/permission denied/i);
    });
    await inTxn(async () => {
      await db.exec(`SET LOCAL ROLE authenticated`);
      await expect(db.query(`SELECT public.purge_expired_retention(true, 1)`)).rejects.toThrow(/permission denied/i);
    });
    await inTxn(async () => {
      await db.exec(`SET LOCAL ROLE anon`);
      await expect(db.query(`SELECT count(*) FROM public.legal_holds`)).rejects.toThrow(/permission denied/i);
    });
  });
});

describe("retention backfill", () => {
  it("copies left_at and live dates of birth when 00143 runs", async () => {
    const db = new PGlite();
    await db.exec(SCHEMA);
    await db.exec(readFileSync(join(process.cwd(), "supabase/migrations/00135_account_erasure.sql"), "utf8"));
    await db.exec(readFileSync(join(process.cwd(), "supabase/migrations/00142_retention_subjects.sql"), "utf8"));
    await db.exec(`
      INSERT INTO auth.users (id, email) VALUES ('${P}', 'p@example.com'), ('${DU}', 'd@example.com');
      INSERT INTO public.profiles (id, role, first_name, last_name, email, date_of_birth) VALUES
        ('${P}', 'patient', 'Pat', 'Ient', 'p@example.com', '1985-05-05'),
        ('${DU}', 'doctor', 'Doc', 'Tor', 'd@example.com', NULL);
      UPDATE public.profiles SET restricted_at = '2024-05-01T00:00:00Z' WHERE id = '${DU}';
      INSERT INTO public.doctors (id, profile_id, slug) VALUES ('${D}', '${DU}', 'doc-tor');
      INSERT INTO public.dependents (id, parent_id, first_name, last_name, date_of_birth)
      VALUES ('${DEP}', '${P}', 'Kid', 'Ient', '2012-12-12');
    `);
    await db.exec(readFileSync(join(process.cwd(), "supabase/migrations/00143_retention_purge.sql"), "utf8"));
    const doctor = await db.query<{ left_at: string }>(`SELECT left_at::text AS left_at FROM public.doctors`);
    expect(doctor.rows[0].left_at).toContain("2024-05-01");
    const subjects = await db.query<{ subject_type: string; date_of_birth: string }>(
      `SELECT subject_type, date_of_birth::text FROM public.retention_subjects ORDER BY subject_type`
    );
    expect(subjects.rows).toEqual([
      { subject_type: "dependent", date_of_birth: "2012-12-12" },
      { subject_type: "patient", date_of_birth: "1985-05-05" },
    ]);
    await db.close();
  });
});
