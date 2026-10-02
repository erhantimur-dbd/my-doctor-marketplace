import { readFileSync } from "node:fs";
import { join } from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const PATIENT = "11111111-1111-4111-8111-111111111111";
const DOCTOR_USER = "22222222-2222-4222-8222-222222222222";
const DOCTOR_ROW = "33333333-3333-4333-8333-333333333333";
const RX = "44444444-4444-4444-8444-444444444444";
const AUDIT = "55555555-5555-4555-8555-555555555555";
const CLEAN = "66666666-6666-4666-8666-666666666666";
const REVIEWER = "77777777-7777-4777-8777-777777777777";
const CLINICAL = "88888888-8888-4888-8888-888888888888";
const SHARED = "99999999-9999-4999-8999-999999999999";
const DISPUTE = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const STRIPE_DISPUTE = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";

const SCHEMA = `
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

CREATE TABLE auth.users (
  id uuid PRIMARY KEY,
  email text UNIQUE,
  phone text,
  banned_until timestamptz,
  raw_user_meta_data jsonb,
  updated_at timestamptz
);

CREATE TABLE auth.identities (
  id uuid PRIMARY KEY,
  user_id uuid NOT NULL,
  provider text NOT NULL,
  provider_id text NOT NULL,
  email text,
  identity_data jsonb
);

CREATE TABLE auth.sessions (
  id uuid PRIMARY KEY,
  user_id uuid NOT NULL
);

CREATE TABLE auth.refresh_tokens (
  id uuid PRIMARY KEY,
  user_id text NOT NULL
);

CREATE TABLE public.profiles (
  id uuid PRIMARY KEY,
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
  profile_id uuid NOT NULL UNIQUE,
  slug text NOT NULL UNIQUE,
  bio text,
  address text,
  city text,
  postal_code text,
  clinic_name text,
  clinic_latitude numeric,
  clinic_longitude numeric,
  education jsonb,
  certifications jsonb,
  meta_title text,
  meta_description text,
  profile_video_path text,
  profile_video_status text,
  profile_video_uploaded_at timestamptz,
  profile_video_reviewed_at timestamptz,
  profile_video_rejection_reason text,
  gender text,
  is_active boolean NOT NULL DEFAULT true,
  is_featured boolean NOT NULL DEFAULT false,
  featured_until timestamptz,
  verification_status text NOT NULL DEFAULT 'pending',
  referral_code text NOT NULL UNIQUE,
  ics_feed_token text UNIQUE,
  gmc_number text,
  stripe_account_id text
);

CREATE TABLE public.doctor_photos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  doctor_id uuid NOT NULL,
  storage_path text NOT NULL
);

CREATE TABLE public.doctor_faqs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  doctor_id uuid NOT NULL,
  question text NOT NULL,
  answer text NOT NULL
);

CREATE TABLE public.doctor_calendar_connections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  doctor_id uuid NOT NULL,
  access_token text NOT NULL,
  refresh_token text NOT NULL
);

CREATE TABLE public.doctor_testing_locations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  doctor_id uuid NOT NULL,
  name text NOT NULL,
  address text NOT NULL,
  city text NOT NULL,
  postal_code text,
  phone text,
  latitude numeric,
  longitude numeric,
  is_active boolean NOT NULL DEFAULT true
);

CREATE TABLE public.dependents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  parent_id uuid NOT NULL,
  first_name text NOT NULL,
  last_name text NOT NULL,
  date_of_birth date,
  notes text
);

CREATE TABLE public.dependent_medical_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  dependent_id uuid NOT NULL,
  blood_type text,
  allergies text[] DEFAULT '{}',
  chronic_conditions text[] DEFAULT '{}',
  current_medications text[] DEFAULT '{}',
  emergency_contact_name text,
  emergency_contact_phone text,
  notes text,
  sharing_consent boolean NOT NULL DEFAULT false
);

CREATE TABLE public.medical_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id uuid NOT NULL,
  blood_type text,
  allergies text[] DEFAULT '{}',
  chronic_conditions text[] DEFAULT '{}',
  current_medications text[] DEFAULT '{}',
  emergency_contact_name text,
  emergency_contact_phone text,
  notes text,
  sharing_consent boolean NOT NULL DEFAULT false
);

CREATE TABLE public.bookings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id uuid NOT NULL,
  doctor_id uuid NOT NULL,
  dependent_id uuid,
  status text NOT NULL,
  patient_notes text,
  stripe_dispute_status text
);

CREATE TABLE public.reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id uuid NOT NULL,
  patient_id uuid NOT NULL,
  doctor_id uuid NOT NULL,
  rating int NOT NULL,
  title text,
  comment text,
  doctor_response text
);

CREATE TABLE public.payment_corrections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id uuid,
  patient_id uuid,
  disputed_at timestamptz,
  dispute_resolved_at timestamptz,
  status text
);

CREATE TABLE public.availability_alerts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id uuid,
  doctor_id uuid NOT NULL,
  guest_email text
);

CREATE TABLE public.specialty_waitlist (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  specialty_slug text NOT NULL,
  patient_id uuid,
  guest_email text
);

CREATE TABLE public.doctor_waitlist (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL
);

CREATE TABLE public.launch_notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL
);

CREATE TABLE public.prescriptions (
  id uuid PRIMARY KEY,
  doctor_id uuid NOT NULL,
  patient_id uuid NOT NULL,
  diagnosis text,
  notes text
);

CREATE TABLE public.prescription_audit_log (
  id uuid PRIMARY KEY,
  prescription_id uuid NOT NULL,
  event_type text NOT NULL,
  actor_profile_id uuid NOT NULL,
  snapshot jsonb NOT NULL
);

CREATE TABLE public.push_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL
);

CREATE TABLE public.cookie_consents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid
);

ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public.doctors
  ADD CONSTRAINT doctors_profile_fkey FOREIGN KEY (profile_id) REFERENCES public.profiles(id) ON DELETE CASCADE;
ALTER TABLE public.prescriptions
  ADD CONSTRAINT prescriptions_patient_fkey FOREIGN KEY (patient_id) REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public.prescriptions
  ADD CONSTRAINT prescriptions_doctor_fkey FOREIGN KEY (doctor_id) REFERENCES public.doctors(id) ON DELETE CASCADE;
ALTER TABLE public.prescription_audit_log
  ADD CONSTRAINT audit_rx_fkey FOREIGN KEY (prescription_id) REFERENCES public.prescriptions(id) ON DELETE RESTRICT;
ALTER TABLE public.prescription_audit_log
  ADD CONSTRAINT audit_actor_fkey FOREIGN KEY (actor_profile_id) REFERENCES public.profiles(id);
ALTER TABLE public.bookings
  ADD CONSTRAINT bookings_patient_fkey FOREIGN KEY (patient_id) REFERENCES public.profiles(id);
ALTER TABLE public.bookings
  ADD CONSTRAINT bookings_doctor_fkey FOREIGN KEY (doctor_id) REFERENCES public.doctors(id);
ALTER TABLE public.reviews
  ADD CONSTRAINT reviews_patient_fkey FOREIGN KEY (patient_id) REFERENCES public.profiles(id);
ALTER TABLE public.reviews
  ADD CONSTRAINT reviews_doctor_fkey FOREIGN KEY (doctor_id) REFERENCES public.doctors(id);
ALTER TABLE public.medical_profiles
  ADD CONSTRAINT medical_profiles_patient_fkey FOREIGN KEY (patient_id) REFERENCES public.profiles(id) ON DELETE CASCADE;
ALTER TABLE public.dependents
  ADD CONSTRAINT dependents_parent_fkey FOREIGN KEY (parent_id) REFERENCES public.profiles(id) ON DELETE CASCADE;
ALTER TABLE public.dependent_medical_profiles
  ADD CONSTRAINT dependent_medical_fkey FOREIGN KEY (dependent_id) REFERENCES public.dependents(id) ON DELETE CASCADE;

CREATE OR REPLACE FUNCTION public.prescription_audit_log_deny_mutation()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'prescription_audit_log is append-only; % is not permitted', TG_OP;
END;
$$;

CREATE TRIGGER prescription_audit_log_block_delete
  BEFORE DELETE ON public.prescription_audit_log
  FOR EACH ROW EXECUTE FUNCTION public.prescription_audit_log_deny_mutation();

CREATE OR REPLACE FUNCTION public.prevent_doctor_privileged_column_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF (SELECT auth.role()) = 'service_role'
     OR (SELECT auth.uid()) IS NULL THEN
    RETURN NEW;
  END IF;
  IF NEW.verification_status IS DISTINCT FROM OLD.verification_status
     OR NEW.is_featured IS DISTINCT FROM OLD.is_featured THEN
    RAISE EXCEPTION 'Cannot modify privileged doctor columns';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_lock_doctor_privileged_columns
  BEFORE UPDATE ON public.doctors
  FOR EACH ROW EXECUTE FUNCTION public.prevent_doctor_privileged_column_update();
`;

type ModeRow = { mode: string; email: string | null; restricted_at: string | null };

describe("erase_account keeps audited prescriptions", () => {
  let db: PGlite;

  beforeAll(async () => {
    db = new PGlite();
    await db.exec(SCHEMA);
    await db.exec(readFileSync(join(process.cwd(), "supabase/migrations/00135_account_erasure.sql"), "utf8"));
    await db.exec(readFileSync(join(process.cwd(), "supabase/migrations/00142_retention_subjects.sql"), "utf8"));
    await db.exec(`
      SELECT set_config('request.jwt.claim.role', 'service_role', false);
      SELECT set_config('request.jwt.claim.sub', '', false);
    `);

    await db.exec(`
      INSERT INTO auth.users (id, email, phone, raw_user_meta_data)
      VALUES
        ('${PATIENT}', 'pip.patient@example.com', '+447700900001', '{"role":"patient","first_name":"Pip","last_name":"Patient"}'),
        ('${DOCTOR_USER}', 'pip.doctor@example.com', '+447700900002', '{"role":"doctor","first_name":"Pip","last_name":"Doctor"}'),
        ('${CLEAN}', 'pip.clean@example.com', '+447700900003', '{"role":"patient","first_name":"Clean","last_name":"User"}'),
        ('${REVIEWER}', 'pip.reviewer@example.com', '+447700900004', '{"role":"patient","first_name":"Rita","last_name":"Reviewer"}'),
        ('${CLINICAL}', 'pip.clinical@example.com', '+447700900005', '{"role":"patient","first_name":"Cara","last_name":"Clinical"}'),
        ('${SHARED}', 'pip.shared@example.com', '+447700900006', '{"role":"patient","first_name":"Sam","last_name":"Shared"}'),
        ('${DISPUTE}', 'pip.dispute@example.com', '+447700900007', '{"role":"patient","first_name":"Dee","last_name":"Dispute"}'),
        ('${STRIPE_DISPUTE}', 'pip.stripe@example.com', '+447700900008', '{"role":"patient","first_name":"Sid","last_name":"Stripe"}');

      INSERT INTO public.profiles (
        id, role, first_name, last_name, email, phone, avatar_url,
        address_line1, city, postal_code, country, date_of_birth
      ) VALUES
        ('${PATIENT}', 'patient', 'Pip', 'Patient', 'pip.patient@example.com', '+447700900001', 'https://cdn.example/pip.jpg', '1 Secret Street', 'London', 'SW1A 1AA', 'GB', '1990-04-05'),
        ('${DOCTOR_USER}', 'doctor', 'Pip', 'Doctor', 'pip.doctor@example.com', '+447700900002', 'https://cdn.example/dr.jpg', '2 Clinic Road', 'Manchester', 'M1 1AE', 'GB', '1980-01-01'),
        ('${CLEAN}', 'patient', 'Clean', 'User', 'pip.clean@example.com', '+447700900003', 'https://cdn.example/clean.jpg', '3 Plain Road', 'Leeds', 'LS1 1AA', 'GB', NULL),
        ('${REVIEWER}', 'patient', 'Rita', 'Reviewer', 'pip.reviewer@example.com', '+447700900004', NULL, '4 Review Road', 'Bristol', 'BS1 1AA', 'GB', '1992-02-02'),
        ('${CLINICAL}', 'patient', 'Cara', 'Clinical', 'pip.clinical@example.com', '+447700900005', NULL, '5 Clinic Road', 'Oxford', 'OX1 1AA', 'GB', '1985-05-05'),
        ('${SHARED}', 'patient', 'Sam', 'Shared', 'pip.shared@example.com', '+447700900006', NULL, '6 Share Road', 'Bath', 'BA1 1AA', 'GB', '1991-01-01'),
        ('${DISPUTE}', 'patient', 'Dee', 'Dispute', 'pip.dispute@example.com', '+447700900007', NULL, '7 Dispute Road', 'York', 'YO1 1AA', 'GB', NULL),
        ('${STRIPE_DISPUTE}', 'patient', 'Sid', 'Stripe', 'pip.stripe@example.com', '+447700900008', NULL, '8 Stripe Road', 'York', 'YO1 2AA', 'GB', NULL);

      INSERT INTO public.doctors (
        id, profile_id, slug, bio, address, city, postal_code, clinic_name,
        clinic_latitude, clinic_longitude, education, certifications,
        meta_title, meta_description,
        profile_video_path, profile_video_status, profile_video_uploaded_at,
        profile_video_reviewed_at, profile_video_rejection_reason, gender,
        is_active, is_featured, verification_status, referral_code, ics_feed_token,
        gmc_number, stripe_account_id
      ) VALUES (
        '${DOCTOR_ROW}', '${DOCTOR_USER}', 'dr-pip', 'Secret biography', '2 Clinic Road',
        'Manchester', 'M1 1AE', 'Secret Clinic', 53.48, -2.24,
        '[{"institution":"Secret College"}]'::jsonb, '[{"name":"Secret Cert"}]'::jsonb,
        'Dr Pip', 'A secret description', 'videos/secret.mp4', 'pending', now(), now(), 'too blurry', 'female',
        true, true, 'verified', 'PIPDOCTOR', 'ics-secret-token',
        '7654321', 'acct_secret'
      );

      INSERT INTO public.doctor_photos (doctor_id, storage_path)
      VALUES ('${DOCTOR_ROW}', 'public/doctor-photos/secret.jpg');
      INSERT INTO public.doctor_faqs (doctor_id, question, answer)
      VALUES ('${DOCTOR_ROW}', 'Where do you live?', 'A secret address');
      INSERT INTO public.doctor_calendar_connections (doctor_id, access_token, refresh_token)
      VALUES ('${DOCTOR_ROW}', 'access-secret', 'refresh-secret');
      INSERT INTO public.doctor_testing_locations (doctor_id, name, address, city, postal_code, phone, latitude, longitude)
      VALUES ('${DOCTOR_ROW}', 'Secret Lab', '9 Hidden Lane', 'York', 'YO1 1AA', '+447700900010', 53.9, -1.0);

      INSERT INTO public.dependents (parent_id, first_name, last_name, date_of_birth, notes)
      VALUES ('${PATIENT}', 'Ada', 'Patient', '2018-06-01', 'child note');
      INSERT INTO public.dependent_medical_profiles (
        dependent_id, emergency_contact_name, emergency_contact_phone, notes, blood_type, sharing_consent
      )
      SELECT id, 'Gran Secret', '+447700900011', 'dependent note', 'A+', true
      FROM public.dependents WHERE parent_id = '${PATIENT}';
      INSERT INTO public.medical_profiles (
        patient_id, emergency_contact_name, emergency_contact_phone, notes, blood_type, allergies, sharing_consent
      ) VALUES
        ('${PATIENT}', 'Mum Secret', '+447700900012', 'private note', 'O+', ARRAY['peanuts'], true),
        ('${REVIEWER}', 'Review Contact', '+447700900014', 'unshared note', 'B+', ARRAY['dust'], false),
        ('${CLINICAL}', 'Nurse Secret', '+447700900013', 'keep-clinical-note', 'AB+', ARRAY['latex'], false),
        ('${SHARED}', 'Share Contact', '+447700900015', 'shared-clinical-note', 'A-', ARRAY['none'], true);

      INSERT INTO public.bookings (patient_id, doctor_id, dependent_id, status, patient_notes)
      VALUES (
        '${PATIENT}', '${DOCTOR_ROW}',
        (SELECT id FROM public.dependents WHERE parent_id = '${PATIENT}' LIMIT 1),
        'completed', 'secret patient note'
      );
      INSERT INTO public.bookings (patient_id, doctor_id, status, patient_notes)
      VALUES
        ('${REVIEWER}', '${DOCTOR_ROW}', 'completed', NULL),
        ('${SHARED}', '${DOCTOR_ROW}', 'completed', NULL),
        ('${DISPUTE}', '${DOCTOR_ROW}', 'completed', NULL),
        ('${STRIPE_DISPUTE}', '${DOCTOR_ROW}', 'completed', NULL);
      UPDATE public.bookings
      SET stripe_dispute_status = 'needs_response'
      WHERE patient_id = '${STRIPE_DISPUTE}';
      INSERT INTO public.reviews (booking_id, patient_id, doctor_id, rating, title, comment)
      SELECT id, patient_id, '${DOCTOR_ROW}', 5, 'Review title',
        CASE patient_id::text
          WHEN '${REVIEWER}' THEN 'keep-this-review'
          WHEN '${DISPUTE}' THEN 'keep-under-dispute'
          WHEN '${STRIPE_DISPUTE}' THEN 'keep-under-stripe'
          ELSE 'other'
        END
      FROM public.bookings
      WHERE patient_id IN ('${REVIEWER}', '${DISPUTE}', '${STRIPE_DISPUTE}');
      INSERT INTO public.payment_corrections (booking_id, patient_id, disputed_at, status)
      SELECT id, '${DISPUTE}', now(), 'disputed'
      FROM public.bookings WHERE patient_id = '${DISPUTE}';

      INSERT INTO public.prescriptions (id, doctor_id, patient_id, diagnosis, notes)
      VALUES ('${RX}', '${DOCTOR_ROW}', '${PATIENT}', 'keep-this-diagnosis', 'clinical note');
      INSERT INTO public.prescription_audit_log (id, prescription_id, event_type, actor_profile_id, snapshot)
      VALUES ('${AUDIT}', '${RX}', 'issued', '${DOCTOR_USER}', '{"marker":"keep-audit"}'::jsonb);

      INSERT INTO public.push_subscriptions (user_id) VALUES ('${PATIENT}'), ('${DOCTOR_USER}'), ('${CLEAN}');
      INSERT INTO public.cookie_consents (user_id) VALUES ('${PATIENT}'), ('${CLEAN}');
      INSERT INTO public.availability_alerts (patient_id, doctor_id, guest_email)
      VALUES
        ('${PATIENT}', '${DOCTOR_ROW}', NULL),
        ('${CLEAN}', '${DOCTOR_ROW}', NULL),
        (NULL, '${DOCTOR_ROW}', 'pip.patient@example.com');
      INSERT INTO public.specialty_waitlist (specialty_slug, patient_id, guest_email)
      VALUES ('dermatology', '${PATIENT}', NULL), ('cardiology', NULL, 'pip.patient@example.com');
      INSERT INTO public.doctor_waitlist (email) VALUES ('pip.doctor@example.com');
      INSERT INTO public.launch_notifications (email) VALUES ('pip.patient@example.com');

      INSERT INTO auth.identities (id, user_id, provider, provider_id, email, identity_data)
      VALUES
        ('${PATIENT}', '${PATIENT}', 'email', 'pip.patient@example.com', 'pip.patient@example.com', '{"email":"pip.patient@example.com"}'),
        ('${DOCTOR_USER}', '${DOCTOR_USER}', 'email', 'pip.doctor@example.com', 'pip.doctor@example.com', '{"email":"pip.doctor@example.com"}');
      INSERT INTO auth.sessions (id, user_id)
      VALUES ('${PATIENT}', '${PATIENT}'), ('${DOCTOR_USER}', '${DOCTOR_USER}'), ('${CLEAN}', '${CLEAN}');
      INSERT INTO auth.refresh_tokens (id, user_id)
      VALUES ('${PATIENT}', '${PATIENT}'), ('${DOCTOR_USER}', '${DOCTOR_USER}'), ('${CLEAN}', '${CLEAN}');
      INSERT INTO auth.identities (id, user_id, provider, provider_id, email, identity_data)
      VALUES ('${CLEAN}', '${CLEAN}', 'email', 'pip.clean@example.com', 'pip.clean@example.com', '{"email":"pip.clean@example.com"}');
    `);
  }, 120000);

  afterAll(async () => {
    await db?.close();
  });

  async function deleteUser(id: string): Promise<string | null> {
    try {
      await db.query("DELETE FROM auth.users WHERE id = $1", [id]);
      return null;
    } catch (err) {
      return err instanceof Error ? err.message : String(err);
    }
  }

  it("rejects deleting the patient and the prescribing doctor while the audit row exists", async () => {
    const patient = await deleteUser(PATIENT);
    const doctor = await deleteUser(DOCTOR_USER);
    expect(patient).toMatch(/23503|foreign key/i);
    expect(doctor).toMatch(/23503|foreign key/i);
  });

  it("restricts the patient and keeps the prescription and audit row", async () => {
    const result = await db.query<ModeRow>(
      `SELECT result->>'mode' AS mode, result->>'email' AS email, result->>'restricted_at' AS restricted_at
       FROM (SELECT public.erase_account($1::uuid) AS result) AS erased`,
      [PATIENT]
    );
    expect(result.rows[0]?.mode).toBe("restricted");

    const profile = await db.query<Record<string, string | null>>(
      `SELECT first_name, last_name, email, phone, avatar_url, address_line1, city, postal_code, country,
              date_of_birth::text AS date_of_birth, restricted_at::text AS restricted_at
       FROM public.profiles WHERE id = $1`,
      [PATIENT]
    );
    const row = profile.rows[0];
    expect(row?.first_name).toBe("");
    expect(row?.last_name).toBe("");
    expect(row?.email).toBe(`erased+${PATIENT}@users.invalid`);
    expect(row?.phone).toBeNull();
    expect(row?.avatar_url).toBeNull();
    expect(row?.address_line1).toBeNull();
    expect(row?.city).toBeNull();
    expect(row?.postal_code).toBeNull();
    expect(row?.country).toBeNull();
    expect(row?.date_of_birth).toBeNull();
    expect(row?.restricted_at).toBeTruthy();
    expect(JSON.stringify(row)).not.toMatch(/Pip|Secret|London|pip\.patient/);

    const auth = await db.query<{ email: string; phone: string | null; banned_until: string | null }>(
      "SELECT email, phone, banned_until::text AS banned_until FROM auth.users WHERE id = $1",
      [PATIENT]
    );
    expect(auth.rows[0]?.email).toBe(`erased+${PATIENT}@users.invalid`);
    expect(auth.rows[0]?.phone).toBeNull();
    expect(auth.rows[0]?.banned_until).toBeTruthy();

    const identity = await db.query<{ count: string }>(
      "SELECT count(*)::text AS count FROM auth.identities WHERE user_id = $1",
      [PATIENT]
    );
    expect(identity.rows[0]?.count).toBe("0");

    const sessions = await db.query<{ count: string }>(
      "SELECT count(*)::text AS count FROM auth.sessions WHERE user_id = $1",
      [PATIENT]
    );
    expect(sessions.rows[0]?.count).toBe("0");

    const rx = await db.query<{ id: string; patient_id: string; doctor_id: string; diagnosis: string }>(
      "SELECT id::text, patient_id::text, doctor_id::text, diagnosis FROM public.prescriptions WHERE id = $1",
      [RX]
    );
    expect(rx.rows[0]).toMatchObject({
      id: RX,
      patient_id: PATIENT,
      doctor_id: DOCTOR_ROW,
      diagnosis: "keep-this-diagnosis",
    });

    const audit = await db.query<{ id: string; actor: string; snapshot: { marker: string } }>(
      "SELECT id::text, actor_profile_id::text AS actor, snapshot FROM public.prescription_audit_log WHERE id = $1",
      [AUDIT]
    );
    expect(audit.rows[0]?.id).toBe(AUDIT);
    expect(audit.rows[0]?.actor).toBe(DOCTOR_USER);
    expect(audit.rows[0]?.snapshot.marker).toBe("keep-audit");

    const notes = await db.query<{ patient_notes: string | null }>(
      "SELECT patient_notes FROM public.bookings WHERE patient_id = $1",
      [PATIENT]
    );
    expect(notes.rows[0]?.patient_notes).toBeNull();

    const dependent = await db.query<{ first_name: string; date_of_birth: string | null; notes: string | null }>(
      "SELECT first_name, date_of_birth::text, notes FROM public.dependents WHERE parent_id = $1",
      [PATIENT]
    );
    expect(dependent.rows[0]?.first_name).toBe("");
    expect(dependent.rows[0]?.date_of_birth).toBeNull();
    expect(dependent.rows[0]?.notes).toBeNull();

    const captured = await db.query<{ subject_type: string; date_of_birth: string }>(
      `SELECT subject_type, date_of_birth::text AS date_of_birth
       FROM public.retention_subjects
       WHERE subject_id = $1
          OR subject_id IN (SELECT id FROM public.dependents WHERE parent_id = $1)
       ORDER BY subject_type`,
      [PATIENT]
    );
    expect(captured.rows).toEqual([
      { subject_type: "dependent", date_of_birth: "2018-06-01" },
    ]);

    const medical = await db.query<{
      emergency_contact_name: string | null;
      emergency_contact_phone: string | null;
      notes: string | null;
      blood_type: string | null;
      allergies: string[] | null;
    }>(
      `SELECT emergency_contact_name, emergency_contact_phone, notes, blood_type, allergies
       FROM public.medical_profiles WHERE patient_id = $1`,
      [PATIENT]
    );
    expect(medical.rows[0]?.emergency_contact_name).toBeNull();
    expect(medical.rows[0]?.emergency_contact_phone).toBeNull();
    expect(medical.rows[0]?.notes).toBe("private note");
    expect(medical.rows[0]?.blood_type).toBe("O+");
    expect(medical.rows[0]?.allergies).toEqual(["peanuts"]);

    const dependentClinical = await db.query<{
      emergency_contact_name: string | null;
      notes: string | null;
      blood_type: string | null;
    }>(
      `SELECT dmp.emergency_contact_name, dmp.notes, dmp.blood_type
       FROM public.dependent_medical_profiles dmp
       JOIN public.dependents dep ON dep.id = dmp.dependent_id
       WHERE dep.parent_id = $1`,
      [PATIENT]
    );
    expect(dependentClinical.rows[0]?.emergency_contact_name).toBeNull();
    expect(dependentClinical.rows[0]?.notes).toBe("dependent note");
    expect(dependentClinical.rows[0]?.blood_type).toBe("A+");

    const pushes = await db.query<{ count: string }>(
      "SELECT count(*)::text AS count FROM public.push_subscriptions WHERE user_id = $1",
      [PATIENT]
    );
    expect(pushes.rows[0]?.count).toBe("0");
    const alerts = await db.query<{ count: string }>(
      `SELECT (
         (SELECT count(*) FROM public.availability_alerts WHERE patient_id = $1 OR lower(guest_email) = 'pip.patient@example.com')
         + (SELECT count(*) FROM public.specialty_waitlist WHERE patient_id = $1 OR lower(guest_email) = 'pip.patient@example.com')
         + (SELECT count(*) FROM public.launch_notifications WHERE lower(email) = 'pip.patient@example.com')
       )::text AS count`,
      [PATIENT]
    );
    expect(alerts.rows[0]?.count).toBe("0");
    const videoStillThere = await db.query<{ profile_video_path: string | null; gender: string | null }>(
      "SELECT profile_video_path, gender FROM public.doctors WHERE id = $1",
      [DOCTOR_ROW]
    );
    expect(videoStillThere.rows[0]?.profile_video_path).toBe("videos/secret.mp4");
    expect(videoStillThere.rows[0]?.gender).toBe("female");

    const stillBlocked = await deleteUser(PATIENT);
    expect(stillBlocked).toMatch(/23503|foreign key/i);
  });

  it("restricts the doctor and scrubs profile video and gender when those columns exist", async () => {
    const result = await db.query<ModeRow>(
      "SELECT (public.erase_account($1::uuid)->>'mode') AS mode",
      [DOCTOR_USER]
    );
    expect(result.rows[0]?.mode).toBe("restricted");

    const profile = await db.query<{ first_name: string; email: string; phone: string | null; restricted_at: string | null }>(
      "SELECT first_name, email, phone, restricted_at::text AS restricted_at FROM public.profiles WHERE id = $1",
      [DOCTOR_USER]
    );
    expect(profile.rows[0]?.first_name).toBe("");
    expect(profile.rows[0]?.email).toBe(`erased+${DOCTOR_USER}@users.invalid`);
    expect(profile.rows[0]?.phone).toBeNull();
    expect(profile.rows[0]?.restricted_at).toBeTruthy();

    const doctor = await db.query<Record<string, string | null | boolean>>(
      `SELECT is_active, verification_status, bio, address, clinic_name, slug, gmc_number, stripe_account_id,
              profile_video_path, profile_video_status, profile_video_uploaded_at::text AS profile_video_uploaded_at,
              profile_video_reviewed_at::text AS profile_video_reviewed_at, profile_video_rejection_reason,
              gender, ics_feed_token
       FROM public.doctors WHERE id = $1`,
      [DOCTOR_ROW]
    );
    const listing = doctor.rows[0];
    expect(listing?.is_active).toBe(false);
    expect(listing?.verification_status).toBe("suspended");
    expect(listing?.bio).toBeNull();
    expect(listing?.address).toBeNull();
    expect(listing?.clinic_name).toBeNull();
    expect(listing?.slug).toBe(`erased-${DOCTOR_ROW}`);
    expect(listing?.profile_video_path).toBeNull();
    expect(listing?.profile_video_status).toBeNull();
    expect(listing?.profile_video_uploaded_at).toBeNull();
    expect(listing?.profile_video_reviewed_at).toBeNull();
    expect(listing?.profile_video_rejection_reason).toBeNull();
    expect(listing?.gender).toBeNull();
    expect(listing?.ics_feed_token).toBeNull();
    expect(listing?.gmc_number).toBe("7654321");
    expect(listing?.stripe_account_id).toBe("acct_secret");
    expect(JSON.stringify(listing)).not.toMatch(/Secret|Manchester|dr-pip/);

    const photos = await db.query<{ count: string }>(
      "SELECT count(*)::text AS count FROM public.doctor_photos WHERE doctor_id = $1",
      [DOCTOR_ROW]
    );
    expect(photos.rows[0]?.count).toBe("0");
    const faqs = await db.query<{ count: string }>(
      "SELECT count(*)::text AS count FROM public.doctor_faqs WHERE doctor_id = $1",
      [DOCTOR_ROW]
    );
    expect(faqs.rows[0]?.count).toBe("0");
    const calendars = await db.query<{ count: string }>(
      "SELECT count(*)::text AS count FROM public.doctor_calendar_connections WHERE doctor_id = $1",
      [DOCTOR_ROW]
    );
    expect(calendars.rows[0]?.count).toBe("0");
    const labs = await db.query<{ name: string; address: string; phone: string | null; is_active: boolean }>(
      "SELECT name, address, phone, is_active FROM public.doctor_testing_locations WHERE doctor_id = $1",
      [DOCTOR_ROW]
    );
    expect(labs.rows[0]?.name).toBe("");
    expect(labs.rows[0]?.address).toBe("");
    expect(labs.rows[0]?.phone).toBeNull();
    expect(labs.rows[0]?.is_active).toBe(false);
    const waitlist = await db.query<{ count: string }>(
      "SELECT count(*)::text AS count FROM public.doctor_waitlist WHERE lower(email) = 'pip.doctor@example.com'"
    );
    expect(waitlist.rows[0]?.count).toBe("0");

    const rx = await db.query<{ id: string; doctor_id: string }>(
      "SELECT id::text, doctor_id::text FROM public.prescriptions WHERE id = $1",
      [RX]
    );
    expect(rx.rows[0]).toMatchObject({ id: RX, doctor_id: DOCTOR_ROW });
    const audit = await db.query<{ actor: string }>(
      "SELECT actor_profile_id::text AS actor FROM public.prescription_audit_log WHERE id = $1",
      [AUDIT]
    );
    expect(audit.rows[0]?.actor).toBe(DOCTOR_USER);

    const auth = await db.query<{ email: string; banned_until: string | null }>(
      "SELECT email, banned_until::text AS banned_until FROM auth.users WHERE id = $1",
      [DOCTOR_USER]
    );
    expect(auth.rows[0]?.email).toBe(`erased+${DOCTOR_USER}@users.invalid`);
    expect(auth.rows[0]?.banned_until).toBeTruthy();

    const stillBlocked = await deleteUser(DOCTOR_USER);
    expect(stillBlocked).toMatch(/23503|foreign key/i);
  });

  it("removes review text, keeps the rating, and shows no author name", async () => {
    const before = await deleteUser(REVIEWER);
    expect(before).toMatch(/23503|foreign key/i);

    const result = await db.query<ModeRow>(
      "SELECT (public.erase_account($1::uuid)->>'mode') AS mode",
      [REVIEWER]
    );
    expect(result.rows[0]?.mode).toBe("restricted");

    const profile = await db.query<{ first_name: string; last_name: string; email: string; phone: string | null }>(
      "SELECT first_name, last_name, email, phone FROM public.profiles WHERE id = $1",
      [REVIEWER]
    );
    expect(profile.rows[0]?.first_name).toBe("");
    expect(profile.rows[0]?.last_name).toBe("");
    expect(profile.rows[0]?.email).toBe(`erased+${REVIEWER}@users.invalid`);
    expect(profile.rows[0]?.phone).toBeNull();

    const review = await db.query<{ patient_id: string; comment: string | null; title: string | null; rating: number }>(
      "SELECT patient_id::text, comment, title, rating FROM public.reviews WHERE patient_id = $1",
      [REVIEWER]
    );
    expect(review.rows[0]).toMatchObject({
      patient_id: REVIEWER,
      comment: null,
      title: null,
      rating: 5,
    });
    const unshared = await db.query<{ count: string }>(
      "SELECT count(*)::text AS count FROM public.medical_profiles WHERE patient_id = $1",
      [REVIEWER]
    );
    expect(unshared.rows[0]?.count).toBe("0");

    const rx = await db.query<{ count: string }>(
      "SELECT count(*)::text AS count FROM public.prescriptions WHERE patient_id = $1",
      [REVIEWER]
    );
    expect(rx.rows[0]?.count).toBe("0");

    const stillBlocked = await deleteUser(REVIEWER);
    expect(stillBlocked).toMatch(/23503|foreign key/i);
  });

  it("hard-deletes a medical profile that was never shared", async () => {
    const result = await db.query<ModeRow>(
      "SELECT (public.erase_account($1::uuid)->>'mode') AS mode",
      [CLINICAL]
    );
    expect(result.rows[0]?.mode).toBe("hard_delete");

    const profile = await db.query<{ first_name: string; restricted_at: string | null }>(
      "SELECT first_name, restricted_at::text AS restricted_at FROM public.profiles WHERE id = $1",
      [CLINICAL]
    );
    expect(profile.rows[0]?.first_name).toBe("Cara");
    expect(profile.rows[0]?.restricted_at).toBeNull();

    const medical = await db.query<{ count: string }>(
      "SELECT count(*)::text AS count FROM public.medical_profiles WHERE patient_id = $1",
      [CLINICAL]
    );
    expect(medical.rows[0]?.count).toBe("0");

    const deleted = await deleteUser(CLINICAL);
    expect(deleted).toBeNull();
  });

  it("keeps a medical profile that was shared with a doctor for a completed booking", async () => {
    const result = await db.query<ModeRow>(
      "SELECT (public.erase_account($1::uuid)->>'mode') AS mode",
      [SHARED]
    );
    expect(result.rows[0]?.mode).toBe("restricted");

    const medical = await db.query<{
      patient_id: string;
      blood_type: string | null;
      notes: string | null;
      emergency_contact_name: string | null;
    }>(
      `SELECT patient_id::text, blood_type, notes, emergency_contact_name
       FROM public.medical_profiles WHERE patient_id = $1`,
      [SHARED]
    );
    expect(medical.rows).toHaveLength(1);
    expect(medical.rows[0]?.patient_id).toBe(SHARED);
    expect(medical.rows[0]?.blood_type).toBe("A-");
    expect(medical.rows[0]?.notes).toBe("shared-clinical-note");
    expect(medical.rows[0]?.emergency_contact_name).toBeNull();
  });

  it("keeps review text while a payment correction dispute on that booking is open", async () => {
    const result = await db.query<ModeRow>(
      "SELECT (public.erase_account($1::uuid)->>'mode') AS mode",
      [DISPUTE]
    );
    expect(result.rows[0]?.mode).toBe("restricted");
    const review = await db.query<{ comment: string | null; rating: number }>(
      "SELECT comment, rating FROM public.reviews WHERE patient_id = $1",
      [DISPUTE]
    );
    expect(review.rows[0]).toMatchObject({ comment: "keep-under-dispute", rating: 5 });
  });

  it("keeps review text while the booking has an open Stripe dispute", async () => {
    const result = await db.query<ModeRow>(
      "SELECT (public.erase_account($1::uuid)->>'mode') AS mode",
      [STRIPE_DISPUTE]
    );
    expect(result.rows[0]?.mode).toBe("restricted");
    const review = await db.query<{ comment: string | null; rating: number }>(
      "SELECT comment, rating FROM public.reviews WHERE patient_id = $1",
      [STRIPE_DISPUTE]
    );
    expect(review.rows[0]).toMatchObject({ comment: "keep-under-stripe", rating: 5 });
  });

  it("returns hard_delete and still allows deleting a user with no prescriptions", async () => {
    await db.query(
      `INSERT INTO public.bookings (patient_id, doctor_id, status) VALUES ($1, $2, 'confirmed')`,
      [CLEAN, DOCTOR_ROW]
    );
    await expect(db.query("SELECT public.erase_account($1::uuid)", [CLEAN])).rejects.toThrow(
      /active_bookings/
    );
    const unchanged = await db.query<{ first_name: string; restricted_at: string | null }>(
      "SELECT first_name, restricted_at::text AS restricted_at FROM public.profiles WHERE id = $1",
      [CLEAN]
    );
    expect(unchanged.rows[0]?.first_name).toBe("Clean");
    expect(unchanged.rows[0]?.restricted_at).toBeNull();

    await db.query("DELETE FROM public.bookings WHERE patient_id = $1 AND status = 'confirmed'", [CLEAN]);

    const result = await db.query<ModeRow>(
      "SELECT (public.erase_account($1::uuid)->>'mode') AS mode",
      [CLEAN]
    );
    expect(result.rows[0]?.mode).toBe("hard_delete");
    const ephemera = await db.query<{ count: string }>(
      `SELECT (
         (SELECT count(*) FROM auth.sessions WHERE user_id = $1)
         + (SELECT count(*) FROM auth.identities WHERE user_id = $1)
         + (SELECT count(*) FROM auth.refresh_tokens WHERE user_id::text = $1::text)
         + (SELECT count(*) FROM public.push_subscriptions WHERE user_id = $1)
         + (SELECT count(*) FROM public.cookie_consents WHERE user_id = $1)
         + (SELECT count(*) FROM public.availability_alerts WHERE patient_id = $1)
       )::text AS count`,
      [CLEAN]
    );
    expect(ephemera.rows[0]?.count).toBe("0");
    const stillNamed = await db.query<{ first_name: string; email: string }>(
      "SELECT first_name, email FROM public.profiles WHERE id = $1",
      [CLEAN]
    );
    expect(stillNamed.rows[0]?.first_name).toBe("Clean");
    expect(stillNamed.rows[0]?.email).toBe("pip.clean@example.com");
    const cleanCapture = await db.query<{ count: string }>(
      "SELECT count(*)::text AS count FROM public.retention_subjects WHERE subject_id = $1",
      [CLEAN]
    );
    expect(cleanCapture.rows[0]?.count).toBe("0");

    const deleted = await deleteUser(CLEAN);
    expect(deleted).toBeNull();
    const gone = await db.query<{ count: string }>(
      "SELECT count(*)::text AS count FROM public.profiles WHERE id = $1",
      [CLEAN]
    );
    expect(gone.rows[0]?.count).toBe("0");

    const rx = await db.query<{ count: string }>(
      "SELECT count(*)::text AS count FROM public.prescriptions WHERE id = $1",
      [RX]
    );
    expect(rx.rows[0]?.count).toBe("1");
  });

  it("does not grant execute to anon or authenticated, or table privileges on retention_subjects", async () => {
    for (const role of ["anon", "authenticated"] as const) {
      for (const sql of [
        "SELECT public.erase_account('00000000-0000-0000-0000-000000000000'::uuid)",
        "SELECT * FROM public.retention_subjects",
      ]) {
        await db.exec("BEGIN");
        try {
          await db.exec(`SET LOCAL ROLE ${role}`);
          await expect(db.query(sql)).rejects.toThrow(/permission denied|42501|forbidden/i);
        } finally {
          await db.exec("ROLLBACK");
        }
      }
    }

    const tableGrants = await db.query<{ grantee: string; privilege_type: string }>(
      `SELECT grantee, privilege_type
       FROM information_schema.role_table_grants
       WHERE table_schema = 'public' AND table_name = 'retention_subjects'
       ORDER BY grantee, privilege_type`
    );
    const tableGrantees = new Set(tableGrants.rows.map((row) => row.grantee));
    expect(tableGrantees.has("PUBLIC")).toBe(false);
    expect(tableGrantees.has("anon")).toBe(false);
    expect(tableGrantees.has("authenticated")).toBe(false);
    expect(tableGrantees.has("service_role")).toBe(true);
    expect(tableGrants.rows.filter((row) => row.grantee === "service_role").map((row) => row.privilege_type).sort()).toEqual(
      ["DELETE", "INSERT", "REFERENCES", "SELECT", "TRIGGER", "TRUNCATE", "UPDATE"]
    );

    const functionGrants = await db.query<{ grantee: string }>(
      `SELECT grantee
       FROM information_schema.routine_privileges
       WHERE routine_schema = 'public' AND routine_name = 'erase_account'`
    );
    const functionGrantees = new Set(functionGrants.rows.map((row) => row.grantee));
    expect(functionGrantees.has("PUBLIC")).toBe(false);
    expect(functionGrantees.has("anon")).toBe(false);
    expect(functionGrantees.has("authenticated")).toBe(false);
    expect(functionGrantees.has("service_role")).toBe(true);

    const lock = await db.query<{ relrowsecurity: boolean; policies: number }>(
      `SELECT c.relrowsecurity,
              (SELECT count(*)::int FROM pg_catalog.pg_policy AS pol WHERE pol.polrelid = c.oid) AS policies
       FROM pg_catalog.pg_class AS c
       JOIN pg_catalog.pg_namespace AS n ON n.oid = c.relnamespace
       WHERE n.nspname = 'public' AND c.relname = 'retention_subjects'`
    );
    expect(lock.rows[0]).toEqual({ relrowsecurity: true, policies: 0 });
  });
});

describe("erase_account when prod is missing doctor video and gender columns", () => {
  let db: PGlite;
  const bareSchema = SCHEMA.replace(
    /\s*profile_video_path text,\n\s*profile_video_status text,\n\s*profile_video_uploaded_at timestamptz,\n\s*profile_video_reviewed_at timestamptz,\n\s*profile_video_rejection_reason text,\n\s*gender text,\n/,
    "\n"
  );

  beforeAll(async () => {
    db = new PGlite();
    await db.exec(bareSchema);
    const missing = await db.query<{ column_name: string }>(
      `SELECT column_name FROM information_schema.columns
       WHERE table_schema = 'public' AND table_name = 'doctors'
         AND column_name IN (
           'profile_video_path', 'profile_video_status', 'profile_video_uploaded_at',
           'profile_video_reviewed_at', 'profile_video_rejection_reason', 'gender'
         )`
    );
    expect(missing.rows).toEqual([]);
    await db.exec(readFileSync(join(process.cwd(), "supabase/migrations/00135_account_erasure.sql"), "utf8"));
    await db.exec(readFileSync(join(process.cwd(), "supabase/migrations/00142_retention_subjects.sql"), "utf8"));
    await db.exec(`
      SELECT set_config('request.jwt.claim.role', 'service_role', false);
      SELECT set_config('request.jwt.claim.sub', '', false);
      INSERT INTO auth.users (id, email, raw_user_meta_data) VALUES
        ('${PATIENT}', 'pip.patient@example.com', '{"role":"patient"}'),
        ('${DOCTOR_USER}', 'pip.doctor@example.com', '{"role":"doctor"}');
      INSERT INTO public.profiles (id, role, first_name, last_name, email) VALUES
        ('${PATIENT}', 'patient', 'Pip', 'Patient', 'pip.patient@example.com'),
        ('${DOCTOR_USER}', 'doctor', 'Pip', 'Doctor', 'pip.doctor@example.com');
      INSERT INTO public.doctors (
        id, profile_id, slug, bio, is_active, verification_status, referral_code, gmc_number
      ) VALUES (
        '${DOCTOR_ROW}', '${DOCTOR_USER}', 'dr-pip', 'Secret biography', true, 'verified', 'PIPDOCTOR', '7654321'
      );
      INSERT INTO public.prescriptions (id, doctor_id, patient_id, diagnosis)
      VALUES ('${RX}', '${DOCTOR_ROW}', '${PATIENT}', 'keep-this-diagnosis');
      INSERT INTO public.prescription_audit_log (id, prescription_id, event_type, actor_profile_id, snapshot)
      VALUES ('${AUDIT}', '${RX}', 'issued', '${DOCTOR_USER}', '{"marker":"keep-audit"}');
    `);
  }, 120000);

  afterAll(async () => {
    await db?.close();
  });

  it("restricts a patient even though the doctors update names columns that are absent", async () => {
    const result = await db.query<{ mode: string }>(
      "SELECT (public.erase_account($1::uuid)->>'mode') AS mode",
      [PATIENT]
    );
    expect(result.rows[0]?.mode).toBe("restricted");
    const profile = await db.query<{ first_name: string }>(
      "SELECT first_name FROM public.profiles WHERE id = $1",
      [PATIENT]
    );
    expect(profile.rows[0]?.first_name).toBe("");
    const doctor = await db.query<{ bio: string | null }>(
      "SELECT bio FROM public.doctors WHERE id = $1",
      [DOCTOR_ROW]
    );
    expect(doctor.rows[0]?.bio).toBe("Secret biography");
  });

  it("restricts the doctor without those columns and still clears bio", async () => {
    const result = await db.query<{ mode: string }>(
      "SELECT (public.erase_account($1::uuid)->>'mode') AS mode",
      [DOCTOR_USER]
    );
    expect(result.rows[0]?.mode).toBe("restricted");
    const doctor = await db.query<{ bio: string | null; is_active: boolean; gmc_number: string }>(
      "SELECT bio, is_active, gmc_number FROM public.doctors WHERE id = $1",
      [DOCTOR_ROW]
    );
    expect(doctor.rows[0]?.bio).toBeNull();
    expect(doctor.rows[0]?.is_active).toBe(false);
    expect(doctor.rows[0]?.gmc_number).toBe("7654321");
  });
});

const RESTRICTED_DOB = "d0d0d0d0-d0d0-40d0-80d0-d0d0d0d0d0d0";
const HARD_DOB = "d1d1d1d1-d1d1-41d1-81d1-d1d1d1d1d1d1";
const BLOCKED_DOB = "d2d2d2d2-d2d2-42d2-82d2-d2d2d2d2d2d2";
const RERUN_DOB = "d3d3d3d3-d3d3-43d3-83d3-d3d3d3d3d3d3";
const NULL_DOB = "d4d4d4d4-d4d4-44d4-84d4-d4d4d4d4d4d4";
const KEPT_DOB = "d5d5d5d5-d5d5-45d5-85d5-d5d5d5d5d5d5";
const DEP_RESTRICTED = "e0e0e0e0-e0e0-40e0-80e0-e0e0e0e0e0e0";
const DEP_RESTRICTED_NULL = "e1e1e1e1-e1e1-41e1-81e1-e1e1e1e1e1e1";
const DEP_HARD = "e2e2e2e2-e2e2-42e2-82e2-e2e2e2e2e2e2";
const DEP_BLOCKED = "e3e3e3e3-e3e3-43e3-83e3-e3e3e3e3e3e3";
const DEP_RERUN = "e4e4e4e4-e4e4-44e4-84e4-e4e4e4e4e4e4";
const DEP_NULL = "e5e5e5e5-e5e5-45e5-85e5-e5e5e5e5e5e5";
const DEP_KEPT = "e6e6e6e6-e6e6-46e6-86e6-e6e6e6e6e6e6";
const DISPUTE_STRIPE = "d6d6d6d6-d6d6-46d6-86d6-d6d6d6d6d6d6";
const DISPUTE_PAY = "d7d7d7d7-d7d7-47d7-87d7-d7d7d7d7d7d7";
const CLOSED_DISPUTE = "d8d8d8d8-d8d8-48d8-88d8-d8d8d8d8d8d8";
const SOLE_OWNER = "d9d9d9d9-d9d9-49d9-89d9-d9d9d9d9d9d9";
const DEP_DISPUTE_STRIPE = "e7e7e7e7-e7e7-47e7-87e7-e7e7e7e7e7e7";
const DEP_DISPUTE_PAY = "e8e8e8e8-e8e8-48e8-88e8-e8e8e8e8e8e8";
const DEP_CLOSED = "e9e9e9e9-e9e9-49e9-89e9-e9e9e9e9e9e9";
const DEP_OWNER = "eaeaeaea-eaea-4aea-8aea-eaeaeaeaeaea";
const OWNER_ORG = "f4f4f4f4-f4f4-44f4-84f4-f4f4f4f4f4f4";

function eraseAccountSource(filename: string): string {
  const sql = readFileSync(join(process.cwd(), "supabase/migrations", filename), "utf8");
  const start = sql.indexOf("CREATE OR REPLACE FUNCTION public.erase_account(p_user_id uuid)");
  return sql.slice(start);
}

function functionBody(sql: string): string {
  const end = sql.indexOf("\n$fn$;");
  return sql.slice(0, end + "\n$fn$;".length);
}

function strip142Deltas(sql: string): string {
  return sql.replace(
    /[ \t]*-- 00142_delta_begin [^\n]*\n[\s\S]*?[ \t]*-- 00142_delta_end [^\n]*\n/g,
    ""
  );
}

const RESTRICTED_RETURN_142 = `  RETURN pg_catalog.jsonb_build_object(
    'mode', 'restricted',
    'restricted_at', v_restricted_at,
    'email', v_email
  ) || CASE
    WHEN v_fallback_reason IS NULL THEN pg_catalog.jsonb_build_object()
    ELSE pg_catalog.jsonb_build_object('fallback_reason', v_fallback_reason)
  END;`;

const RESTRICTED_RETURN_141 = `  RETURN pg_catalog.jsonb_build_object(
    'mode', 'restricted',
    'restricted_at', v_restricted_at,
    'email', v_email
  );`;

describe("retention_subjects date of birth capture", () => {
  let db: PGlite;

  beforeAll(async () => {
    db = new PGlite();
    await db.exec(SCHEMA);
    await db.exec(readFileSync(join(process.cwd(), "supabase/migrations/00135_account_erasure.sql"), "utf8"));
    await db.exec(readFileSync(join(process.cwd(), "supabase/migrations/00142_retention_subjects.sql"), "utf8"));
    await db.exec(`
      SELECT set_config('request.jwt.claim.role', 'service_role', false);
      SELECT set_config('request.jwt.claim.sub', '', false);
    `);

    const people: Array<[string, string, string | null]> = [
      [DOCTOR_USER, "dob-doctor", null],
      [RESTRICTED_DOB, "dob-restricted", "1990-04-05"],
      [HARD_DOB, "dob-hard", "1988-08-08"],
      [BLOCKED_DOB, "dob-blocked", "1977-07-07"],
      [RERUN_DOB, "dob-rerun", "1991-01-09"],
      [NULL_DOB, "dob-null", null],
      [KEPT_DOB, "dob-kept", "1980-01-01"],
    ];
    for (const [id, name, dob] of people) {
      await db.query(
        `INSERT INTO auth.users (id, email, raw_user_meta_data)
         VALUES ($1, $2, '{"role":"patient"}')`,
        [id, `${name}@example.com`]
      );
      await db.query(
        `INSERT INTO public.profiles (id, role, first_name, last_name, email, date_of_birth)
         VALUES ($1, 'patient', $2, 'Capture', $3, $4)`,
        [id, name, `${name}@example.com`, dob]
      );
    }
    await db.query(
      `INSERT INTO public.doctors (
         id, profile_id, slug, is_active, verification_status, referral_code, gmc_number
       ) VALUES ($1, $2, 'dr-dob', true, 'verified', 'DOBCAPTURE', '1234567')`,
      [DOCTOR_ROW, DOCTOR_USER]
    );
    await db.query(
      `INSERT INTO public.dependents (id, parent_id, first_name, last_name, date_of_birth)
       VALUES
         ($1, $2, 'Ada', 'Restricted', '2018-06-01'),
         ($3, $2, 'No', 'Date', NULL),
         ($4, $5, 'Bea', 'Hard', '2016-02-02'),
         ($6, $7, 'Cara', 'Blocked', '2014-04-04'),
         ($8, $9, 'Dee', 'Rerun', '2012-12-12'),
         ($10, $11, 'Eve', 'Null', NULL),
         ($12, $13, 'Fay', 'Kept', '2019-09-09')`,
      [
        DEP_RESTRICTED,
        RESTRICTED_DOB,
        DEP_RESTRICTED_NULL,
        DEP_HARD,
        HARD_DOB,
        DEP_BLOCKED,
        BLOCKED_DOB,
        DEP_RERUN,
        RERUN_DOB,
        DEP_NULL,
        NULL_DOB,
        DEP_KEPT,
        KEPT_DOB,
      ]
    );
    await db.query(
      `INSERT INTO public.prescriptions (id, doctor_id, patient_id, diagnosis) VALUES
         ('f0f0f0f0-f0f0-40f0-80f0-f0f0f0f0f0f0', $1, $2, 'retain'),
         ('f1f1f1f1-f1f1-41f1-81f1-f1f1f1f1f1f1', $1, $3, 'retain'),
         ('f2f2f2f2-f2f2-42f2-82f2-f2f2f2f2f2f2', $1, $4, 'retain'),
         ('f3f3f3f3-f3f3-43f3-83f3-f3f3f3f3f3f3', $1, $5, 'retain')`,
      [DOCTOR_ROW, RESTRICTED_DOB, RERUN_DOB, NULL_DOB, KEPT_DOB]
    );
    await db.query(
      `INSERT INTO public.bookings (patient_id, doctor_id, status)
       VALUES ($1, $2, 'confirmed')`,
      [BLOCKED_DOB, DOCTOR_ROW]
    );
    await db.query(
      `INSERT INTO public.retention_subjects (subject_type, subject_id, date_of_birth)
       VALUES ('dependent', $1, '2001-01-01')`,
      [DEP_KEPT]
    );
  }, 120000);

  afterAll(async () => {
    await db?.close();
  });

  async function captured(parentId: string) {
    return db.query<{ subject_type: string; subject_id: string; date_of_birth: string | null }>(
      `SELECT subject_type, subject_id::text, date_of_birth::text AS date_of_birth
       FROM public.retention_subjects
       WHERE subject_id = $1
          OR subject_id IN (SELECT id FROM public.dependents WHERE parent_id = $1)
       ORDER BY subject_type, subject_id`,
      [parentId]
    );
  }

  it("copies the dependent date of birth on the restricted path and then nulls it", async () => {
    const result = await db.query<{ mode: string }>(
      "SELECT (public.erase_account($1::uuid)->>'mode') AS mode",
      [RESTRICTED_DOB]
    );
    expect(result.rows[0]?.mode).toBe("restricted");

    const live = await db.query<{ id: string; date_of_birth: string | null }>(
      `SELECT id::text, date_of_birth::text AS date_of_birth
       FROM public.dependents WHERE parent_id = $1 ORDER BY id`,
      [RESTRICTED_DOB]
    );
    expect(live.rows).toEqual([
      { id: DEP_RESTRICTED, date_of_birth: null },
      { id: DEP_RESTRICTED_NULL, date_of_birth: null },
    ]);
    const profile = await db.query<{ date_of_birth: string | null }>(
      "SELECT date_of_birth::text AS date_of_birth FROM public.profiles WHERE id = $1",
      [RESTRICTED_DOB]
    );
    expect(profile.rows[0]?.date_of_birth).toBeNull();
    expect((await captured(RESTRICTED_DOB)).rows).toEqual([
      { subject_type: "dependent", subject_id: DEP_RESTRICTED, date_of_birth: "2018-06-01" },
    ]);
  });

  it("leaves no retention_subjects row on hard erasure, including one captured earlier", async () => {
    await db.query(
      `INSERT INTO public.retention_subjects (subject_type, subject_id, date_of_birth)
       VALUES ('patient', $1, '1988-08-08'), ('dependent', $2, '2016-02-02')`,
      [HARD_DOB, DEP_HARD]
    );
    const result = await db.query<{ mode: string }>(
      "SELECT (public.erase_account($1::uuid)->>'mode') AS mode",
      [HARD_DOB]
    );
    expect(result.rows[0]?.mode).toBe("hard_delete");
    const live = await db.query<{ date_of_birth: string | null }>(
      "SELECT date_of_birth::text AS date_of_birth FROM public.dependents WHERE id = $1",
      [DEP_HARD]
    );
    expect(live.rows[0]?.date_of_birth).toBe("2016-02-02");
    expect((await captured(HARD_DOB)).rows).toEqual([]);
  });

  it("copies nothing when erasure is blocked", async () => {
    await expect(db.query("SELECT public.erase_account($1::uuid)", [BLOCKED_DOB])).rejects.toThrow(
      /active_bookings/
    );
    const live = await db.query<{ date_of_birth: string }>(
      "SELECT date_of_birth::text AS date_of_birth FROM public.dependents WHERE id = $1",
      [DEP_BLOCKED]
    );
    expect(live.rows[0]?.date_of_birth).toBe("2014-04-04");
    expect((await captured(BLOCKED_DOB)).rows).toEqual([]);
  });

  it("falls back to restricted with fallback_reason when a dispute is open", async () => {
    await db.exec(`
      ALTER TABLE public.bookings DROP CONSTRAINT bookings_patient_fkey;
      ALTER TABLE public.bookings
        ADD CONSTRAINT bookings_patient_fkey
        FOREIGN KEY (patient_id) REFERENCES public.profiles(id) ON DELETE CASCADE;
    `);
    for (const [id, name, dob] of [
      [DISPUTE_STRIPE, "dob-stripe", "1985-05-05"],
      [DISPUTE_PAY, "dob-pay", "1986-06-06"],
      [CLOSED_DISPUTE, "dob-closed", "1987-07-07"],
    ] as const) {
      await db.query(
        `INSERT INTO auth.users (id, email, raw_user_meta_data)
         VALUES ($1, $2, '{"role":"patient"}')`,
        [id, `${name}@example.com`]
      );
      await db.query(
        `INSERT INTO public.profiles (id, role, first_name, last_name, email, date_of_birth)
         VALUES ($1, 'patient', $2, 'Dispute', $3, $4)`,
        [id, name, `${name}@example.com`, dob]
      );
    }
    await db.query(
      `INSERT INTO public.dependents (id, parent_id, first_name, last_name, date_of_birth)
       VALUES
         ($1, $2, 'Gus', 'Stripe', '2015-05-05'),
         ($3, $4, 'Hal', 'Payment', '2013-03-03'),
         ($5, $6, 'Ivy', 'Closed', '2011-11-11')`,
      [DEP_DISPUTE_STRIPE, DISPUTE_STRIPE, DEP_DISPUTE_PAY, DISPUTE_PAY, DEP_CLOSED, CLOSED_DISPUTE]
    );
    await db.query(
      `INSERT INTO public.bookings (patient_id, doctor_id, status, stripe_dispute_status)
       VALUES ($1, $2, 'completed', 'needs_response'),
              ($3, $2, 'completed', 'won')`,
      [DISPUTE_STRIPE, DOCTOR_ROW, CLOSED_DISPUTE]
    );
    await db.query(
      `INSERT INTO public.payment_corrections (patient_id, disputed_at, dispute_resolved_at, status)
       VALUES ($1, now(), NULL, 'disputed')`,
      [DISPUTE_PAY]
    );
    await db.query(
      `INSERT INTO public.retention_subjects (subject_type, subject_id, date_of_birth)
       VALUES ('dependent', $1, '2011-11-11'), ('patient', $2, '1987-07-07')`,
      [DEP_CLOSED, CLOSED_DISPUTE]
    );

    const stripe = await db.query<{ mode: string; fallback_reason: string | null }>(
      `SELECT result->>'mode' AS mode, result->>'fallback_reason' AS fallback_reason
       FROM (SELECT public.erase_account($1::uuid) AS result) AS erased`,
      [DISPUTE_STRIPE]
    );
    expect(stripe.rows[0]).toEqual({ mode: "restricted", fallback_reason: "open_dispute" });
    const stripeLive = await db.query<{ date_of_birth: string | null }>(
      "SELECT date_of_birth::text AS date_of_birth FROM public.dependents WHERE id = $1",
      [DEP_DISPUTE_STRIPE]
    );
    expect(stripeLive.rows[0]?.date_of_birth).toBeNull();
    expect((await captured(DISPUTE_STRIPE)).rows).toEqual([
      { subject_type: "dependent", subject_id: DEP_DISPUTE_STRIPE, date_of_birth: "2015-05-05" },
    ]);

    const payment = await db.query<{ mode: string; fallback_reason: string | null }>(
      `SELECT result->>'mode' AS mode, result->>'fallback_reason' AS fallback_reason
       FROM (SELECT public.erase_account($1::uuid) AS result) AS erased`,
      [DISPUTE_PAY]
    );
    expect(payment.rows[0]).toEqual({ mode: "restricted", fallback_reason: "open_dispute" });
    expect((await captured(DISPUTE_PAY)).rows).toEqual([
      { subject_type: "dependent", subject_id: DEP_DISPUTE_PAY, date_of_birth: "2013-03-03" },
    ]);

    const closed = await db.query<{ mode: string; fallback_reason: string | null }>(
      `SELECT result->>'mode' AS mode, result->>'fallback_reason' AS fallback_reason
       FROM (SELECT public.erase_account($1::uuid) AS result) AS erased`,
      [CLOSED_DISPUTE]
    );
    expect(closed.rows[0]).toEqual({ mode: "hard_delete", fallback_reason: null });
    expect((await captured(CLOSED_DISPUTE)).rows).toEqual([]);
  });

  it("blocks a sole owner with an active licence and writes nothing", async () => {
    await db.exec(`
      CREATE TABLE public.organization_members (
        organization_id uuid,
        user_id uuid,
        role text,
        status text
      );
      CREATE TABLE public.licenses (
        organization_id uuid,
        status text
      );
    `);
    await db.query(
      `INSERT INTO auth.users (id, email, raw_user_meta_data)
       VALUES ($1, 'dob-owner@example.com', '{"role":"doctor"}')`,
      [SOLE_OWNER]
    );
    await db.query(
      `INSERT INTO public.profiles (id, role, first_name, last_name, email, date_of_birth)
       VALUES ($1, 'doctor', 'Owen', 'Owner', 'dob-owner@example.com', '1975-01-02')`,
      [SOLE_OWNER]
    );
    await db.query(
      `INSERT INTO public.dependents (id, parent_id, first_name, last_name, date_of_birth)
       VALUES ($1, $2, 'Joy', 'Owner', '2017-07-07')`,
      [DEP_OWNER, SOLE_OWNER]
    );
    await db.query(
      `INSERT INTO public.organization_members (organization_id, user_id, role, status)
       VALUES ($1, $2, 'owner', 'active')`,
      [OWNER_ORG, SOLE_OWNER]
    );
    await db.query(
      `INSERT INTO public.licenses (organization_id, status) VALUES ($1, 'active')`,
      [OWNER_ORG]
    );

    await expect(db.query("SELECT public.erase_account($1::uuid)", [SOLE_OWNER])).rejects.toThrow(
      /erasure_blocked/
    );
    const profile = await db.query<{ first_name: string; date_of_birth: string | null }>(
      "SELECT first_name, date_of_birth::text AS date_of_birth FROM public.profiles WHERE id = $1",
      [SOLE_OWNER]
    );
    expect(profile.rows[0]).toEqual({ first_name: "Owen", date_of_birth: "1975-01-02" });
    const dependent = await db.query<{ date_of_birth: string | null }>(
      "SELECT date_of_birth::text AS date_of_birth FROM public.dependents WHERE id = $1",
      [DEP_OWNER]
    );
    expect(dependent.rows[0]?.date_of_birth).toBe("2017-07-07");
    expect((await captured(SOLE_OWNER)).rows).toEqual([]);
  });

  it("keeps the captured date of birth when erasure runs again", async () => {
    const first = await db.query<{ mode: string }>(
      "SELECT (public.erase_account($1::uuid)->>'mode') AS mode",
      [RERUN_DOB]
    );
    expect(first.rows[0]?.mode).toBe("restricted");
    expect((await captured(RERUN_DOB)).rows).toEqual([
      { subject_type: "dependent", subject_id: DEP_RERUN, date_of_birth: "2012-12-12" },
    ]);

    const second = await db.query<{ mode: string }>(
      "SELECT (public.erase_account($1::uuid)->>'mode') AS mode",
      [RERUN_DOB]
    );
    expect(second.rows[0]?.mode).toBe("restricted");
    expect((await captured(RERUN_DOB)).rows).toEqual([
      { subject_type: "dependent", subject_id: DEP_RERUN, date_of_birth: "2012-12-12" },
    ]);

    const kept = await db.query<{ mode: string }>(
      "SELECT (public.erase_account($1::uuid)->>'mode') AS mode",
      [KEPT_DOB]
    );
    expect(kept.rows[0]?.mode).toBe("restricted");
    expect((await captured(KEPT_DOB)).rows).toEqual([
      { subject_type: "dependent", subject_id: DEP_KEPT, date_of_birth: "2001-01-01" },
    ]);
  });

  it("does not capture a patient date of birth", async () => {
    const sql = eraseAccountSource("00142_retention_subjects.sql");
    expect(sql).not.toContain("$dob_patient$");
    expect(sql).not.toContain("SELECT 'patient'");
    const rows = await db.query<{ subject_type: string }>(
      `SELECT subject_type FROM public.retention_subjects WHERE subject_type = 'patient'`
    );
    expect(rows.rows).toEqual([]);
  });

  it("creates no retention row when the date of birth is null", async () => {
    const result = await db.query<{ mode: string }>(
      "SELECT (public.erase_account($1::uuid)->>'mode') AS mode",
      [NULL_DOB]
    );
    expect(result.rows[0]?.mode).toBe("restricted");
    expect((await captured(NULL_DOB)).rows).toEqual([]);
  });

  it("keeps the erase_account signature and grants from 00141", async () => {
    const previous = eraseAccountSource("00141_account_erasure_gaps.sql");
    const current = eraseAccountSource("00142_retention_subjects.sql");
    const headerEnd = "AS $fn$\n";
    expect(current.slice(0, current.indexOf(headerEnd))).toBe(previous.slice(0, previous.indexOf(headerEnd)));
    const grantFrom = "REVOKE ALL ON FUNCTION public.erase_account(uuid) FROM PUBLIC;";
    expect(current.slice(current.lastIndexOf(grantFrom)).trim()).toBe(
      previous.slice(previous.lastIndexOf(grantFrom)).trim()
    );
    expect(current).toContain(RESTRICTED_RETURN_142);
    const restored = strip142Deltas(functionBody(current).split(RESTRICTED_RETURN_142).join(RESTRICTED_RETURN_141));
    expect(restored).toBe(functionBody(previous));
    expect(current).toContain("copies dependent dates of birth to retention_subjects before nulling them");
    expect(current).toContain("fallback_reason open_dispute");

    const signature = await db.query<{
      args: string;
      result: string;
      security_definer: boolean;
      config: string;
    }>(
      `SELECT pg_get_function_identity_arguments(p.oid) AS args,
              pg_get_function_result(p.oid) AS result,
              p.prosecdef AS security_definer,
              p.proconfig::text AS config
       FROM pg_catalog.pg_proc AS p
       JOIN pg_catalog.pg_namespace AS n ON n.oid = p.pronamespace
       WHERE n.nspname = 'public' AND p.proname = 'erase_account'`
    );
    expect(signature.rows).toEqual([
      {
        args: "p_user_id uuid",
        result: "jsonb",
        security_definer: true,
        config: '{"search_path=\\"\\""}',
      },
    ]);
  });
});
