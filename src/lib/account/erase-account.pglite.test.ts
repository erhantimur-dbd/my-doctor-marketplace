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
  notes text
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
  notes text
);

CREATE TABLE public.bookings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id uuid NOT NULL,
  doctor_id uuid NOT NULL,
  status text NOT NULL,
  patient_notes text
);

CREATE TABLE public.reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
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

type ModeRow = { mode: string; email: string | null; erased_at: string | null };

describe("erase_account keeps audited prescriptions", () => {
  let db: PGlite;

  beforeAll(async () => {
    db = new PGlite();
    await db.exec(SCHEMA);
    await db.exec(readFileSync(join(process.cwd(), "supabase/migrations/00135_account_erasure.sql"), "utf8"));
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
        ('${CLINICAL}', 'pip.clinical@example.com', '+447700900005', '{"role":"patient","first_name":"Cara","last_name":"Clinical"}');

      INSERT INTO public.profiles (
        id, role, first_name, last_name, email, phone, avatar_url,
        address_line1, city, postal_code, country, date_of_birth
      ) VALUES
        ('${PATIENT}', 'patient', 'Pip', 'Patient', 'pip.patient@example.com', '+447700900001', 'https://cdn.example/pip.jpg', '1 Secret Street', 'London', 'SW1A 1AA', 'GB', '1990-04-05'),
        ('${DOCTOR_USER}', 'doctor', 'Pip', 'Doctor', 'pip.doctor@example.com', '+447700900002', 'https://cdn.example/dr.jpg', '2 Clinic Road', 'Manchester', 'M1 1AE', 'GB', '1980-01-01'),
        ('${CLEAN}', 'patient', 'Clean', 'User', 'pip.clean@example.com', '+447700900003', 'https://cdn.example/clean.jpg', '3 Plain Road', 'Leeds', 'LS1 1AA', 'GB', NULL),
        ('${REVIEWER}', 'patient', 'Rita', 'Reviewer', 'pip.reviewer@example.com', '+447700900004', NULL, '4 Review Road', 'Bristol', 'BS1 1AA', 'GB', '1992-02-02'),
        ('${CLINICAL}', 'patient', 'Cara', 'Clinical', 'pip.clinical@example.com', '+447700900005', NULL, '5 Clinic Road', 'Oxford', 'OX1 1AA', 'GB', '1985-05-05');

      INSERT INTO public.doctors (
        id, profile_id, slug, bio, address, city, postal_code, clinic_name,
        clinic_latitude, clinic_longitude, education, certifications,
        meta_title, meta_description, profile_video_path, gender,
        is_active, is_featured, verification_status, referral_code, ics_feed_token,
        gmc_number, stripe_account_id
      ) VALUES (
        '${DOCTOR_ROW}', '${DOCTOR_USER}', 'dr-pip', 'Secret biography', '2 Clinic Road',
        'Manchester', 'M1 1AE', 'Secret Clinic', 53.48, -2.24,
        '[{"institution":"Secret College"}]'::jsonb, '[{"name":"Secret Cert"}]'::jsonb,
        'Dr Pip', 'A secret description', 'videos/secret.mp4', 'female',
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
      INSERT INTO public.dependent_medical_profiles (dependent_id, emergency_contact_name, emergency_contact_phone, notes, blood_type)
      SELECT id, 'Gran Secret', '+447700900011', 'dependent note', 'A+'
      FROM public.dependents WHERE parent_id = '${PATIENT}';
      INSERT INTO public.medical_profiles (patient_id, emergency_contact_name, emergency_contact_phone, notes, blood_type, allergies)
      VALUES ('${PATIENT}', 'Mum Secret', '+447700900012', 'private note', 'O+', ARRAY['peanuts']);

      INSERT INTO public.bookings (patient_id, doctor_id, status, patient_notes)
      VALUES
        ('${PATIENT}', '${DOCTOR_ROW}', 'completed', 'secret patient note'),
        ('${REVIEWER}', '${DOCTOR_ROW}', 'completed', NULL);
      INSERT INTO public.reviews (booking_id, patient_id, doctor_id, rating, comment)
      SELECT id, '${REVIEWER}', '${DOCTOR_ROW}', 5, 'keep-this-review'
      FROM public.bookings WHERE patient_id = '${REVIEWER}';
      INSERT INTO public.medical_profiles (patient_id, emergency_contact_name, emergency_contact_phone, notes, blood_type, allergies)
      VALUES ('${CLINICAL}', 'Nurse Secret', '+447700900013', 'keep-clinical-note', 'AB+', ARRAY['latex']);

      INSERT INTO public.prescriptions (id, doctor_id, patient_id, diagnosis, notes)
      VALUES ('${RX}', '${DOCTOR_ROW}', '${PATIENT}', 'keep-this-diagnosis', 'clinical note');
      INSERT INTO public.prescription_audit_log (id, prescription_id, event_type, actor_profile_id, snapshot)
      VALUES ('${AUDIT}', '${RX}', 'issued', '${DOCTOR_USER}', '{"marker":"keep-audit"}'::jsonb);

      INSERT INTO public.push_subscriptions (user_id) VALUES ('${PATIENT}'), ('${DOCTOR_USER}');
      INSERT INTO public.cookie_consents (user_id) VALUES ('${PATIENT}');

      INSERT INTO auth.identities (id, user_id, provider, provider_id, email, identity_data)
      VALUES
        ('${PATIENT}', '${PATIENT}', 'email', 'pip.patient@example.com', 'pip.patient@example.com', '{"email":"pip.patient@example.com"}'),
        ('${DOCTOR_USER}', '${DOCTOR_USER}', 'email', 'pip.doctor@example.com', 'pip.doctor@example.com', '{"email":"pip.doctor@example.com"}');
      INSERT INTO auth.sessions (id, user_id) VALUES ('${PATIENT}', '${PATIENT}'), ('${DOCTOR_USER}', '${DOCTOR_USER}');
      INSERT INTO auth.refresh_tokens (id, user_id) VALUES ('${PATIENT}', '${PATIENT}'), ('${DOCTOR_USER}', '${DOCTOR_USER}');
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

  it("anonymises the patient and keeps the prescription and audit row", async () => {
    const result = await db.query<ModeRow>(
      `SELECT result->>'mode' AS mode, result->>'email' AS email, result->>'erased_at' AS erased_at
       FROM (SELECT public.erase_account($1::uuid) AS result) AS erased`,
      [PATIENT]
    );
    expect(result.rows[0]?.mode).toBe("anonymised");

    const profile = await db.query<Record<string, string | null>>(
      `SELECT first_name, last_name, email, phone, avatar_url, address_line1, city, postal_code, country,
              date_of_birth::text AS date_of_birth, erased_at::text AS erased_at
       FROM public.profiles WHERE id = $1`,
      [PATIENT]
    );
    const row = profile.rows[0];
    expect(row?.first_name).toBe("Erased");
    expect(row?.last_name).toBe("Account");
    expect(row?.email).toBe(`erased+${PATIENT}@users.invalid`);
    expect(row?.phone).toBeNull();
    expect(row?.avatar_url).toBeNull();
    expect(row?.address_line1).toBeNull();
    expect(row?.city).toBeNull();
    expect(row?.postal_code).toBeNull();
    expect(row?.country).toBeNull();
    expect(row?.date_of_birth).toBeNull();
    expect(row?.erased_at).toBeTruthy();
    expect(JSON.stringify(row)).not.toMatch(/Pip|Secret|London|pip\.patient/);

    const auth = await db.query<{ email: string; phone: string | null; banned_until: string | null }>(
      "SELECT email, phone, banned_until::text AS banned_until FROM auth.users WHERE id = $1",
      [PATIENT]
    );
    expect(auth.rows[0]?.email).toBe(`erased+${PATIENT}@users.invalid`);
    expect(auth.rows[0]?.phone).toBeNull();
    expect(auth.rows[0]?.banned_until).toBeTruthy();

    const identity = await db.query<{ email: string; provider_id: string; identity_email: string }>(
      "SELECT email, provider_id, identity_data->>'email' AS identity_email FROM auth.identities WHERE user_id = $1",
      [PATIENT]
    );
    expect(identity.rows[0]?.identity_email).toBe(`erased+${PATIENT}@users.invalid`);
    expect(identity.rows[0]?.provider_id).toBe(`erased+${PATIENT}@users.invalid`);

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
    expect(dependent.rows[0]?.first_name).toBe("Erased");
    expect(dependent.rows[0]?.date_of_birth).toBeNull();
    expect(dependent.rows[0]?.notes).toBeNull();

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

    const stillBlocked = await deleteUser(PATIENT);
    expect(stillBlocked).toMatch(/23503|foreign key/i);
  });

  it("anonymises the doctor who authored the audit row and unpublishes the listing", async () => {
    const result = await db.query<ModeRow>(
      "SELECT (public.erase_account($1::uuid)->>'mode') AS mode",
      [DOCTOR_USER]
    );
    expect(result.rows[0]?.mode).toBe("anonymised");

    const profile = await db.query<{ first_name: string; email: string; phone: string | null; erased_at: string | null }>(
      "SELECT first_name, email, phone, erased_at::text AS erased_at FROM public.profiles WHERE id = $1",
      [DOCTOR_USER]
    );
    expect(profile.rows[0]?.first_name).toBe("Erased");
    expect(profile.rows[0]?.email).toBe(`erased+${DOCTOR_USER}@users.invalid`);
    expect(profile.rows[0]?.phone).toBeNull();
    expect(profile.rows[0]?.erased_at).toBeTruthy();

    const doctor = await db.query<Record<string, string | null | boolean>>(
      `SELECT is_active, verification_status, bio, address, clinic_name, slug, gmc_number, stripe_account_id,
              profile_video_path, gender, ics_feed_token
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
    expect(labs.rows[0]?.name).toBe("Erased location");
    expect(labs.rows[0]?.address).toBe("");
    expect(labs.rows[0]?.phone).toBeNull();
    expect(labs.rows[0]?.is_active).toBe(false);

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

  it("anonymises a patient who has a review and no prescription", async () => {
    const before = await deleteUser(REVIEWER);
    expect(before).toMatch(/23503|foreign key/i);

    const result = await db.query<ModeRow>(
      "SELECT (public.erase_account($1::uuid)->>'mode') AS mode",
      [REVIEWER]
    );
    expect(result.rows[0]?.mode).toBe("anonymised");

    const profile = await db.query<{ first_name: string; last_name: string; email: string; phone: string | null }>(
      "SELECT first_name, last_name, email, phone FROM public.profiles WHERE id = $1",
      [REVIEWER]
    );
    expect(profile.rows[0]?.first_name).toBe("Erased");
    expect(profile.rows[0]?.last_name).toBe("Account");
    expect(profile.rows[0]?.email).toBe(`erased+${REVIEWER}@users.invalid`);
    expect(profile.rows[0]?.phone).toBeNull();

    const review = await db.query<{ patient_id: string; comment: string }>(
      "SELECT patient_id::text, comment FROM public.reviews WHERE patient_id = $1",
      [REVIEWER]
    );
    expect(review.rows[0]).toMatchObject({
      patient_id: REVIEWER,
      comment: "keep-this-review",
    });

    const rx = await db.query<{ count: string }>(
      "SELECT count(*)::text AS count FROM public.prescriptions WHERE patient_id = $1",
      [REVIEWER]
    );
    expect(rx.rows[0]?.count).toBe("0");

    const stillBlocked = await deleteUser(REVIEWER);
    expect(stillBlocked).toMatch(/23503|foreign key/i);
  });

  it("anonymises a patient who only has a medical profile and keeps the clinical fields", async () => {
    const result = await db.query<ModeRow>(
      "SELECT (public.erase_account($1::uuid)->>'mode') AS mode",
      [CLINICAL]
    );
    expect(result.rows[0]?.mode).toBe("anonymised");

    const profile = await db.query<{ first_name: string; address_line1: string | null; erased_at: string | null }>(
      "SELECT first_name, address_line1, erased_at::text AS erased_at FROM public.profiles WHERE id = $1",
      [CLINICAL]
    );
    expect(profile.rows[0]?.first_name).toBe("Erased");
    expect(profile.rows[0]?.address_line1).toBeNull();
    expect(profile.rows[0]?.erased_at).toBeTruthy();

    const medical = await db.query<{
      patient_id: string;
      blood_type: string | null;
      notes: string | null;
      allergies: string[] | null;
      emergency_contact_name: string | null;
      emergency_contact_phone: string | null;
    }>(
      `SELECT patient_id::text, blood_type, notes, allergies, emergency_contact_name, emergency_contact_phone
       FROM public.medical_profiles WHERE patient_id = $1`,
      [CLINICAL]
    );
    expect(medical.rows).toHaveLength(1);
    expect(medical.rows[0]?.patient_id).toBe(CLINICAL);
    expect(medical.rows[0]?.blood_type).toBe("AB+");
    expect(medical.rows[0]?.notes).toBe("keep-clinical-note");
    expect(medical.rows[0]?.allergies).toEqual(["latex"]);
    expect(medical.rows[0]?.emergency_contact_name).toBeNull();
    expect(medical.rows[0]?.emergency_contact_phone).toBeNull();
  });

  it("returns hard_delete and still allows deleting a user with no prescriptions", async () => {
    await db.query(
      `INSERT INTO public.bookings (patient_id, doctor_id, status) VALUES ($1, $2, 'confirmed')`,
      [CLEAN, DOCTOR_ROW]
    );
    await expect(db.query("SELECT public.erase_account($1::uuid)", [CLEAN])).rejects.toThrow(
      /active_bookings/
    );
    const unchanged = await db.query<{ first_name: string; erased_at: string | null }>(
      "SELECT first_name, erased_at::text AS erased_at FROM public.profiles WHERE id = $1",
      [CLEAN]
    );
    expect(unchanged.rows[0]?.first_name).toBe("Clean");
    expect(unchanged.rows[0]?.erased_at).toBeNull();

    await db.query("DELETE FROM public.bookings WHERE patient_id = $1 AND status = 'confirmed'", [CLEAN]);

    const result = await db.query<ModeRow>(
      "SELECT (public.erase_account($1::uuid)->>'mode') AS mode",
      [CLEAN]
    );
    expect(result.rows[0]?.mode).toBe("hard_delete");
    const stillNamed = await db.query<{ first_name: string; email: string }>(
      "SELECT first_name, email FROM public.profiles WHERE id = $1",
      [CLEAN]
    );
    expect(stillNamed.rows[0]?.first_name).toBe("Clean");
    expect(stillNamed.rows[0]?.email).toBe("pip.clean@example.com");

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

  it("does not grant execute to anon or authenticated", async () => {
    for (const role of ["anon", "authenticated"] as const) {
      await db.exec("BEGIN");
      try {
        await db.exec(`SET LOCAL ROLE ${role}`);
        await expect(
          db.query("SELECT public.erase_account($1::uuid)", ["00000000-0000-0000-0000-000000000000"])
        ).rejects.toThrow(/permission denied|42501|forbidden/i);
      } finally {
        await db.exec("ROLLBACK");
      }
    }
  });
});
