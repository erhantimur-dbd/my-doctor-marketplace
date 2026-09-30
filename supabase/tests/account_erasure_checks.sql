-- Account erasure checks. Not a migration.
--
-- Dry run, after 00132 is applied in the same transaction:
--
--   BEGIN;
--   \i supabase/migrations/00132_account_erasure.sql
--   \i supabase/tests/account_erasure_checks.sql
--   ROLLBACK;
--
-- The script inserts fixture auth users. It always raises at the end so
-- those rows cannot be committed. A successful dry run ends with:
--   account erasure dry run PASSED
-- That exception is the rollback. Apply 00132 on its own after review.
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

DO $checks$
DECLARE
  v_patient uuid := gen_random_uuid();
  v_doctor_user uuid := gen_random_uuid();
  v_doctor_row uuid := gen_random_uuid();
  v_clean uuid := gen_random_uuid();
  v_busy uuid := gen_random_uuid();
  v_rx uuid := gen_random_uuid();
  v_audit uuid := gen_random_uuid();
  v_ready boolean := false;
  v_result jsonb;
  v_text text;
  v_count bigint;
  v_failed integer;
  v_summary text;
  v_case record;
  v_patient_email text;
  v_doctor_email text;
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
      );

    UPDATE public.profiles
    SET
      phone = '+447700900123',
      avatar_url = 'https://example.com/secret-avatar.jpg',
      address_line1 = '1 Secret Street',
      address_line2 = 'Flat 2',
      city = 'London',
      state = 'London',
      postal_code = 'SW1A 1AA',
      country = 'GB'
    WHERE id IN (v_patient, v_doctor_user);

    IF EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'auth' AND table_name = 'users' AND column_name = 'phone'
    ) THEN
      UPDATE auth.users SET phone = '+447700900123' WHERE id IN (v_patient, v_doctor_user);
    END IF;

    INSERT INTO public.doctors (
      id, profile_id, slug, bio, address, clinic_name, city, postal_code,
      is_active, verification_status, education, certifications,
      meta_title, meta_description, gender, profile_video_path,
      ics_feed_token, gmc_number, stripe_account_id, referral_code
    ) VALUES (
      v_doctor_row, v_doctor_user, 'pip-doctor-' || v_doctor_row::text,
      'Secret biography', '2 Clinic Road', 'Secret Clinic', 'Manchester', 'M1 1AE',
      true, 'verified',
      '[{"institution":"Secret College"}]'::jsonb,
      '[{"name":"Secret Cert"}]'::jsonb,
      'Dr Pip', 'A secret description', 'female', 'videos/secret.mp4',
      'ics-' || v_doctor_row::text, '7654321', 'acct_secret',
      'pip' || substr(replace(v_doctor_row::text, '-', ''), 1, 12)
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
        WHEN v_result->>'mode' IS DISTINCT FROM 'anonymised' THEN 'mode=' || COALESCE(v_result->>'mode', 'null')
        WHEN p.first_name IS DISTINCT FROM 'Erased' OR p.last_name IS DISTINCT FROM 'Account' THEN 'name'
        WHEN p.email IS DISTINCT FROM 'erased+' || v_patient::text || '@users.invalid' THEN 'profile email'
        WHEN p.phone IS NOT NULL OR p.avatar_url IS NOT NULL THEN 'phone or avatar'
        WHEN p.address_line1 IS NOT NULL OR p.city IS NOT NULL OR p.postal_code IS NOT NULL THEN 'address'
        WHEN p.erased_at IS NULL THEN 'erased_at'
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
        AND (d.first_name IS DISTINCT FROM 'Erased' OR d.date_of_birth IS NOT NULL OR d.notes IS NOT NULL)
    ) THEN
      v_text := 'dependent pii';
    END IF;
    IF v_text = '' AND EXISTS (
      SELECT 1 FROM public.medical_profiles m
      WHERE m.patient_id = v_patient
        AND (m.emergency_contact_name IS NOT NULL OR m.notes IS NOT NULL)
    ) THEN
      v_text := 'medical profile pii';
    END IF;
    IF v_text = '' AND EXISTS (SELECT 1 FROM public.push_subscriptions s WHERE s.user_id = v_patient) THEN
      v_text := 'push subscription';
    END IF;
    IF v_text = '' AND EXISTS (SELECT 1 FROM public.cookie_consents c WHERE c.user_id = v_patient) THEN
      v_text := 'cookie consent';
    END IF;

    PERFORM pg_temp.record_case(
      'patient_anonymised',
      CASE WHEN v_text = '' THEN 'PASS' ELSE 'FAIL' END,
      CASE WHEN v_text = '' THEN 'pii cleared, prescription and audit kept' ELSE v_text END
    );

    v_result := public.erase_account(v_doctor_user);
    SELECT
      CASE
        WHEN v_result->>'mode' IS DISTINCT FROM 'anonymised' THEN 'mode=' || COALESCE(v_result->>'mode', 'null')
        WHEN p.first_name IS DISTINCT FROM 'Erased' THEN 'name'
        WHEN p.email IS DISTINCT FROM 'erased+' || v_doctor_user::text || '@users.invalid' THEN 'email'
        WHEN p.phone IS NOT NULL OR p.avatar_url IS NOT NULL OR p.address_line1 IS NOT NULL THEN 'profile pii'
        WHEN p.erased_at IS NULL THEN 'erased_at'
        WHEN d.is_active IS DISTINCT FROM false OR d.verification_status IS DISTINCT FROM 'suspended' THEN 'listing'
        WHEN d.bio IS NOT NULL OR d.address IS NOT NULL OR d.clinic_name IS NOT NULL THEN 'public profile'
        WHEN d.slug IS DISTINCT FROM 'erased-' || d.id::text THEN 'slug'
        WHEN d.profile_video_path IS NOT NULL OR d.ics_feed_token IS NOT NULL THEN 'video or ics'
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

    PERFORM pg_temp.record_case(
      'doctor_anonymised',
      CASE WHEN COALESCE(v_text, 'missing') = '' THEN 'PASS' ELSE 'FAIL' END,
      CASE WHEN COALESCE(v_text, 'missing') = '' THEN 'listing unpublished, audit actor kept, gmc kept' ELSE COALESCE(v_text, 'missing') END
    );

    BEGIN
      DELETE FROM auth.users WHERE id = v_patient;
      PERFORM pg_temp.record_case('patient_still_blocked', 'FAIL', 'delete succeeded after anonymise');
    EXCEPTION
      WHEN foreign_key_violation THEN
        PERFORM pg_temp.record_case('patient_still_blocked', 'PASS', SQLERRM);
      WHEN OTHERS THEN
        PERFORM pg_temp.record_case('patient_still_blocked', 'FAIL', SQLSTATE || ' ' || SQLERRM);
    END;

    BEGIN
      DELETE FROM auth.users WHERE id = v_doctor_user;
      PERFORM pg_temp.record_case('doctor_still_blocked', 'FAIL', 'delete succeeded after anonymise');
    EXCEPTION
      WHEN foreign_key_violation THEN
        PERFORM pg_temp.record_case('doctor_still_blocked', 'PASS', SQLERRM);
      WHEN OTHERS THEN
        PERFORM pg_temp.record_case('doctor_still_blocked', 'FAIL', SQLSTATE || ' ' || SQLERRM);
    END;

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

  RAISE EXCEPTION E'account erasure dry run PASSED\n%\nThis exception aborts the transaction so fixture users are not kept. Apply 00132 on its own after review. Do not COMMIT.',
    v_summary;
END
$checks$;
