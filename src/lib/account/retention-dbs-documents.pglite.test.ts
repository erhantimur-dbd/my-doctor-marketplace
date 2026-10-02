import { readFileSync } from "node:fs";
import { join } from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const P = "11111111-1111-4111-8111-111111111111";
const DU = "22222222-2222-4222-8222-222222222222";
const D = "33333333-3333-4333-8333-333333333333";
const DOC = "66666666-6666-4666-8666-666666666666";
const DIP = "55555555-5555-4555-8555-555555555555";
const IND = "77777777-7777-4777-8777-777777777777";
const W = "88888888-8888-4888-8888-888888888888";
const GC = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const CORR = "99999999-9999-4999-8999-999999999999";
const B = "55555555-5555-4555-8555-555555555556";

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
  verified_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
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

describe("DBS record, document files, and empty restricted wallets", () => {
  let db: PGlite;

  beforeAll(async () => {
    db = new PGlite();
    await db.exec(SCHEMA);
    await db.exec(readFileSync(join(process.cwd(), "supabase/migrations/00135_account_erasure.sql"), "utf8"));
    await db.exec(readFileSync(join(process.cwd(), "supabase/migrations/00142_retention_subjects.sql"), "utf8"));
    await db.exec(readFileSync(join(process.cwd(), "supabase/migrations/00143_retention_purge.sql"), "utf8"));
    await db.exec(readFileSync(join(process.cwd(), "supabase/migrations/00145_dbs_documents_retention.sql"), "utf8"));
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

  function people() {
    return `
      INSERT INTO auth.users (id, email) VALUES ('${P}', 'p@example.com'), ('${DU}', 'd@example.com');
      INSERT INTO public.profiles (id, role, first_name, last_name, email) VALUES
        ('${P}', 'patient', 'Pat', 'Ient', 'p@example.com'),
        ('${DU}', 'doctor', 'Doc', 'Tor', 'd@example.com');
      INSERT INTO public.doctors (id, profile_id, slug, verification_status) VALUES
        ('${D}', '${DU}', 'doc-tor', 'approved');
    `;
  }

  async function flag(): Promise<boolean> {
    const row = await db.query<{ dbs_reupload_required: boolean }>(
      `SELECT dbs_reupload_required FROM public.doctors WHERE id = '${D}'`
    );
    return row.rows[0].dbs_reupload_required;
  }

  async function documentCount(): Promise<number> {
    const row = await db.query<{ n: number }>(`SELECT count(*)::int AS n FROM public.doctor_documents`);
    return row.rows[0].n;
  }

  it("leaves the purge seed on dry_run and rejects an unknown DBS level", async () => {
    const seed = await db.query<{ value: { mode: string } }>(
      `SELECT value FROM public.platform_settings WHERE key = 'retention_purge'`
    );
    expect(seed.rows[0].value.mode).toBe("dry_run");
    await inTxn(async () => {
      await db.exec(people());
      await expect(
        db.query(`UPDATE public.doctors SET dbs_level = 'barred' WHERE id = '${D}'`)
      ).rejects.toThrow(/check/i);
    });
  });

  it("records the checklist tick once and does not move that timestamp", async () => {
    await inTxn(async () => {
      await db.exec(people());
      await db.exec(`
        INSERT INTO public.doctor_approval_checklist (doctor_id, reviewer_id, dbs_check_verified)
        VALUES ('${D}', '${DU}', false);
      `);
      const before = await db.query<{ checklist: string | null; doctor: string | null; by: string | null }>(`
        SELECT k.dbs_check_verified_at::text AS checklist,
               d.dbs_verified_at::text AS doctor,
               d.dbs_verified_by::text AS by
        FROM public.doctor_approval_checklist AS k
        JOIN public.doctors AS d ON d.id = k.doctor_id
      `);
      expect(before.rows[0]).toEqual({ checklist: null, doctor: null, by: null });
      await db.exec(`
        UPDATE public.doctor_approval_checklist
        SET dbs_check_verified = true
        WHERE doctor_id = '${D}';
      `);
      const ticked = await db.query<{ checklist: string; doctor: string; by: string }>(`
        SELECT k.dbs_check_verified_at::text AS checklist,
               d.dbs_verified_at::text AS doctor,
               d.dbs_verified_by::text AS by
        FROM public.doctor_approval_checklist AS k
        JOIN public.doctors AS d ON d.id = k.doctor_id
      `);
      expect(ticked.rows[0].checklist).toBeTruthy();
      expect(ticked.rows[0].doctor).toBeTruthy();
      expect(ticked.rows[0].by).toBe(DU);
      await db.exec(`
        UPDATE public.doctor_approval_checklist
        SET dbs_check_verified = true, notes = 'still ticked'
        WHERE doctor_id = '${D}';
      `);
      const again = await db.query<{ checklist: string; doctor: string }>(`
        SELECT k.dbs_check_verified_at::text AS checklist, d.dbs_verified_at::text AS doctor
        FROM public.doctor_approval_checklist AS k
        JOIN public.doctors AS d ON d.id = k.doctor_id
      `);
      expect(again.rows[0]).toEqual({
        checklist: ticked.rows[0].checklist,
        doctor: ticked.rows[0].doctor,
      });
    });
  });

  it("keeps a verified certificate on the six-month anniversary and deletes it the next day", async () => {
    await inTxn(async () => {
      await db.exec(people());
      await db.exec(`
        INSERT INTO public.doctor_documents (id, doctor_id, document_type, storage_path, file_name, verified_at, created_at)
        VALUES ('${DOC}', '${D}', 'other', 'private/dbs.pdf', 'dbs.pdf', '2025-10-02T12:00:00Z', '2020-01-01T12:00:00Z');
        UPDATE public.doctors SET dbs_document_id = '${DOC}', left_at = '2026-01-01T12:00:00Z' WHERE id = '${D}';
      `);
      await configure("2026-04-02T12:00:00Z");
      expect((await purge(false)).dbs_documents_deleted).toBe(0);
      expect(await documentCount()).toBe(1);
      expect(await flag()).toBe(false);
      await configure("2026-04-03T12:00:00Z");
      const result = await purge(false);
      expect(result.dbs_documents_deleted).toBe(1);
      expect(result.dbs_reupload_flagged).toBe(0);
      expect(result.missing_object).toBe(1);
      expect(JSON.stringify(result)).not.toContain("dbs.pdf");
      expect(await documentCount()).toBe(0);
      expect(await flag()).toBe(false);
    });
  });

  it("uses the checklist verified time when the file itself has no verified_at", async () => {
    await inTxn(async () => {
      await db.exec(people());
      await db.exec(`
        INSERT INTO public.doctor_documents (id, doctor_id, document_type, storage_path, file_name, verified_at, created_at)
        VALUES ('${DOC}', '${D}', 'other', 'private/dbs.pdf', 'dbs.pdf', NULL, '2026-03-01T12:00:00Z');
        UPDATE public.doctors
        SET dbs_document_id = '${DOC}', dbs_verified_at = '2025-10-02T12:00:00Z', left_at = '2026-01-01T12:00:00Z'
        WHERE id = '${D}';
      `);
      await configure("2026-04-02T12:00:00Z");
      expect((await purge(false)).dbs_documents_deleted).toBe(0);
      await configure("2026-04-03T12:00:00Z");
      expect((await purge(false)).dbs_documents_deleted).toBe(1);
      expect(await documentCount()).toBe(0);
    });
  });

  it("keeps an unverified certificate on the six-month anniversary of upload and deletes it the next day", async () => {
    await inTxn(async () => {
      await db.exec(people());
      await db.exec(`
        INSERT INTO public.doctor_documents (id, doctor_id, document_type, storage_path, file_name, verified_at, created_at)
        VALUES ('${DOC}', '${D}', 'other', 'private/dbs.pdf', 'dbs.pdf', NULL, '2025-10-02T12:00:00Z');
        UPDATE public.doctors SET dbs_document_id = '${DOC}', left_at = '2026-01-01T12:00:00Z' WHERE id = '${D}';
      `);
      await configure("2026-04-02T12:00:00Z");
      expect((await purge(false)).dbs_documents_deleted).toBe(0);
      expect(await documentCount()).toBe(1);
      await configure("2026-04-03T12:00:00Z");
      const result = await purge(false);
      expect(result.dbs_documents_deleted).toBe(1);
      expect(result.dbs_reupload_flagged).toBe(0);
      expect(await flag()).toBe(false);
      expect(await documentCount()).toBe(0);
    });
  });

  it("deletes a complete DBS record's file immediately and does not ask for another upload", async () => {
    await inTxn(async () => {
      await db.exec(people());
      await db.exec(`
        INSERT INTO public.doctor_documents (id, doctor_id, document_type, storage_path, file_name, verified_at, created_at)
        VALUES ('${DOC}', '${D}', 'other', 'private/dbs.pdf', 'dbs.pdf', '2026-01-01T12:00:00Z', '2026-01-01T12:00:00Z');
        UPDATE public.doctors SET
          dbs_document_id = '${DOC}',
          dbs_certificate_number = 'DBS-100',
          dbs_level = 'enhanced',
          dbs_issue_date = '2026-01-01',
          dbs_verified_at = '2026-01-01T12:00:00Z',
          dbs_verified_by = '${DU}'
        WHERE id = '${D}';
      `);
      await configure("2026-01-02T12:00:00Z");
      const dry = await purge(true);
      expect(dry.dbs_documents_deleted).toBe(1);
      expect(dry.dbs_reupload_flagged).toBe(0);
      expect(dry.dry_run).toBe(true);
      expect(await documentCount()).toBe(1);
      expect(await flag()).toBe(false);
      const applied = await purge(false);
      expect(applied.dbs_documents_deleted).toBe(1);
      expect(applied.dbs_reupload_flagged).toBe(0);
      expect(await documentCount()).toBe(0);
      expect(await flag()).toBe(false);
      const kept = await db.query<{ dbs_certificate_number: string }>(
        `SELECT dbs_certificate_number FROM public.doctors WHERE id = '${D}'`
      );
      expect(kept.rows[0].dbs_certificate_number).toBe("DBS-100");
      expect((await purge(false)).dbs_documents_deleted).toBe(0);
    });
  });

  it("flags an active doctor to re-upload when an incomplete certificate passes six months", async () => {
    await inTxn(async () => {
      await db.exec(people());
      await db.exec(`
        INSERT INTO public.doctor_documents (id, doctor_id, document_type, storage_path, file_name, verified_at, created_at)
        VALUES ('${DOC}', '${D}', 'other', 'private/dbs.pdf', 'dbs.pdf', NULL, '2025-03-01T12:00:00Z');
        UPDATE public.doctors SET dbs_document_id = '${DOC}' WHERE id = '${D}';
      `);
      await configure("2025-10-02T12:00:00Z");
      const dry = await purge(true);
      expect(dry.dbs_documents_deleted).toBe(1);
      expect(dry.dbs_reupload_flagged).toBe(1);
      expect(await flag()).toBe(false);
      expect(await documentCount()).toBe(1);
      const applied = await purge(false);
      expect(applied.dbs_documents_deleted).toBe(1);
      expect(applied.dbs_reupload_flagged).toBe(1);
      expect(await flag()).toBe(true);
      expect(await documentCount()).toBe(0);
      const run = await db.query<{ counts: Counts }>(
        `SELECT counts FROM public.retention_purge_runs ORDER BY started_at DESC LIMIT 1`
      );
      expect(run.rows[0].counts.dbs_reupload_flagged).toBe(1);
      expect((await purge(false)).dbs_reupload_flagged).toBe(0);
      expect(await flag()).toBe(true);
    });
  });

  it("does not flag a doctor who has already left", async () => {
    await inTxn(async () => {
      await db.exec(people());
      await db.exec(`
        INSERT INTO public.doctor_documents (id, doctor_id, document_type, storage_path, file_name, verified_at, created_at)
        VALUES ('${DOC}', '${D}', 'other', 'private/dbs.pdf', 'dbs.pdf', NULL, '2025-03-01T12:00:00Z');
        UPDATE public.doctors SET dbs_document_id = '${DOC}', left_at = '2025-09-15T12:00:00Z' WHERE id = '${D}';
      `);
      await configure("2025-10-02T12:00:00Z");
      const result = await purge(false);
      expect(result.dbs_documents_deleted).toBe(1);
      expect(result.dbs_reupload_flagged).toBe(0);
      expect(await flag()).toBe(false);
      expect(await documentCount()).toBe(0);
    });
  });

  it("does not flag a restricted doctor who has not left", async () => {
    await inTxn(async () => {
      await db.exec(people());
      await db.exec(`
        INSERT INTO public.doctor_documents (id, doctor_id, document_type, storage_path, file_name, verified_at, created_at)
        VALUES ('${DOC}', '${D}', 'other', 'private/dbs.pdf', 'dbs.pdf', NULL, '2025-03-01T12:00:00Z');
        UPDATE public.doctors SET dbs_document_id = '${DOC}' WHERE id = '${D}';
        UPDATE public.profiles SET restricted_at = '2025-09-15T12:00:00Z' WHERE id = '${DU}';
      `);
      await configure("2025-10-02T12:00:00Z");
      const result = await purge(false);
      expect(result.dbs_documents_deleted).toBe(1);
      expect(result.dbs_reupload_flagged).toBe(0);
      expect(await flag()).toBe(false);
    });
  });

  it("does not delete or flag a certificate that is still inside six months", async () => {
    await inTxn(async () => {
      await db.exec(people());
      await db.exec(`
        INSERT INTO public.doctor_documents (id, doctor_id, document_type, storage_path, file_name, verified_at, created_at)
        VALUES ('${DOC}', '${D}', 'other', 'private/dbs.pdf', 'dbs.pdf', NULL, '2025-10-02T12:00:00Z');
        UPDATE public.doctors SET dbs_document_id = '${DOC}' WHERE id = '${D}';
      `);
      await configure("2026-04-02T12:00:00Z");
      const result = await purge(false);
      expect(result.dbs_documents_deleted).toBe(0);
      expect(result.dbs_reupload_flagged).toBe(0);
      expect(await flag()).toBe(false);
      expect(await documentCount()).toBe(1);
    });
  });

  it("holds a due certificate while a legal hold is open", async () => {
    await inTxn(async () => {
      await db.exec(people());
      await db.exec(`
        INSERT INTO public.doctor_documents (id, doctor_id, document_type, storage_path, file_name, verified_at, created_at)
        VALUES ('${DOC}', '${D}', 'other', 'private/dbs.pdf', 'dbs.pdf', NULL, '2025-03-01T12:00:00Z');
        UPDATE public.doctors SET dbs_document_id = '${DOC}' WHERE id = '${D}';
        INSERT INTO public.legal_holds (subject_type, subject_id, reason_code)
        VALUES ('profile', '${DU}', 'regulatory');
      `);
      await configure("2025-10-02T12:00:00Z");
      const result = await purge(false);
      expect(result.dbs_documents_deleted).toBe(0);
      expect(result.dbs_reupload_flagged).toBe(0);
      expect(result.held_legal_hold).toBeGreaterThanOrEqual(1);
      expect(await documentCount()).toBe(1);
      expect(await flag()).toBe(false);
    });
  });

  it("keeps diplomas and the indemnity file on the six-year anniversary and deletes them the next day", async () => {
    await inTxn(async () => {
      await db.exec(people());
      await db.exec(`
        CREATE SCHEMA IF NOT EXISTS storage;
        CREATE TABLE storage.objects (bucket_id text, name text);
        INSERT INTO storage.objects (bucket_id, name) VALUES ('message-attachments', 'docs/diploma.pdf');
        INSERT INTO public.doctor_documents (id, doctor_id, document_type, storage_path, file_name, created_at) VALUES
          ('${DIP}', '${D}', 'diploma', 'docs/diploma.pdf', 'diploma.pdf', '2020-01-01T12:00:00Z'),
          ('${IND}', '${D}', 'insurance', 'docs/indemnity.pdf', 'indemnity.pdf', '2020-01-01T12:00:00Z');
        UPDATE public.doctors
        SET left_at = '2018-06-01T12:00:00Z', indemnity_document_id = '${IND}'
        WHERE id = '${D}';
      `);
      await configure("2024-06-01T12:00:00Z");
      expect((await purge(false)).doctor_documents_deleted).toBe(0);
      expect(await documentCount()).toBe(2);
      await configure("2024-06-02T12:00:00Z");
      const result = await purge(false);
      expect(result.doctor_documents_deleted).toBe(2);
      expect(result.objects_queued).toBe(1);
      expect(result.missing_object).toBe(1);
      expect(JSON.stringify(result)).not.toContain("diploma.pdf");
      expect(await documentCount()).toBe(0);
      const doctor = await db.query<{ dbs_document_id: string | null; indemnity_document_id: string | null }>(
        `SELECT dbs_document_id, indemnity_document_id FROM public.doctors WHERE id = '${D}'`
      );
      expect(doctor.rows[0]).toEqual({ dbs_document_id: null, indemnity_document_id: null });
      const queued = await db.query<{ object_name: string }>(
        `SELECT object_name FROM public.retention_purge_objects`
      );
      expect(queued.rows.map((row) => row.object_name)).toContain("docs/diploma.pdf");
    });
  });

  it("holds every doctor document while a legal hold is open", async () => {
    await inTxn(async () => {
      await db.exec(people());
      await db.exec(`
        INSERT INTO public.doctor_documents (id, doctor_id, document_type, storage_path, file_name) VALUES
          ('${DIP}', '${D}', 'diploma', 'docs/diploma.pdf', 'diploma.pdf');
        UPDATE public.doctors SET left_at = '2018-06-01T12:00:00Z', indemnity_document_id = '${DIP}' WHERE id = '${D}';
        INSERT INTO public.legal_holds (subject_type, subject_id, reason_code)
        VALUES ('profile', '${DU}', 'litigation');
      `);
      await configure("2024-06-02T12:00:00Z");
      const result = await purge(false);
      expect(result.doctor_documents_deleted).toBe(0);
      expect(result.held_legal_hold).toBeGreaterThanOrEqual(1);
      expect(await documentCount()).toBe(1);
      const doctor = await db.query<{ indemnity_document_id: string | null }>(
        `SELECT indemnity_document_id FROM public.doctors WHERE id = '${D}'`
      );
      expect(doctor.rows[0].indemnity_document_id).toBe(DIP);
    });
  });

  it("nulls DBS record fields six years after left_at and leaves a newer leaver untouched", async () => {
    await inTxn(async () => {
      await db.exec(people());
      await db.exec(`
        UPDATE public.doctors SET
          left_at = '2018-06-01T12:00:00Z',
          dbs_certificate_number = 'DBS-1',
          dbs_level = 'enhanced_barred',
          dbs_issue_date = '2018-01-01',
          dbs_reupload_required = true
        WHERE id = '${D}';
        INSERT INTO public.doctor_approval_checklist (doctor_id, reviewer_id, dbs_check_verified, notes)
        VALUES ('${D}', '${DU}', true, 'reviewer note');
      `);
      await configure("2024-06-01T12:00:00Z");
      expect((await purge(false)).dbs_fields_scrubbed).toBe(0);
      await configure("2024-06-02T12:00:00Z");
      const dry = await purge(true);
      expect(dry.dbs_fields_scrubbed).toBe(1);
      expect(dry.dry_run).toBe(true);
      const applied = await purge(false);
      expect(applied.dbs_fields_scrubbed).toBe(1);
      expect(applied.doctor_regulatory_scrubbed).toBe(1);
      const doctor = await db.query<{
        dbs_certificate_number: string | null;
        dbs_level: string | null;
        dbs_issue_date: string | null;
        dbs_verified_at: string | null;
        dbs_verified_by: string | null;
        dbs_reupload_required: boolean;
      }>(`
        SELECT dbs_certificate_number,
               dbs_level,
               dbs_issue_date::text AS dbs_issue_date,
               dbs_verified_at::text AS dbs_verified_at,
               dbs_verified_by::text AS dbs_verified_by,
               dbs_reupload_required
        FROM public.doctors WHERE id = '${D}'
      `);
      expect(doctor.rows[0]).toEqual({
        dbs_certificate_number: null,
        dbs_level: null,
        dbs_issue_date: null,
        dbs_verified_at: null,
        dbs_verified_by: null,
        dbs_reupload_required: false,
      });
      const checklist = await db.query<{
        dbs_check_verified: boolean;
        dbs_check_verified_at: string | null;
        notes: string | null;
      }>(`
        SELECT dbs_check_verified,
               dbs_check_verified_at::text AS dbs_check_verified_at,
               notes
        FROM public.doctor_approval_checklist
      `);
      expect(checklist.rows[0]).toEqual({
        dbs_check_verified: false,
        dbs_check_verified_at: null,
        notes: null,
      });
      expect((await purge(false)).dbs_fields_scrubbed).toBe(0);
    });
  });

  it("keeps DBS record fields when left_at is inside six years", async () => {
    await inTxn(async () => {
      await db.exec(people());
      await db.exec(`
        UPDATE public.doctors SET
          left_at = '2025-06-01T12:00:00Z',
          dbs_certificate_number = 'DBS-1',
          dbs_level = 'standard',
          dbs_issue_date = '2025-01-01',
          dbs_verified_at = '2025-02-01T12:00:00Z',
          dbs_verified_by = '${DU}'
        WHERE id = '${D}';
      `);
      await configure("2026-06-02T12:00:00Z");
      const result = await purge(false);
      expect(result.dbs_fields_scrubbed).toBe(0);
      const doctor = await db.query<{ dbs_certificate_number: string; dbs_level: string }>(
        `SELECT dbs_certificate_number, dbs_level FROM public.doctors WHERE id = '${D}'`
      );
      expect(doctor.rows[0]).toEqual({ dbs_certificate_number: "DBS-1", dbs_level: "standard" });
    });
  });

  it("deletes a restricted zero-balance wallet with no transactions even when the financial year is unset", async () => {
    await inTxn(async () => {
      await db.exec(people());
      await db.exec(`
        UPDATE public.profiles SET restricted_at = '2024-01-01T00:00:00Z' WHERE id = '${P}';
        INSERT INTO public.patient_wallet (id, patient_id, currency, balance_cents)
        VALUES ('${W}', '${P}', 'gbp', 0);
        INSERT INTO public.patient_points (patient_id, available_points, lifetime_points)
        VALUES ('${P}', 10, 10);
      `);
      await configure("2026-01-02T12:00:00Z", "apply", null);
      const result = await purge(false);
      expect(result.wallets_deleted_restricted).toBe(1);
      expect(result.wallets_deleted).toBe(1);
      expect(result.held_no_fy_end).toBe(0);
      expect(result.points_deleted).toBe(0);
      expect((await db.query(`SELECT id FROM public.patient_wallet`)).rows).toHaveLength(0);
      expect((await db.query(`SELECT patient_id FROM public.patient_points`)).rows).toHaveLength(1);
      const run = await db.query<{ counts: Counts }>(
        `SELECT counts FROM public.retention_purge_runs ORDER BY started_at DESC LIMIT 1`
      );
      expect(run.rows[0].counts.wallets_deleted_restricted).toBe(1);
    });
  });

  it("holds a zero-transaction wallet that still has a balance", async () => {
    await inTxn(async () => {
      await db.exec(people());
      await db.exec(`
        UPDATE public.profiles SET restricted_at = '2024-01-01T00:00:00Z' WHERE id = '${P}';
        INSERT INTO public.patient_wallet (id, patient_id, currency, balance_cents)
        VALUES ('${W}', '${P}', 'gbp', 250);
      `);
      await configure("2026-01-02T12:00:00Z", "apply", null);
      const result = await purge(false);
      expect(result.held_wallet_balance).toBe(1);
      expect(result.wallets_deleted_restricted).toBe(0);
      expect(result.wallets_deleted).toBe(0);
      expect((await db.query(`SELECT id FROM public.patient_wallet`)).rows).toHaveLength(1);
    });
  });

  it("leaves an unrestricted empty wallet with no transactions in place", async () => {
    await inTxn(async () => {
      await db.exec(people());
      await db.exec(`
        INSERT INTO public.patient_wallet (id, patient_id, currency, balance_cents)
        VALUES ('${W}', '${P}', 'gbp', 0);
      `);
      await configure("2026-01-02T12:00:00Z", "apply", null);
      const result = await purge(false);
      expect(result.wallets_deleted).toBe(0);
      expect(result.wallets_deleted_restricted).toBe(0);
      expect(result.held_wallet_balance).toBe(0);
      expect((await db.query(`SELECT id FROM public.patient_wallet`)).rows).toHaveLength(1);
    });
  });

  it("holds a restricted empty wallet while an active gift card is unredeemed", async () => {
    await inTxn(async () => {
      await db.exec(people());
      await db.exec(`
        CREATE TABLE public.gift_cards (
          id uuid PRIMARY KEY,
          purchased_by uuid,
          status text NOT NULL,
          redeemed_at timestamptz
        );
        INSERT INTO public.gift_cards (id, purchased_by, status, redeemed_at)
        VALUES ('${GC}', '${P}', 'active', NULL);
        UPDATE public.profiles SET restricted_at = '2024-01-01T00:00:00Z' WHERE id = '${P}';
        INSERT INTO public.patient_wallet (id, patient_id, currency, balance_cents)
        VALUES ('${W}', '${P}', 'gbp', 0);
      `);
      await configure("2026-01-02T12:00:00Z", "apply", null);
      const result = await purge(false);
      expect(result.held_pending_credit).toBe(1);
      expect(result.wallets_deleted_restricted).toBe(0);
      expect((await db.query(`SELECT id FROM public.patient_wallet`)).rows).toHaveLength(1);
    });
  });

  it("deletes a restricted empty wallet after the gift card is redeemed", async () => {
    await inTxn(async () => {
      await db.exec(people());
      await db.exec(`
        CREATE TABLE public.gift_cards (
          id uuid PRIMARY KEY,
          purchased_by uuid,
          status text NOT NULL,
          redeemed_at timestamptz
        );
        INSERT INTO public.gift_cards (id, purchased_by, status, redeemed_at)
        VALUES ('${GC}', '${P}', 'redeemed', '2025-01-01T00:00:00Z');
        UPDATE public.profiles SET restricted_at = '2024-01-01T00:00:00Z' WHERE id = '${P}';
        INSERT INTO public.patient_wallet (id, patient_id, currency, balance_cents)
        VALUES ('${W}', '${P}', 'gbp', 0);
      `);
      await configure("2026-01-02T12:00:00Z", "apply", null);
      const result = await purge(false);
      expect(result.held_pending_credit).toBe(0);
      expect(result.wallets_deleted_restricted).toBe(1);
      expect((await db.query(`SELECT id FROM public.patient_wallet`)).rows).toHaveLength(0);
    });
  });

  it("holds a restricted empty wallet under a legal hold", async () => {
    await inTxn(async () => {
      await db.exec(people());
      await db.exec(`
        UPDATE public.profiles SET restricted_at = '2024-01-01T00:00:00Z' WHERE id = '${P}';
        INSERT INTO public.patient_wallet (id, patient_id, currency, balance_cents)
        VALUES ('${W}', '${P}', 'gbp', 0);
        INSERT INTO public.legal_holds (subject_type, subject_id, reason_code)
        VALUES ('profile', '${P}', 'complaint');
      `);
      await configure("2026-01-02T12:00:00Z", "apply", null);
      const result = await purge(false);
      expect(result.held_legal_hold).toBeGreaterThanOrEqual(1);
      expect(result.wallets_deleted_restricted).toBe(0);
      expect((await db.query(`SELECT id FROM public.patient_wallet`)).rows).toHaveLength(1);
    });
  });

  it("still deletes a wallet with transactions on the six-year activity clock", async () => {
    await inTxn(async () => {
      await db.exec(people());
      await db.exec(`
        UPDATE public.profiles SET restricted_at = '2024-01-01T00:00:00Z' WHERE id = '${P}';
        INSERT INTO public.patient_wallet (id, patient_id, currency, balance_cents)
        VALUES ('${W}', '${P}', 'gbp', 0);
        INSERT INTO public.wallet_transactions (id, patient_id, currency, amount_cents, created_at)
        VALUES ('${GC}', '${P}', 'gbp', 0, '2010-01-01T12:00:00Z');
      `);
      await configure("2026-04-01T12:00:00Z");
      const result = await purge(false);
      expect(result.wallets_deleted).toBe(1);
      expect(result.wallets_deleted_restricted).toBe(0);
      expect(result.wallet_transactions_deleted).toBe(1);
      expect((await db.query(`SELECT id FROM public.patient_wallet`)).rows).toHaveLength(0);
    });
  });

  it("holds an unpaid-to-the-wallet correction and deletes the wallet once it is settled", async () => {
    await inTxn(async () => {
      await db.exec(people());
      await db.exec(`
        ALTER TABLE public.payment_corrections
          ADD COLUMN error_type text,
          ADD COLUMN party text,
          ADD COLUMN direction text,
          ADD COLUMN recovery_method text,
          ADD COLUMN settled_at timestamptz;
        INSERT INTO public.payment_corrections (
          id, patient_id, status, reason, statement_line, amount_cents, created_by,
          error_type, party, direction
        ) VALUES (
          '${CORR}', '${P}', 'approved', 'refund to credit', 'line', 500, '${DU}',
          'patient_credit_in_error', 'patient', 'customer_favour'
        );
        UPDATE public.profiles SET restricted_at = '2024-01-01T00:00:00Z' WHERE id = '${P}';
        INSERT INTO public.patient_wallet (id, patient_id, currency, balance_cents)
        VALUES ('${W}', '${P}', 'gbp', 0);
      `);
      await configure("2026-01-02T12:00:00Z", "apply", null);
      const held = await purge(false);
      expect(held.held_pending_credit).toBe(1);
      expect(held.wallets_deleted_restricted).toBe(0);
      expect((await db.query(`SELECT id FROM public.patient_wallet`)).rows).toHaveLength(1);
      await db.exec(`
        UPDATE public.payment_corrections
        SET status = 'settled', settled_at = '2025-06-01T00:00:00Z'
        WHERE id = '${CORR}';
      `);
      const settled = await purge(false);
      expect(settled.held_pending_credit).toBe(0);
      expect(settled.wallets_deleted_restricted).toBe(1);
      expect((await db.query(`SELECT id FROM public.patient_wallet`)).rows).toHaveLength(0);
    });
  });

  it("holds a customer-favour wallet_adjustment that has not settled", async () => {
    await inTxn(async () => {
      await db.exec(people());
      await db.exec(`
        ALTER TABLE public.payment_corrections
          ADD COLUMN error_type text,
          ADD COLUMN party text,
          ADD COLUMN direction text,
          ADD COLUMN recovery_method text,
          ADD COLUMN settled_at timestamptz;
        INSERT INTO public.payment_corrections (
          id, patient_id, status, reason, statement_line, amount_cents, created_by,
          error_type, party, direction, recovery_method
        ) VALUES (
          '${CORR}', '${P}', 'recovering', 'wallet credit', 'line', 500, '${DU}',
          'other', 'patient', 'customer_favour', 'wallet_adjustment'
        );
        UPDATE public.profiles SET restricted_at = '2024-01-01T00:00:00Z' WHERE id = '${P}';
        INSERT INTO public.patient_wallet (id, patient_id, currency, balance_cents)
        VALUES ('${W}', '${P}', 'gbp', 0);
      `);
      await configure("2026-01-02T12:00:00Z", "apply", null);
      const result = await purge(false);
      expect(result.held_pending_credit).toBe(1);
      expect((await db.query(`SELECT id FROM public.patient_wallet`)).rows).toHaveLength(1);
    });
  });

  it("does not treat a card refund, an unpaid gift card, or a doctor payout as a pending wallet credit", async () => {
    await inTxn(async () => {
      await db.exec(people());
      await db.exec(`
        ALTER TABLE public.payment_corrections
          ADD COLUMN error_type text,
          ADD COLUMN party text,
          ADD COLUMN direction text,
          ADD COLUMN recovery_method text,
          ADD COLUMN settled_at timestamptz;
        INSERT INTO public.payment_corrections (
          id, patient_id, status, reason, statement_line, amount_cents, created_by,
          error_type, party, direction, recovery_method
        ) VALUES (
          '${CORR}', '${P}', 'approved', 'card refund', 'line', 500, '${DU}',
          'patient_overcharge', 'patient', 'customer_favour', 'patient_refund'
        );
        CREATE TABLE public.gift_cards (
          id uuid PRIMARY KEY,
          purchased_by uuid,
          status text NOT NULL,
          redeemed_at timestamptz
        );
        INSERT INTO public.gift_cards (id, purchased_by, status, redeemed_at)
        VALUES ('${GC}', '${P}', 'pending', NULL);
        CREATE TABLE public.doctor_wallet_credit_transfers (
          id uuid PRIMARY KEY,
          doctor_id uuid,
          status text NOT NULL
        );
        INSERT INTO public.doctor_wallet_credit_transfers (id, doctor_id, status)
        VALUES ('${DOC}', '${D}', 'pending');
        UPDATE public.profiles SET restricted_at = '2024-01-01T00:00:00Z' WHERE id = '${P}';
        INSERT INTO public.patient_wallet (id, patient_id, currency, balance_cents)
        VALUES ('${W}', '${P}', 'gbp', 0);
      `);
      await configure("2026-01-02T12:00:00Z", "apply", null);
      const result = await purge(false);
      expect(result.held_pending_credit).toBe(0);
      expect(result.wallets_deleted_restricted).toBe(1);
      expect((await db.query(`SELECT id FROM public.patient_wallet`)).rows).toHaveLength(0);
    });
  });

  it("keeps the dispute release after this migration replaces the purge", async () => {
    await inTxn(async () => {
      await db.exec(people());
      await db.exec(`
        UPDATE public.profiles SET restricted_at = '2024-01-01T00:00:00Z' WHERE id = '${P}';
        INSERT INTO public.bookings (
          id, patient_id, doctor_id, status, paid_at, stripe_dispute_status
        ) VALUES (
          '${B}', '${P}', '${D}', 'confirmed', '2018-01-15T12:00:00Z', 'under_review'
        );
      `);
      await configure("2026-04-02T12:00:00Z");
      const open = await purge(false);
      expect(open.held_open_dispute).toBe(1);
      expect(open.bookings_deleted).toBe(0);
      await db.exec(`
        UPDATE public.bookings
        SET stripe_dispute_status = 'won', stripe_dispute_closed_at = NULL
        WHERE id = '${B}';
      `);
      const closed = await purge(false);
      expect(closed.held_open_dispute).toBe(0);
      expect(closed.bookings_deleted).toBe(1);
    });
  });

  it("does not grant the DBS trigger or the purge to anon", async () => {
    await inTxn(async () => {
      await db.exec(`SET LOCAL ROLE anon`);
      await expect(db.query(`SELECT public.record_dbs_checklist_verified()`)).rejects.toThrow(/permission denied/i);
    });
    await inTxn(async () => {
      await db.exec(`SET LOCAL ROLE authenticated`);
      await expect(db.query(`SELECT public.purge_expired_retention(true, 1)`)).rejects.toThrow(/permission denied/i);
    });
  });
});
