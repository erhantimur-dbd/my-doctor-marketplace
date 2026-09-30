-- Account erasure checks. Not a migration.
--
-- Dry run, after 00135 is applied in the same transaction:
--
--   BEGIN;
--   \i supabase/migrations/00135_account_erasure.sql
--   \i supabase/tests/account_erasure_checks.sql
--   ROLLBACK;
--
-- The script inserts fixture auth users. It always raises at the end so
-- those rows cannot be committed. A successful dry run ends with:
--   account erasure dry run PASSED
-- That exception is the rollback. Apply 00135 on its own after review.
-- Do not COMMIT this transaction.

DROP TABLE IF EXISTS account_erasure_check_results;
CREATE TEMP TABLE account_erasure_check_results (
  case_id text PRIMARY KEY,
  outcome text NOT NULL,
  detail text NOT NULL
);

CREATE OR REPLACE FUNCTION pg_temp.record_case(p_case text, p_outcome text, p_detail text)
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE NOTICE '% % — %', p_outcome, p_case, p_detail;
  INSERT INTO account_erasure_check_results (case_id, outcome, detail)
  VALUES (p_case, p_outcome, p_detail);
END;
$$;

CREATE OR REPLACE FUNCTION pg_temp.col_exists(p_schema text, p_table text, p_column text)
RETURNS boolean
LANGUAGE sql
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM pg_catalog.pg_attribute AS a
    JOIN pg_catalog.pg_class AS c ON c.oid = a.attrelid
    JOIN pg_catalog.pg_namespace AS n ON n.oid = c.relnamespace
    WHERE n.nspname = p_schema
      AND c.relname = p_table
      AND a.attname = p_column
      AND a.attnum > 0
      AND NOT a.attisdropped
  );
$$;

-- Unique digit phone from the user id. Prod rejects a shared phone
-- (users_phone_key, 23505).
CREATE OR REPLACE FUNCTION pg_temp.fixture_phone(p_id uuid)
RETURNS text
LANGUAGE sql
STABLE
AS $$
  SELECT '+44' || lpad(
    (
      (
        ('x' || substr(replace(p_id::text, '-', ''), 1, 12))::bit(48)::bigint
        % 10000000000
      )::text
    ),
    10,
    '0'
  );
$$;

DO $checks$
DECLARE
  v_patient uuid := gen_random_uuid();
  v_doctor_user uuid := gen_random_uuid();
  v_doctor_row uuid := gen_random_uuid();
  v_clean uuid := gen_random_uuid();
  v_busy uuid := gen_random_uuid();
  v_reviewer uuid := gen_random_uuid();
  v_clinical uuid := gen_random_uuid();
  v_shared uuid := gen_random_uuid();
  v_dispute uuid := gen_random_uuid();
  v_stripe uuid := gen_random_uuid();
  v_review_booking uuid := gen_random_uuid();
  v_rx uuid := gen_random_uuid();
  v_audit uuid := gen_random_uuid();
  v_ready boolean := false;
  v_ok boolean := false;
  v_result jsonb;
  v_text text;
  v_count bigint;
  v_failed integer;
  v_summary text;
  v_case record;
  v_patient_email text;
  v_doctor_email text;
  v_ins_cols text[] := ARRAY[]::text[];
  v_ins_vals text[] := ARRAY[]::text[];
  v_phone text;
BEGIN
  PERFORM set_config('request.jwt.claims', '{}', true);
  PERFORM set_config('request.jwt.claim.sub', '', true);
  PERFORM set_config('request.jwt.claim.role', '', true);

  -- anon and authenticated must not be able to execute the helper.
  FOREACH v_text IN ARRAY ARRAY['anon', 'authenticated']
  LOOP
    BEGIN
      EXECUTE format('SET LOCAL ROLE %I', v_text);
      BEGIN
        PERFORM public.erase_account('00000000-0000-0000-0000-000000000000');
        RESET ROLE;
        PERFORM pg_temp.record_case(v_text || '_execute', 'FAIL', 'role executed erase_account');
      EXCEPTION
        WHEN insufficient_privilege THEN
          RESET ROLE;
          PERFORM pg_temp.record_case(v_text || '_execute', 'PASS', SQLERRM);
        WHEN OTHERS THEN
          RESET ROLE;
          IF SQLSTATE = 'P0002' OR SQLERRM ILIKE '%user_not_found%' THEN
            PERFORM pg_temp.record_case(v_text || '_execute', 'FAIL', 'function body ran: ' || SQLERRM);
          ELSE
            PERFORM pg_temp.record_case(v_text || '_execute', 'FAIL', SQLSTATE || ' ' || SQLERRM);
          END IF;
      END;
    EXCEPTION
      WHEN insufficient_privilege THEN
        PERFORM pg_temp.record_case(v_text || '_execute', 'SKIP', SQLERRM);
      WHEN OTHERS THEN
        RESET ROLE;
        PERFORM pg_temp.record_case(v_text || '_execute', 'FAIL', SQLSTATE || ' ' || SQLERRM);
    END;
  END LOOP;

  BEGIN
    v_patient_email := 'pip-patient-' || v_patient::text || '@example.com';
    v_doctor_email := 'pip-doctor-' || v_doctor_user::text || '@example.com';

    INSERT INTO auth.users (
      id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
      raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
      confirmation_token, recovery_token, email_change, email_change_token_new,
      email_change_token_current, email_change_confirm_status, phone_change,
      phone_change_token, reauthentication_token, is_sso_user
    ) VALUES
      (
        v_patient, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
        v_patient_email, '', now(),
        '{"provider":"email","providers":["email"]}'::jsonb,
        jsonb_build_object('first_name', 'Pip', 'last_name', 'Patient', 'role', 'patient'),
        now(), now(), '', '', '', '', '', 0, '', '', '', false
      ),
      (
        v_doctor_user, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
        v_doctor_email, '', now(),
        '{"provider":"email","providers":["email"]}'::jsonb,
        jsonb_build_object('first_name', 'Pip', 'last_name', 'Doctor', 'role', 'doctor'),
        now(), now(), '', '', '', '', '', 0, '', '', '', false
      ),
      (
        v_clean, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
        'pip-clean-' || v_clean::text || '@example.com', '', now(),
        '{"provider":"email","providers":["email"]}'::jsonb,
        jsonb_build_object('first_name', 'Clean', 'last_name', 'User', 'role', 'patient'),
        now(), now(), '', '', '', '', '', 0, '', '', '', false
      ),
      (
        v_busy, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
        'pip-busy-' || v_busy::text || '@example.com', '', now(),
        '{"provider":"email","providers":["email"]}'::jsonb,
        jsonb_build_object('first_name', 'Busy', 'last_name', 'User', 'role', 'patient'),
        now(), now(), '', '', '', '', '', 0, '', '', '', false
      ),
      (
        v_reviewer, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
        'pip-reviewer-' || v_reviewer::text || '@example.com', '', now(),
        '{"provider":"email","providers":["email"]}'::jsonb,
        jsonb_build_object('first_name', 'Rita', 'last_name', 'Reviewer', 'role', 'patient'),
        now(), now(), '', '', '', '', '', 0, '', '', '', false
      ),
      (
        v_clinical, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
        'pip-clinical-' || v_clinical::text || '@example.com', '', now(),
        '{"provider":"email","providers":["email"]}'::jsonb,
        jsonb_build_object('first_name', 'Cara', 'last_name', 'Clinical', 'role', 'patient'),
        now(), now(), '', '', '', '', '', 0, '', '', '', false
      ),
      (
        v_shared, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
        'pip-shared-' || v_shared::text || '@example.com', '', now(),
        '{"provider":"email","providers":["email"]}'::jsonb,
        jsonb_build_object('first_name', 'Sam', 'last_name', 'Shared', 'role', 'patient'),
        now(), now(), '', '', '', '', '', 0, '', '', '', false
      ),
      (
        v_dispute, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
        'pip-dispute-' || v_dispute::text || '@example.com', '', now(),
        '{"provider":"email","providers":["email"]}'::jsonb,
        jsonb_build_object('first_name', 'Dee', 'last_name', 'Dispute', 'role', 'patient'),
        now(), now(), '', '', '', '', '', 0, '', '', '', false
      ),
      (
        v_stripe, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
        'pip-stripe-' || v_stripe::text || '@example.com', '', now(),
        '{"provider":"email","providers":["email"]}'::jsonb,
        jsonb_build_object('first_name', 'Sid', 'last_name', 'Stripe', 'role', 'patient'),
        now(), now(), '', '', '', '', '', 0, '', '', '', false
      );

    v_ins_cols := ARRAY[]::text[];
    v_ins_vals := ARRAY[]::text[];
    IF pg_temp.col_exists('public', 'profiles', 'phone') THEN
      v_ins_cols := v_ins_cols || 'phone = pg_temp.fixture_phone(id)';
    END IF;
    IF pg_temp.col_exists('public', 'profiles', 'avatar_url') THEN
      v_ins_cols := v_ins_cols || format('avatar_url = %L', 'https://example.com/secret-avatar.jpg');
    END IF;
    IF pg_temp.col_exists('public', 'profiles', 'address_line1') THEN
      v_ins_cols := v_ins_cols || format('address_line1 = %L', '1 Secret Street');
    END IF;
    IF pg_temp.col_exists('public', 'profiles', 'address_line2') THEN
      v_ins_cols := v_ins_cols || format('address_line2 = %L', 'Flat 2');
    END IF;
    IF pg_temp.col_exists('public', 'profiles', 'city') THEN
      v_ins_cols := v_ins_cols || format('city = %L', 'London');
    END IF;
    IF pg_temp.col_exists('public', 'profiles', 'state') THEN
      v_ins_cols := v_ins_cols || format('state = %L', 'London');
    END IF;
    IF pg_temp.col_exists('public', 'profiles', 'postal_code') THEN
      v_ins_cols := v_ins_cols || format('postal_code = %L', 'SW1A 1AA');
    END IF;
    IF pg_temp.col_exists('public', 'profiles', 'country') THEN
      v_ins_cols := v_ins_cols || format('country = %L', 'GB');
    END IF;
    IF cardinality(v_ins_cols) > 0 THEN
      EXECUTE format(
        'UPDATE public.profiles SET %s WHERE id IN (%L, %L)',
        array_to_string(v_ins_cols, ', '),
        v_patient,
        v_doctor_user
      );
    END IF;

    IF pg_temp.col_exists('auth', 'users', 'phone') THEN
      EXECUTE
        'UPDATE auth.users AS u SET phone = pg_temp.fixture_phone(u.id)
         WHERE u.id IN ($1, $2, $3, $4, $5, $6, $7, $8, $9)'
        USING v_patient, v_doctor_user, v_clean, v_busy, v_reviewer, v_clinical, v_shared, v_dispute, v_stripe;
    END IF;

    v_ins_cols := ARRAY[]::text[];
    v_ins_vals := ARRAY[]::text[];
    IF pg_temp.col_exists('public', 'doctors', 'id') THEN
      v_ins_cols := v_ins_cols || 'id';
      v_ins_vals := v_ins_vals || quote_literal(v_doctor_row);
    END IF;
    IF pg_temp.col_exists('public', 'doctors', 'profile_id') THEN
      v_ins_cols := v_ins_cols || 'profile_id';
      v_ins_vals := v_ins_vals || quote_literal(v_doctor_user);
    END IF;
    IF pg_temp.col_exists('public', 'doctors', 'slug') THEN
      v_ins_cols := v_ins_cols || 'slug';
      v_ins_vals := v_ins_vals || quote_literal('pip-doctor-' || v_doctor_row::text);
    END IF;
    IF pg_temp.col_exists('public', 'doctors', 'bio') THEN
      v_ins_cols := v_ins_cols || 'bio';
      v_ins_vals := v_ins_vals || quote_literal('Secret biography');
    END IF;
    IF pg_temp.col_exists('public', 'doctors', 'address') THEN
      v_ins_cols := v_ins_cols || 'address';
      v_ins_vals := v_ins_vals || quote_literal('2 Clinic Road');
    END IF;
    IF pg_temp.col_exists('public', 'doctors', 'clinic_name') THEN
      v_ins_cols := v_ins_cols || 'clinic_name';
      v_ins_vals := v_ins_vals || quote_literal('Secret Clinic');
    END IF;
    IF pg_temp.col_exists('public', 'doctors', 'city') THEN
      v_ins_cols := v_ins_cols || 'city';
      v_ins_vals := v_ins_vals || quote_literal('Manchester');
    END IF;
    IF pg_temp.col_exists('public', 'doctors', 'postal_code') THEN
      v_ins_cols := v_ins_cols || 'postal_code';
      v_ins_vals := v_ins_vals || quote_literal('M1 1AE');
    END IF;
    IF pg_temp.col_exists('public', 'doctors', 'is_active') THEN
      v_ins_cols := v_ins_cols || 'is_active';
      v_ins_vals := v_ins_vals || 'true';
    END IF;
    IF pg_temp.col_exists('public', 'doctors', 'verification_status') THEN
      v_ins_cols := v_ins_cols || 'verification_status';
      v_ins_vals := v_ins_vals || quote_literal('verified');
    END IF;
    IF pg_temp.col_exists('public', 'doctors', 'education') THEN
      v_ins_cols := v_ins_cols || 'education';
      v_ins_vals := v_ins_vals || quote_literal('[{"institution":"Secret College"}]') || '::jsonb';
    END IF;
    IF pg_temp.col_exists('public', 'doctors', 'certifications') THEN
      v_ins_cols := v_ins_cols || 'certifications';
      v_ins_vals := v_ins_vals || quote_literal('[{"name":"Secret Cert"}]') || '::jsonb';
    END IF;
    IF pg_temp.col_exists('public', 'doctors', 'meta_title') THEN
      v_ins_cols := v_ins_cols || 'meta_title';
      v_ins_vals := v_ins_vals || quote_literal('Dr Pip');
    END IF;
    IF pg_temp.col_exists('public', 'doctors', 'meta_description') THEN
      v_ins_cols := v_ins_cols || 'meta_description';
      v_ins_vals := v_ins_vals || quote_literal('A secret description');
    END IF;
    IF pg_temp.col_exists('public', 'doctors', 'gender') THEN
      v_ins_cols := v_ins_cols || 'gender';
      v_ins_vals := v_ins_vals || quote_literal('female');
    END IF;
    IF pg_temp.col_exists('public', 'doctors', 'profile_video_path') THEN
      v_ins_cols := v_ins_cols || 'profile_video_path';
      v_ins_vals := v_ins_vals || quote_literal('videos/secret.mp4');
    END IF;
    IF pg_temp.col_exists('public', 'doctors', 'profile_video_status') THEN
      v_ins_cols := v_ins_cols || 'profile_video_status';
      v_ins_vals := v_ins_vals || quote_literal('pending');
    END IF;
    IF pg_temp.col_exists('public', 'doctors', 'profile_video_rejection_reason') THEN
      v_ins_cols := v_ins_cols || 'profile_video_rejection_reason';
      v_ins_vals := v_ins_vals || quote_literal('too blurry');
    END IF;
    IF pg_temp.col_exists('public', 'doctors', 'ics_feed_token') THEN
      v_ins_cols := v_ins_cols || 'ics_feed_token';
      v_ins_vals := v_ins_vals || quote_literal('ics-' || v_doctor_row::text);
    END IF;
    IF pg_temp.col_exists('public', 'doctors', 'gmc_number') THEN
      v_ins_cols := v_ins_cols || 'gmc_number';
      v_ins_vals := v_ins_vals || quote_literal('7654321');
    END IF;
    IF pg_temp.col_exists('public', 'doctors', 'stripe_account_id') THEN
      v_ins_cols := v_ins_cols || 'stripe_account_id';
      v_ins_vals := v_ins_vals || quote_literal('acct_secret');
    END IF;
    IF pg_temp.col_exists('public', 'doctors', 'referral_code') THEN
      v_ins_cols := v_ins_cols || 'referral_code';
      v_ins_vals := v_ins_vals || quote_literal('pip' || substr(replace(v_doctor_row::text, '-', ''), 1, 12));
    END IF;
    EXECUTE format(
      'INSERT INTO public.doctors (%s) VALUES (%s)',
      (SELECT string_agg(quote_ident(c), ', ') FROM unnest(v_ins_cols) AS c),
      array_to_string(v_ins_vals, ', ')
    );

    INSERT INTO public.doctor_photos (doctor_id, storage_path)
    VALUES (v_doctor_row, 'public/doctor-photos/secret.jpg');

    INSERT INTO public.dependents (parent_id, first_name, last_name, date_of_birth, relationship, notes)
    VALUES (v_patient, 'Ada', 'Patient', '2018-06-01', 'child', 'child note');

    INSERT INTO public.medical_profiles (
      patient_id, emergency_contact_name, emergency_contact_phone, notes, blood_type
    ) VALUES (
      v_patient, 'Mum Secret', '+447700900999', 'private note', 'O+'
    );
    IF pg_temp.col_exists('public', 'medical_profiles', 'sharing_consent') THEN
      UPDATE public.medical_profiles SET sharing_consent = true WHERE patient_id = v_patient;
    END IF;

    INSERT INTO public.push_subscriptions (user_id, endpoint, p256dh, auth)
    VALUES (v_patient, 'https://push.example/' || v_patient::text, 'key', 'auth');

    INSERT INTO public.cookie_consents (user_id, analytics, marketing)
    VALUES (v_patient, true, false);

    INSERT INTO public.bookings (
      patient_id, doctor_id, appointment_date, start_time, end_time,
      consultation_type, status, currency,
      consultation_fee_cents, platform_fee_cents, total_amount_cents,
      patient_notes
    ) VALUES (
      v_patient, v_doctor_row, CURRENT_DATE, now(), now() + interval '30 minutes',
      'video', 'completed', 'GBP', 1000, 100, 1100, 'secret patient note'
    );

    INSERT INTO public.bookings (
      id, patient_id, doctor_id, appointment_date, start_time, end_time,
      consultation_type, status, currency,
      consultation_fee_cents, platform_fee_cents, total_amount_cents
    ) VALUES (
      v_review_booking, v_reviewer, v_doctor_row, CURRENT_DATE, now(), now() + interval '30 minutes',
      'video', 'completed', 'GBP', 1000, 100, 1100
    );

    INSERT INTO public.reviews (booking_id, patient_id, doctor_id, rating, comment)
    VALUES (v_review_booking, v_reviewer, v_doctor_row, 5, 'keep-this-review');

    INSERT INTO public.bookings (
      patient_id, doctor_id, appointment_date, start_time, end_time,
      consultation_type, status, currency,
      consultation_fee_cents, platform_fee_cents, total_amount_cents
    ) VALUES
      (
        v_shared, v_doctor_row, CURRENT_DATE, now(), now() + interval '30 minutes',
        'video', 'completed', 'GBP', 1000, 100, 1100
      ),
      (
        v_dispute, v_doctor_row, CURRENT_DATE, now(), now() + interval '30 minutes',
        'video', 'completed', 'GBP', 1000, 100, 1100
      ),
      (
        v_stripe, v_doctor_row, CURRENT_DATE, now(), now() + interval '30 minutes',
        'video', 'completed', 'GBP', 1000, 100, 1100
      );

    INSERT INTO public.medical_profiles (
      patient_id, emergency_contact_name, emergency_contact_phone, notes, blood_type
    ) VALUES (
      v_shared, 'Share Contact', '+447700900888', 'shared-clinical-note', 'A-'
    );
    IF pg_temp.col_exists('public', 'medical_profiles', 'sharing_consent') THEN
      UPDATE public.medical_profiles SET sharing_consent = true WHERE patient_id = v_shared;
    END IF;

    INSERT INTO public.reviews (booking_id, patient_id, doctor_id, rating, comment)
    SELECT b.id, b.patient_id, v_doctor_row, 4,
      CASE b.patient_id WHEN v_dispute THEN 'keep-under-dispute' ELSE 'keep-under-stripe' END
    FROM public.bookings AS b
    WHERE b.patient_id IN (v_dispute, v_stripe);

    IF pg_temp.col_exists('public', 'bookings', 'stripe_dispute_status') THEN
      UPDATE public.bookings SET stripe_dispute_status = 'needs_response' WHERE patient_id = v_stripe;
    END IF;

    IF to_regclass('public.payment_corrections') IS NOT NULL THEN
      INSERT INTO public.payment_corrections (
        party, patient_id, direction, amount_cents, currency, reason, error_type,
        booking_id, status, source, statement_line, disputed_at
      )
      SELECT
        'patient', v_dispute, 'customer_favour', 100, 'GBP', 'open dispute', 'fraud',
        b.id, 'disputed', 'webhook', 'dry-run', now()
      FROM public.bookings AS b
      WHERE b.patient_id = v_dispute;
    END IF;

    IF to_regclass('public.availability_alerts') IS NOT NULL THEN
      INSERT INTO public.availability_alerts (patient_id, doctor_id)
      VALUES (v_patient, v_doctor_row), (v_clean, v_doctor_row);
    END IF;
    IF to_regclass('public.specialty_waitlist') IS NOT NULL THEN
      INSERT INTO public.specialty_waitlist (specialty_slug, patient_id)
      VALUES ('dermatology', v_patient);
    END IF;
    IF to_regclass('public.doctor_waitlist') IS NOT NULL THEN
      INSERT INTO public.doctor_waitlist (name, email, specialty, country)
      VALUES ('Pip Doctor', v_doctor_email, 'gp', 'GB');
    END IF;
    IF to_regclass('public.launch_notifications') IS NOT NULL THEN
      INSERT INTO public.launch_notifications (name, email, region)
      VALUES ('Pip Patient', v_patient_email, 'london');
    END IF;

    INSERT INTO public.medical_profiles (
      patient_id, emergency_contact_name, emergency_contact_phone, notes, blood_type, allergies
    ) VALUES (
      v_clinical, 'Clinic Contact', '+447700900777', 'keep-clinical-note', 'AB+', ARRAY['latex']
    );

    INSERT INTO public.prescriptions (id, doctor_id, patient_id, diagnosis, notes)
    VALUES (v_rx, v_doctor_row, v_patient, 'keep-this-diagnosis', 'clinical note');

    INSERT INTO public.prescription_audit_log (
      id, prescription_id, event_type, actor_profile_id, snapshot
    ) VALUES (
      v_audit, v_rx, 'issued', v_doctor_user, '{"marker":"keep-audit"}'::jsonb
    );

    BEGIN
      INSERT INTO auth.identities (
        id, user_id, identity_data, provider, provider_id, last_sign_in_at, created_at, updated_at
      ) VALUES (
        v_patient, v_patient,
        jsonb_build_object('sub', v_patient::text, 'email', v_patient_email),
        'email', v_patient_email, now(), now(), now()
      );
    EXCEPTION
      WHEN not_null_violation THEN
        EXECUTE
          'INSERT INTO auth.identities (id, user_id, identity_data, provider, provider_id, email, last_sign_in_at, created_at, updated_at)
           VALUES ($1, $1, $2, ''email'', $3, $3, now(), now(), now())'
          USING v_patient, jsonb_build_object('sub', v_patient::text, 'email', v_patient_email), v_patient_email;
    END;

    v_ready := true;
    PERFORM pg_temp.record_case('fixture_setup', 'PASS', 'patient, doctor, clean, and busy users');
  EXCEPTION
    WHEN OTHERS THEN
      PERFORM pg_temp.record_case('fixture_setup', 'FAIL', SQLSTATE || ' ' || SQLERRM);
      v_ready := false;
  END;

  IF v_ready THEN
    BEGIN
      DELETE FROM auth.users WHERE id = v_patient;
      PERFORM pg_temp.record_case('patient_delete_blocked', 'FAIL', 'delete succeeded');
    EXCEPTION
      WHEN foreign_key_violation THEN
        PERFORM pg_temp.record_case('patient_delete_blocked', 'PASS', SQLERRM);
      WHEN OTHERS THEN
        PERFORM pg_temp.record_case('patient_delete_blocked', 'FAIL', SQLSTATE || ' ' || SQLERRM);
    END;

    BEGIN
      DELETE FROM auth.users WHERE id = v_doctor_user;
      PERFORM pg_temp.record_case('doctor_delete_blocked', 'FAIL', 'delete succeeded');
    EXCEPTION
      WHEN foreign_key_violation THEN
        PERFORM pg_temp.record_case('doctor_delete_blocked', 'PASS', SQLERRM);
      WHEN OTHERS THEN
        PERFORM pg_temp.record_case('doctor_delete_blocked', 'FAIL', SQLSTATE || ' ' || SQLERRM);
    END;

    v_result := public.erase_account(v_patient);
    SELECT
      CASE
        WHEN v_result->>'mode' IS DISTINCT FROM 'restricted' THEN 'mode=' || COALESCE(v_result->>'mode', 'null')
        WHEN p.first_name IS DISTINCT FROM '' OR p.last_name IS DISTINCT FROM '' THEN 'name'
        WHEN p.email IS DISTINCT FROM 'erased+' || v_patient::text || '@users.invalid' THEN 'profile email'
        WHEN p.phone IS NOT NULL OR p.avatar_url IS NOT NULL THEN 'phone or avatar'
        WHEN p.address_line1 IS NOT NULL OR p.city IS NOT NULL OR p.postal_code IS NOT NULL THEN 'address'
        WHEN p.restricted_at IS NULL THEN 'restricted_at'
        WHEN u.email IS DISTINCT FROM p.email THEN 'auth email'
        WHEN u.banned_until IS NULL THEN 'banned_until'
        WHEN u.phone IS NOT NULL THEN 'auth phone'
        WHEN rx.id IS NULL OR rx.diagnosis IS DISTINCT FROM 'keep-this-diagnosis' THEN 'prescription'
        WHEN rx.patient_id IS DISTINCT FROM v_patient OR rx.doctor_id IS DISTINCT FROM v_doctor_row THEN 'prescription link'
        WHEN a.id IS NULL OR a.actor_profile_id IS DISTINCT FROM v_doctor_user THEN 'audit row'
        WHEN a.snapshot->>'marker' IS DISTINCT FROM 'keep-audit' THEN 'audit snapshot'
        WHEN EXISTS (SELECT 1 FROM public.bookings b WHERE b.patient_id = v_patient AND b.patient_notes IS NOT NULL) THEN 'patient_notes'
        WHEN NOT EXISTS (SELECT 1 FROM public.doctor_photos ph WHERE ph.doctor_id = v_doctor_row) THEN 'doctor photo removed during patient erase'
        ELSE ''
      END
    INTO v_text
    FROM public.profiles p
    JOIN auth.users u ON u.id = p.id
    JOIN public.prescriptions rx ON rx.id = v_rx
    JOIN public.prescription_audit_log a ON a.id = v_audit
    WHERE p.id = v_patient;

    IF v_text IS NULL THEN
      v_text := 'missing joined row';
    END IF;
    IF v_text = '' AND EXISTS (
      SELECT 1 FROM public.dependents d
      WHERE d.parent_id = v_patient
        AND (d.first_name IS DISTINCT FROM '' OR d.date_of_birth IS NOT NULL OR d.notes IS NOT NULL)
    ) THEN
      v_text := 'dependent pii';
    END IF;
    IF v_text = '' AND EXISTS (
      SELECT 1 FROM public.medical_profiles m
      WHERE m.patient_id = v_patient
        AND (
          m.emergency_contact_name IS NOT NULL
          OR m.emergency_contact_phone IS NOT NULL
          OR m.notes IS DISTINCT FROM 'private note'
          OR m.blood_type IS DISTINCT FROM 'O+'
        )
    ) THEN
      v_text := 'medical profile';
    END IF;
    IF v_text = '' AND to_regclass('auth.identities') IS NOT NULL AND EXISTS (
      SELECT 1 FROM auth.identities i WHERE i.user_id = v_patient
    ) THEN
      v_text := 'identity';
    END IF;
    IF v_text = '' AND to_regclass('auth.sessions') IS NOT NULL AND EXISTS (
      SELECT 1 FROM auth.sessions s WHERE s.user_id = v_patient
    ) THEN
      v_text := 'session';
    END IF;
    IF v_text = '' AND EXISTS (SELECT 1 FROM public.push_subscriptions s WHERE s.user_id = v_patient) THEN
      v_text := 'push subscription';
    END IF;
    IF v_text = '' AND EXISTS (SELECT 1 FROM public.cookie_consents c WHERE c.user_id = v_patient) THEN
      v_text := 'cookie consent';
    END IF;
    IF v_text = '' AND to_regclass('public.availability_alerts') IS NOT NULL AND EXISTS (
      SELECT 1 FROM public.availability_alerts a WHERE a.patient_id = v_patient
    ) THEN
      v_text := 'availability alert';
    END IF;
    IF v_text = '' AND to_regclass('public.specialty_waitlist') IS NOT NULL AND EXISTS (
      SELECT 1 FROM public.specialty_waitlist w WHERE w.patient_id = v_patient
    ) THEN
      v_text := 'specialty waitlist';
    END IF;
    IF v_text = '' AND to_regclass('public.launch_notifications') IS NOT NULL AND EXISTS (
      SELECT 1 FROM public.launch_notifications n WHERE lower(n.email) = lower(v_patient_email)
    ) THEN
      v_text := 'launch notification';
    END IF;

    PERFORM pg_temp.record_case(
      'patient_restricted',
      CASE WHEN v_text = '' THEN 'PASS' ELSE 'FAIL' END,
      CASE WHEN v_text = '' THEN 'pii cleared, prescription and audit kept' ELSE v_text END
    );

    v_result := public.erase_account(v_doctor_user);
    SELECT
      CASE
        WHEN v_result->>'mode' IS DISTINCT FROM 'restricted' THEN 'mode=' || COALESCE(v_result->>'mode', 'null')
        WHEN p.first_name IS DISTINCT FROM '' THEN 'name'
        WHEN p.email IS DISTINCT FROM 'erased+' || v_doctor_user::text || '@users.invalid' THEN 'email'
        WHEN p.phone IS NOT NULL OR p.avatar_url IS NOT NULL OR p.address_line1 IS NOT NULL THEN 'profile pii'
        WHEN p.restricted_at IS NULL THEN 'restricted_at'
        WHEN d.is_active IS DISTINCT FROM false OR d.verification_status IS DISTINCT FROM 'suspended' THEN 'listing'
        WHEN d.bio IS NOT NULL OR d.address IS NOT NULL OR d.clinic_name IS NOT NULL THEN 'public profile'
        WHEN d.slug IS DISTINCT FROM 'erased-' || d.id::text THEN 'slug'
        WHEN d.ics_feed_token IS NOT NULL THEN 'ics'
        WHEN d.gmc_number IS DISTINCT FROM '7654321' OR d.stripe_account_id IS DISTINCT FROM 'acct_secret' THEN 'regulatory id changed'
        WHEN EXISTS (SELECT 1 FROM public.doctor_photos ph WHERE ph.doctor_id = d.id) THEN 'photo'
        WHEN rx.doctor_id IS DISTINCT FROM v_doctor_row OR a.actor_profile_id IS DISTINCT FROM v_doctor_user THEN 'links'
        WHEN u.banned_until IS NULL THEN 'banned_until'
        ELSE ''
      END
    INTO v_text
    FROM public.profiles p
    JOIN auth.users u ON u.id = p.id
    JOIN public.doctors d ON d.profile_id = p.id
    JOIN public.prescriptions rx ON rx.id = v_rx
    JOIN public.prescription_audit_log a ON a.id = v_audit
    WHERE p.id = v_doctor_user;

    IF COALESCE(v_text, '') = '' AND pg_temp.col_exists('public', 'doctors', 'profile_video_path') THEN
      EXECUTE 'SELECT profile_video_path IS NULL FROM public.doctors WHERE id = $1'
        INTO v_ok USING v_doctor_row;
      IF NOT COALESCE(v_ok, false) THEN
        v_text := 'profile_video_path';
      END IF;
    END IF;
    IF COALESCE(v_text, '') = '' AND pg_temp.col_exists('public', 'doctors', 'gender') THEN
      EXECUTE 'SELECT gender IS NULL FROM public.doctors WHERE id = $1'
        INTO v_ok USING v_doctor_row;
      IF NOT COALESCE(v_ok, false) THEN
        v_text := 'gender';
      END IF;
    END IF;
    IF COALESCE(v_text, '') = '' AND to_regclass('public.doctor_waitlist') IS NOT NULL AND EXISTS (
      SELECT 1 FROM public.doctor_waitlist w WHERE lower(w.email) = lower(v_doctor_email)
    ) THEN
      v_text := 'doctor waitlist';
    END IF;

    PERFORM pg_temp.record_case(
      'doctor_restricted',
      CASE WHEN COALESCE(v_text, 'missing') = '' THEN 'PASS' ELSE 'FAIL' END,
      CASE WHEN COALESCE(v_text, 'missing') = '' THEN 'listing unpublished, audit actor kept, gmc kept' ELSE COALESCE(v_text, 'missing') END
    );

    BEGIN
      DELETE FROM auth.users WHERE id = v_patient;
      PERFORM pg_temp.record_case('patient_still_blocked', 'FAIL', 'delete succeeded after restrict');
    EXCEPTION
      WHEN foreign_key_violation THEN
        PERFORM pg_temp.record_case('patient_still_blocked', 'PASS', SQLERRM);
      WHEN OTHERS THEN
        PERFORM pg_temp.record_case('patient_still_blocked', 'FAIL', SQLSTATE || ' ' || SQLERRM);
    END;

    BEGIN
      DELETE FROM auth.users WHERE id = v_doctor_user;
      PERFORM pg_temp.record_case('doctor_still_blocked', 'FAIL', 'delete succeeded after restrict');
    EXCEPTION
      WHEN foreign_key_violation THEN
        PERFORM pg_temp.record_case('doctor_still_blocked', 'PASS', SQLERRM);
      WHEN OTHERS THEN
        PERFORM pg_temp.record_case('doctor_still_blocked', 'FAIL', SQLSTATE || ' ' || SQLERRM);
    END;

    v_result := public.erase_account(v_reviewer);
    SELECT
      CASE
        WHEN v_result->>'mode' IS DISTINCT FROM 'restricted' THEN 'mode=' || COALESCE(v_result->>'mode', 'null')
        WHEN p.first_name IS DISTINCT FROM '' OR p.last_name IS DISTINCT FROM '' THEN 'name'
        WHEN r.comment IS NOT NULL THEN 'review text'
        WHEN r.rating IS DISTINCT FROM 5 THEN 'rating'
        WHEN r.patient_id IS DISTINCT FROM v_reviewer THEN 'review link'
        WHEN EXISTS (SELECT 1 FROM public.prescriptions rx WHERE rx.patient_id = v_reviewer) THEN 'unexpected prescription'
        ELSE ''
      END
    INTO v_text
    FROM public.profiles p
    JOIN public.reviews r ON r.patient_id = p.id
    WHERE p.id = v_reviewer;
    PERFORM pg_temp.record_case(
      'review_without_prescription',
      CASE WHEN COALESCE(v_text, 'missing') = '' THEN 'PASS' ELSE 'FAIL' END,
      CASE WHEN COALESCE(v_text, 'missing') = '' THEN 'rating kept, text removed, no author name' ELSE COALESCE(v_text, 'missing') END
    );

    BEGIN
      DELETE FROM auth.users WHERE id = v_reviewer;
      PERFORM pg_temp.record_case('review_still_blocked', 'FAIL', 'delete succeeded');
    EXCEPTION
      WHEN foreign_key_violation THEN
        PERFORM pg_temp.record_case('review_still_blocked', 'PASS', SQLERRM);
      WHEN OTHERS THEN
        PERFORM pg_temp.record_case('review_still_blocked', 'FAIL', SQLSTATE || ' ' || SQLERRM);
    END;

    v_result := public.erase_account(v_clinical);
    SELECT count(*) INTO v_count FROM public.medical_profiles WHERE patient_id = v_clinical;
    SELECT p.first_name INTO v_text FROM public.profiles p WHERE p.id = v_clinical;
    PERFORM pg_temp.record_case(
      'unshared_medical_hard_delete',
      CASE
        WHEN v_result->>'mode' = 'hard_delete' AND v_count = 0 AND v_text = 'Cara' THEN 'PASS'
        ELSE 'FAIL'
      END,
      COALESCE(v_result->>'mode', 'null') || ' medical=' || v_count::text || ' name=' || COALESCE(v_text, 'null')
    );

    v_result := public.erase_account(v_shared);
    SELECT
      CASE
        WHEN v_result->>'mode' IS DISTINCT FROM 'restricted' THEN 'mode=' || COALESCE(v_result->>'mode', 'null')
        WHEN p.first_name IS DISTINCT FROM '' THEN 'name'
        WHEN m.patient_id IS DISTINCT FROM v_shared THEN 'medical link'
        WHEN m.notes IS DISTINCT FROM 'shared-clinical-note' OR m.blood_type IS DISTINCT FROM 'A-' THEN 'clinical fields'
        WHEN m.emergency_contact_name IS NOT NULL OR m.emergency_contact_phone IS NOT NULL THEN 'emergency contact'
        ELSE ''
      END
    INTO v_text
    FROM public.profiles p
    JOIN public.medical_profiles m ON m.patient_id = p.id
    WHERE p.id = v_shared;
    PERFORM pg_temp.record_case(
      'shared_medical_restricted',
      CASE WHEN COALESCE(v_text, 'missing') = '' THEN 'PASS' ELSE 'FAIL' END,
      CASE WHEN COALESCE(v_text, 'missing') = '' THEN 'shared clinical row kept, contact scrubbed' ELSE COALESCE(v_text, 'missing') END
    );

    v_result := public.erase_account(v_dispute);
    SELECT
      CASE
        WHEN v_result->>'mode' IS DISTINCT FROM 'restricted' THEN 'mode=' || COALESCE(v_result->>'mode', 'null')
        WHEN r.comment IS DISTINCT FROM 'keep-under-dispute' THEN 'review text'
        WHEN r.rating IS DISTINCT FROM 4 THEN 'rating'
        ELSE ''
      END
    INTO v_text
    FROM public.reviews r
    WHERE r.patient_id = v_dispute;
    PERFORM pg_temp.record_case(
      'review_text_kept_open_dispute',
      CASE WHEN COALESCE(v_text, 'missing') = '' THEN 'PASS' ELSE 'FAIL' END,
      CASE WHEN COALESCE(v_text, 'missing') = '' THEN 'payment correction dispute keeps the text' ELSE COALESCE(v_text, 'missing') END
    );

    v_result := public.erase_account(v_stripe);
    SELECT
      CASE
        WHEN v_result->>'mode' IS DISTINCT FROM 'restricted' THEN 'mode=' || COALESCE(v_result->>'mode', 'null')
        WHEN r.comment IS DISTINCT FROM 'keep-under-stripe' THEN 'review text'
        WHEN r.rating IS DISTINCT FROM 4 THEN 'rating'
        ELSE ''
      END
    INTO v_text
    FROM public.reviews r
    WHERE r.patient_id = v_stripe;
    PERFORM pg_temp.record_case(
      'review_text_kept_stripe_dispute',
      CASE WHEN COALESCE(v_text, 'missing') = '' THEN 'PASS' ELSE 'FAIL' END,
      CASE WHEN COALESCE(v_text, 'missing') = '' THEN 'open stripe dispute keeps the text' ELSE COALESCE(v_text, 'missing') END
    );

    v_result := public.erase_account(v_clean);
    SELECT p.first_name INTO v_text FROM public.profiles p WHERE p.id = v_clean;
    PERFORM pg_temp.record_case(
      'no_prescriptions_hard_delete',
      CASE
        WHEN v_result->>'mode' = 'hard_delete' AND v_text = 'Clean' THEN 'PASS'
        ELSE 'FAIL'
      END,
      COALESCE(v_result::text, 'null') || ' name=' || COALESCE(v_text, 'null')
    );
    IF to_regclass('public.availability_alerts') IS NOT NULL AND EXISTS (
      SELECT 1 FROM public.availability_alerts a WHERE a.patient_id = v_clean
    ) THEN
      PERFORM pg_temp.record_case('hard_delete_waitlist', 'FAIL', 'availability alert remained');
    ELSE
      PERFORM pg_temp.record_case('hard_delete_waitlist', 'PASS', 'waitlist and login ephemera cleared before auth delete');
    END IF;

    BEGIN
      DELETE FROM auth.users WHERE id = v_clean;
      SELECT count(*) INTO v_count FROM public.profiles WHERE id = v_clean;
      PERFORM pg_temp.record_case(
        'no_prescriptions_auth_delete',
        CASE WHEN v_count = 0 THEN 'PASS' ELSE 'FAIL' END,
        'profiles left=' || v_count::text
      );
    EXCEPTION
      WHEN OTHERS THEN
        PERFORM pg_temp.record_case('no_prescriptions_auth_delete', 'FAIL', SQLSTATE || ' ' || SQLERRM);
    END;

    INSERT INTO public.bookings (
      patient_id, doctor_id, appointment_date, start_time, end_time,
      consultation_type, status, currency,
      consultation_fee_cents, platform_fee_cents, total_amount_cents
    ) VALUES (
      v_busy, v_doctor_row, CURRENT_DATE, now(), now() + interval '30 minutes',
      'video', 'confirmed', 'GBP', 1000, 100, 1100
    );

    BEGIN
      PERFORM public.erase_account(v_busy);
      PERFORM pg_temp.record_case('active_bookings_block', 'FAIL', 'erase succeeded');
    EXCEPTION
      WHEN OTHERS THEN
        PERFORM pg_temp.record_case(
          'active_bookings_block',
          CASE WHEN SQLERRM ILIKE '%active_bookings%' THEN 'PASS' ELSE 'FAIL' END,
          SQLSTATE || ' ' || SQLERRM
        );
    END;

    SELECT count(*) INTO v_count
    FROM public.prescriptions
    WHERE id = v_rx;
    PERFORM pg_temp.record_case(
      'prescription_still_present',
      CASE WHEN v_count = 1 THEN 'PASS' ELSE 'FAIL' END,
      'count=' || v_count::text
    );
  END IF;

  SELECT count(*) INTO v_failed
  FROM account_erasure_check_results
  WHERE outcome NOT IN ('PASS', 'SKIP');

  v_summary := '';
  FOR v_case IN
    SELECT case_id, outcome, detail
    FROM account_erasure_check_results
    ORDER BY case_id
  LOOP
    v_summary := v_summary || v_case.outcome || ' ' || v_case.case_id || ' — ' || v_case.detail || E'\n';
  END LOOP;

  IF v_failed > 0 THEN
    RAISE EXCEPTION E'account erasure dry run FAILED (% case(s))\n%\nTransaction aborted. Do not COMMIT.',
      v_failed, v_summary;
  END IF;

  RAISE EXCEPTION E'account erasure dry run PASSED\n%\nThis exception aborts the transaction so fixture users are not kept. Apply 00135 on its own after review. Do not COMMIT.',
    v_summary;
END
$checks$;
