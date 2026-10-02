-- Gap checks for 00141_account_erasure_gaps.sql. Not a migration.
--
-- Dry run, after 00135 and 00141 are applied:
--
--   BEGIN;
--   \i supabase/tests/account_erasure_gap_checks.sql
--   ROLLBACK;
--
-- The script inserts fixture auth users. It always raises at the end so
-- those rows cannot be committed. A successful dry run ends with text
-- that starts "account erasure dry run PASSED". Do not COMMIT.

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

CREATE OR REPLACE FUNCTION pg_temp.gap_user(p_id uuid, p_label text, p_role text, p_first text)
RETURNS void
LANGUAGE plpgsql
AS $gap_user$
BEGIN
  INSERT INTO auth.users (
    id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
    raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
    confirmation_token, recovery_token, email_change, email_change_token_new,
    email_change_token_current, email_change_confirm_status, phone_change,
    phone_change_token, reauthentication_token, is_sso_user
  ) VALUES (
    p_id, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
    'gap-' || p_label || '-' || p_id::text || '@example.com', '', now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    jsonb_build_object('first_name', p_first, 'last_name', 'Gap', 'role', p_role),
    now(), now(), '', '', '', '', '', 0, '', '', '', false
  );
  IF pg_temp.col_exists('auth', 'users', 'phone') THEN
    UPDATE auth.users AS u
    SET phone = pg_temp.fixture_phone(u.id)
    WHERE u.id = p_id;
  END IF;
END;
$gap_user$;

CREATE OR REPLACE FUNCTION pg_temp.gap_doctor(p_user uuid, p_doctor uuid)
RETURNS void
LANGUAGE plpgsql
AS $gap_doctor$
BEGIN
  INSERT INTO public.doctors (id, profile_id, slug)
  VALUES (p_doctor, p_user, 'gap-doc-' || replace(p_doctor::text, '-', ''));
END;
$gap_doctor$;

CREATE OR REPLACE FUNCTION pg_temp.gap_org(
  p_org uuid,
  p_name text,
  p_email text
)
RETURNS void
LANGUAGE plpgsql
AS $gap_org$
DECLARE
  v_sets text[] := ARRAY[]::text[];
BEGIN
  INSERT INTO public.organizations (id, name, slug, email, phone)
  VALUES (
    p_org,
    p_name,
    'gap-org-' || replace(p_org::text, '-', ''),
    p_email,
    '+447700900222'
  );
  IF pg_temp.col_exists('public', 'organizations', 'brand_display_name') THEN
    v_sets := array_append(v_sets, (format('%I = %L', 'brand_display_name', 'Secret Brand'))::text);
  END IF;
  IF pg_temp.col_exists('public', 'organizations', 'brand_support_email') THEN
    v_sets := array_append(v_sets, (format('%I = %L', 'brand_support_email', 'desk@clinic.test'))::text);
  END IF;
  IF pg_temp.col_exists('public', 'organizations', 'brand_support_phone') THEN
    v_sets := array_append(v_sets, (format('%I = %L', 'brand_support_phone', '+447700900333'))::text);
  END IF;
  IF cardinality(v_sets) > 0 THEN
    EXECUTE format(
      'UPDATE public.organizations SET %s WHERE id = $1',
      array_to_string(v_sets, ', ')
    ) USING p_org;
  END IF;
END;
$gap_org$;

DO $gap_checks$
DECLARE
  v_clinic_user uuid := gen_random_uuid();
  v_clinic_doctor uuid := gen_random_uuid();
  v_user uuid;
  v_doctor uuid;
  v_other uuid;
  v_patient uuid;
  v_org uuid;
  v_booking uuid;
  v_conversation uuid;
  v_result jsonb;
  v_text text;
  v_name text;
  v_email text;
  v_status text;
  v_slug text;
  v_count bigint;
  v_failed integer;
  v_summary text;
  v_case record;
  v_brand text;
BEGIN
  PERFORM set_config('request.jwt.claims', '{}', true);
  PERFORM set_config('request.jwt.claim.sub', '', true);
  PERFORM set_config('request.jwt.claim.role', '', true);

  FOREACH v_text IN ARRAY ARRAY['anon', 'authenticated']
  LOOP
    BEGIN
      EXECUTE format('SET LOCAL ROLE %I', v_text);
      BEGIN
        PERFORM public.erase_account('00000000-0000-0000-0000-000000000000');
        RESET ROLE;
        PERFORM pg_temp.record_case('gap_' || v_text || '_execute', 'FAIL', 'role executed erase_account');
      EXCEPTION
        WHEN insufficient_privilege THEN
          RESET ROLE;
          PERFORM pg_temp.record_case('gap_' || v_text || '_execute', 'PASS', SQLERRM);
        WHEN OTHERS THEN
          RESET ROLE;
          IF SQLSTATE = 'P0002' OR SQLERRM ILIKE '%user_not_found%' THEN
            PERFORM pg_temp.record_case('gap_' || v_text || '_execute', 'FAIL', 'function body ran: ' || SQLERRM);
          ELSE
            PERFORM pg_temp.record_case('gap_' || v_text || '_execute', 'FAIL', SQLSTATE || ' ' || SQLERRM);
          END IF;
      END;
    EXCEPTION
      WHEN insufficient_privilege THEN
        PERFORM pg_temp.record_case('gap_' || v_text || '_execute', 'SKIP', SQLERRM);
      WHEN OTHERS THEN
        RESET ROLE;
        PERFORM pg_temp.record_case('gap_' || v_text || '_execute', 'FAIL', SQLSTATE || ' ' || SQLERRM);
    END;
  END LOOP;

  PERFORM pg_temp.gap_user(v_clinic_user, 'clinic', 'doctor', 'Clinic');
  PERFORM pg_temp.gap_doctor(v_clinic_user, v_clinic_doctor);

  -- Cancelled subscription is retained, not blocked.
  BEGIN
    v_user := gen_random_uuid();
    v_doctor := gen_random_uuid();
    PERFORM pg_temp.gap_user(v_user, 'sub-cancel', 'doctor', 'Cancel');
    PERFORM pg_temp.gap_doctor(v_user, v_doctor);
    INSERT INTO public.doctor_subscriptions (
      doctor_id, stripe_subscription_id, stripe_customer_id, plan_id, status,
      current_period_start, current_period_end
    ) VALUES (
      v_doctor, 'sub_cancel_' || v_doctor::text, 'cus_cancel_' || v_doctor::text,
      'plan_gap', 'cancelled', now(), now() + interval '30 days'
    );
    v_result := public.erase_account(v_user);
    SELECT count(*) INTO v_count
    FROM public.doctor_subscriptions
    WHERE doctor_id = v_doctor;
    SELECT p.first_name INTO v_name FROM public.profiles AS p WHERE p.id = v_user;
    v_text := '';
    IF v_result->>'mode' IS DISTINCT FROM 'restricted' THEN
      v_text := 'mode=' || coalesce(v_result->>'mode', 'null');
    ELSIF v_count <> 1 THEN
      v_text := 'subscription deleted';
    ELSIF v_name IS DISTINCT FROM '' THEN
      v_text := 'name not scrubbed';
    END IF;
    PERFORM pg_temp.record_case(
      'gap_cancelled_subscription',
      CASE WHEN v_text = '' THEN 'PASS' ELSE 'FAIL' END,
      CASE WHEN v_text = '' THEN 'restricted, subscription kept' ELSE v_text END
    );
  EXCEPTION
    WHEN OTHERS THEN
      PERFORM pg_temp.record_case('gap_cancelled_subscription', 'FAIL', SQLSTATE || ' ' || SQLERRM);
  END;

  -- Invoice kept for tax.
  BEGIN
    v_user := gen_random_uuid();
    PERFORM pg_temp.gap_user(v_user, 'invoice', 'patient', 'Invoice');
    INSERT INTO public.invoices (invoice_number, doctor_id, patient_id, due_date)
    VALUES (
      'GAP-INV-' || substr(replace(v_user::text, '-', ''), 1, 12),
      v_clinic_doctor,
      v_user,
      CURRENT_DATE
    );
    v_result := public.erase_account(v_user);
    SELECT count(*) INTO v_count FROM public.invoices WHERE patient_id = v_user;
    v_text := '';
    IF v_result->>'mode' IS DISTINCT FROM 'restricted' THEN
      v_text := 'mode=' || coalesce(v_result->>'mode', 'null');
    ELSIF v_count <> 1 THEN
      v_text := 'invoice deleted';
    END IF;
    PERFORM pg_temp.record_case(
      'gap_invoice',
      CASE WHEN v_text = '' THEN 'PASS' ELSE 'FAIL' END,
      CASE WHEN v_text = '' THEN 'restricted, invoice kept' ELSE v_text END
    );
  EXCEPTION
    WHEN OTHERS THEN
      PERFORM pg_temp.record_case('gap_invoice', 'FAIL', SQLSTATE || ' ' || SQLERRM);
  END;

  -- Doctor invoice, same rule on doctor_id.
  BEGIN
    v_user := gen_random_uuid();
    v_doctor := gen_random_uuid();
    v_patient := gen_random_uuid();
    PERFORM pg_temp.gap_user(v_user, 'inv-doc', 'doctor', 'Invoicer');
    PERFORM pg_temp.gap_doctor(v_user, v_doctor);
    PERFORM pg_temp.gap_user(v_patient, 'inv-pat', 'patient', 'Payer');
    INSERT INTO public.invoices (invoice_number, doctor_id, patient_id, due_date)
    VALUES (
      'GAP-INVD-' || substr(replace(v_user::text, '-', ''), 1, 12),
      v_doctor,
      v_patient,
      CURRENT_DATE
    );
    v_result := public.erase_account(v_user);
    SELECT count(*) INTO v_count FROM public.invoices WHERE doctor_id = v_doctor;
    v_text := '';
    IF v_result->>'mode' IS DISTINCT FROM 'restricted' THEN
      v_text := 'mode=' || coalesce(v_result->>'mode', 'null');
    ELSIF v_count <> 1 THEN
      v_text := 'doctor invoice deleted';
    END IF;
    PERFORM pg_temp.record_case(
      'gap_doctor_invoice',
      CASE WHEN v_text = '' THEN 'PASS' ELSE 'FAIL' END,
      CASE WHEN v_text = '' THEN 'restricted, doctor invoice kept' ELSE v_text END
    );
  EXCEPTION
    WHEN OTHERS THEN
      PERFORM pg_temp.record_case('gap_doctor_invoice', 'FAIL', SQLSTATE || ' ' || SQLERRM);
  END;

  -- platform_fees is the payment ledger. A booking is required by the FK
  -- and is itself retained; the fee row must still be there afterwards.
  BEGIN
    v_user := gen_random_uuid();
    v_doctor := gen_random_uuid();
    v_patient := gen_random_uuid();
    v_booking := gen_random_uuid();
    PERFORM pg_temp.gap_user(v_user, 'fee', 'doctor', 'Fee');
    PERFORM pg_temp.gap_doctor(v_user, v_doctor);
    PERFORM pg_temp.gap_user(v_patient, 'fee-pat', 'patient', 'FeePatient');
    INSERT INTO public.bookings (
      id, patient_id, doctor_id, appointment_date, start_time, end_time,
      consultation_type, status, currency,
      consultation_fee_cents, platform_fee_cents, total_amount_cents
    ) VALUES (
      v_booking, v_patient, v_doctor, CURRENT_DATE, now(), now() + interval '30 minutes',
      'video', 'completed', 'GBP', 1000, 100, 1100
    );
    INSERT INTO public.platform_fees (booking_id, doctor_id, fee_type, amount_cents, currency)
    VALUES (v_booking, v_doctor, 'commission', 100, 'GBP');
    v_result := public.erase_account(v_user);
    SELECT count(*) INTO v_count FROM public.platform_fees WHERE doctor_id = v_doctor;
    v_text := '';
    IF v_result->>'mode' IS DISTINCT FROM 'restricted' THEN
      v_text := 'mode=' || coalesce(v_result->>'mode', 'null');
    ELSIF v_count <> 1 THEN
      v_text := 'platform fee deleted';
    END IF;
    PERFORM pg_temp.record_case(
      'gap_platform_fee',
      CASE WHEN v_text = '' THEN 'PASS' ELSE 'FAIL' END,
      CASE WHEN v_text = '' THEN 'restricted, platform fee kept' ELSE v_text END
    );
  EXCEPTION
    WHEN OTHERS THEN
      PERFORM pg_temp.record_case('gap_platform_fee', 'FAIL', SQLSTATE || ' ' || SQLERRM);
  END;

  BEGIN
    v_user := gen_random_uuid();
    PERFORM pg_temp.gap_user(v_user, 'plan', 'patient', 'Plan');
    INSERT INTO public.treatment_plans (
      doctor_id, patient_id, token, title, total_sessions, session_duration_minutes,
      consultation_type, service_name, unit_price_cents, payment_type,
      platform_fee_per_session_cents, total_platform_fee_cents, expires_at
    ) VALUES (
      v_clinic_doctor, v_user, 'gap-tp-' || v_user::text, 'Gap plan', 1, 30,
      'video', 'Consult', 1000, 'pay_full', 100, 100, now() + interval '30 days'
    );
    v_result := public.erase_account(v_user);
    SELECT count(*) INTO v_count FROM public.treatment_plans WHERE patient_id = v_user;
    v_text := '';
    IF v_result->>'mode' IS DISTINCT FROM 'restricted' THEN
      v_text := 'mode=' || coalesce(v_result->>'mode', 'null');
    ELSIF v_count <> 1 THEN
      v_text := 'treatment plan deleted';
    END IF;
    PERFORM pg_temp.record_case(
      'gap_treatment_plan',
      CASE WHEN v_text = '' THEN 'PASS' ELSE 'FAIL' END,
      CASE WHEN v_text = '' THEN 'restricted, treatment plan kept' ELSE v_text END
    );
  EXCEPTION
    WHEN OTHERS THEN
      PERFORM pg_temp.record_case('gap_treatment_plan', 'FAIL', SQLSTATE || ' ' || SQLERRM);
  END;

  BEGIN
    v_user := gen_random_uuid();
    PERFORM pg_temp.gap_user(v_user, 'conv', 'patient', 'Chat');
    INSERT INTO public.conversations (doctor_id, patient_id)
    VALUES (v_clinic_doctor, v_user);
    v_result := public.erase_account(v_user);
    SELECT count(*) INTO v_count FROM public.conversations WHERE patient_id = v_user;
    v_text := '';
    IF v_result->>'mode' IS DISTINCT FROM 'restricted' THEN
      v_text := 'mode=' || coalesce(v_result->>'mode', 'null');
    ELSIF v_count <> 1 THEN
      v_text := 'conversation deleted';
    END IF;
    PERFORM pg_temp.record_case(
      'gap_conversation',
      CASE WHEN v_text = '' THEN 'PASS' ELSE 'FAIL' END,
      CASE WHEN v_text = '' THEN 'restricted, conversation kept' ELSE v_text END
    );
  EXCEPTION
    WHEN OTHERS THEN
      PERFORM pg_temp.record_case('gap_conversation', 'FAIL', SQLSTATE || ' ' || SQLERRM);
  END;

  BEGIN
    v_user := gen_random_uuid();
    v_conversation := gen_random_uuid();
    PERFORM pg_temp.gap_user(v_user, 'msg', 'patient', 'Messenger');
    INSERT INTO public.conversations (id, doctor_id, patient_id)
    VALUES (v_conversation, v_clinic_doctor, v_user);
    INSERT INTO public.direct_messages (conversation_id, sender_id, sender_role, body)
    VALUES (v_conversation, v_user, 'patient', 'secret message');
    v_result := public.erase_account(v_user);
    SELECT count(*) INTO v_count
    FROM public.direct_messages
    WHERE sender_id = v_user AND body = 'secret message';
    v_text := '';
    IF v_result->>'mode' IS DISTINCT FROM 'restricted' THEN
      v_text := 'mode=' || coalesce(v_result->>'mode', 'null');
    ELSIF v_count <> 1 THEN
      v_text := 'message deleted';
    END IF;
    PERFORM pg_temp.record_case(
      'gap_direct_message',
      CASE WHEN v_text = '' THEN 'PASS' ELSE 'FAIL' END,
      CASE WHEN v_text = '' THEN 'restricted, message kept' ELSE v_text END
    );
  EXCEPTION
    WHEN OTHERS THEN
      PERFORM pg_temp.record_case('gap_direct_message', 'FAIL', SQLSTATE || ' ' || SQLERRM);
  END;

  BEGIN
    v_user := gen_random_uuid();
    v_org := gen_random_uuid();
    PERFORM pg_temp.gap_user(v_user, 'staff', 'patient', 'Staff');
    PERFORM pg_temp.gap_org(v_org, 'Staff Clinic', 'staff-clinic@example.com');
    INSERT INTO public.organization_members (organization_id, user_id, role, status)
    VALUES (v_org, v_user, 'staff', 'active');
    v_result := public.erase_account(v_user);
    SELECT m.status INTO v_status
    FROM public.organization_members AS m
    WHERE m.organization_id = v_org AND m.user_id = v_user;
    SELECT o.name INTO v_name FROM public.organizations AS o WHERE o.id = v_org;
    v_text := '';
    IF v_result->>'mode' IS DISTINCT FROM 'restricted' THEN
      v_text := 'mode=' || coalesce(v_result->>'mode', 'null');
    ELSIF v_status IS DISTINCT FROM 'active' THEN
      v_text := 'staff membership changed to ' || coalesce(v_status, 'null');
    ELSIF v_name IS DISTINCT FROM 'Staff Clinic' THEN
      v_text := 'org name changed';
    END IF;
    PERFORM pg_temp.record_case(
      'gap_org_member',
      CASE WHEN v_text = '' THEN 'PASS' ELSE 'FAIL' END,
      CASE WHEN v_text = '' THEN 'restricted, staff membership kept' ELSE v_text END
    );
  EXCEPTION
    WHEN OTHERS THEN
      PERFORM pg_temp.record_case('gap_org_member', 'FAIL', SQLSTATE || ' ' || SQLERRM);
  END;

  BEGIN
    v_user := gen_random_uuid();
    PERFORM pg_temp.gap_user(v_user, 'wallet', 'patient', 'Wallet');
    INSERT INTO public.patient_wallet (patient_id, currency, balance_cents)
    VALUES (v_user, 'GBP', 250);
    v_result := public.erase_account(v_user);
    SELECT count(*) INTO v_count FROM public.patient_wallet WHERE patient_id = v_user;
    v_text := '';
    IF v_result->>'mode' IS DISTINCT FROM 'restricted' THEN
      v_text := 'mode=' || coalesce(v_result->>'mode', 'null');
    ELSIF v_count <> 1 THEN
      v_text := 'wallet deleted';
    END IF;
    PERFORM pg_temp.record_case(
      'gap_patient_wallet',
      CASE WHEN v_text = '' THEN 'PASS' ELSE 'FAIL' END,
      CASE WHEN v_text = '' THEN 'restricted, wallet kept' ELSE v_text END
    );
  EXCEPTION
    WHEN OTHERS THEN
      PERFORM pg_temp.record_case('gap_patient_wallet', 'FAIL', SQLSTATE || ' ' || SQLERRM);
  END;

  -- Active and trialing stored subscriptions block before any write.
  FOREACH v_text IN ARRAY ARRAY['active', 'trialing']
  LOOP
    BEGIN
      v_user := gen_random_uuid();
      v_doctor := gen_random_uuid();
      PERFORM pg_temp.gap_user(v_user, 'sub-' || v_text, 'doctor', 'KeepSub');
      PERFORM pg_temp.gap_doctor(v_user, v_doctor);
      INSERT INTO public.doctor_subscriptions (
        doctor_id, stripe_subscription_id, stripe_customer_id, plan_id, status,
        current_period_start, current_period_end
      ) VALUES (
        v_doctor, 'sub_' || v_text || '_' || v_doctor::text, 'cus_' || v_text || '_' || v_doctor::text,
        'plan_gap', v_text, now(), now() + interval '30 days'
      );
      BEGIN
        PERFORM public.erase_account(v_user);
        PERFORM pg_temp.record_case('gap_sub_' || v_text, 'FAIL', 'erase succeeded');
      EXCEPTION
        WHEN OTHERS THEN
          SELECT p.first_name INTO v_name FROM public.profiles AS p WHERE p.id = v_user;
          SELECT u.email INTO v_email FROM auth.users AS u WHERE u.id = v_user;
          SELECT count(*) INTO v_count
          FROM public.doctor_subscriptions
          WHERE doctor_id = v_doctor AND status = v_text;
          IF SQLERRM ILIKE '%erasure_blocked%'
             AND v_name = 'KeepSub'
             AND v_email LIKE 'gap-sub-' || v_text || '-%'
             AND v_count = 1 THEN
            PERFORM pg_temp.record_case('gap_sub_' || v_text, 'PASS', 'blocked, nothing changed');
          ELSE
            PERFORM pg_temp.record_case(
              'gap_sub_' || v_text,
              'FAIL',
              SQLSTATE || ' ' || SQLERRM || ' name=' || coalesce(v_name, 'null')
            );
          END IF;
      END;
    EXCEPTION
      WHEN OTHERS THEN
        PERFORM pg_temp.record_case('gap_sub_' || v_text, 'FAIL', SQLSTATE || ' ' || SQLERRM);
    END;
  END LOOP;

  BEGIN
    v_user := gen_random_uuid();
    v_org := gen_random_uuid();
    PERFORM pg_temp.gap_user(v_user, 'licence', 'doctor', 'KeepLic');
    PERFORM pg_temp.gap_org(v_org, 'Licensed Clinic', 'licensed@example.com');
    INSERT INTO public.organization_members (organization_id, user_id, role, status)
    VALUES (v_org, v_user, 'doctor', 'active');
    INSERT INTO public.licenses (
      organization_id, tier, status, current_period_start, current_period_end
    ) VALUES (
      v_org, 'starter', 'active', now(), now() + interval '30 days'
    );
    BEGIN
      PERFORM public.erase_account(v_user);
      PERFORM pg_temp.record_case('gap_active_licence', 'FAIL', 'erase succeeded');
    EXCEPTION
      WHEN OTHERS THEN
        SELECT p.first_name INTO v_name FROM public.profiles AS p WHERE p.id = v_user;
        SELECT m.status INTO v_status
        FROM public.organization_members AS m
        WHERE m.organization_id = v_org AND m.user_id = v_user;
        SELECT o.name INTO v_email FROM public.organizations AS o WHERE o.id = v_org;
        IF SQLERRM ILIKE '%erasure_blocked%'
           AND v_name = 'KeepLic'
           AND v_status = 'active'
           AND v_email = 'Licensed Clinic' THEN
          PERFORM pg_temp.record_case('gap_active_licence', 'PASS', 'blocked, nothing changed');
        ELSE
          PERFORM pg_temp.record_case(
            'gap_active_licence',
            'FAIL',
            SQLSTATE || ' ' || SQLERRM || ' name=' || coalesce(v_name, 'null')
          );
        END IF;
    END;
  EXCEPTION
    WHEN OTHERS THEN
      PERFORM pg_temp.record_case('gap_active_licence', 'FAIL', SQLSTATE || ' ' || SQLERRM);
  END;

  BEGIN
    v_user := gen_random_uuid();
    v_org := gen_random_uuid();
    PERFORM pg_temp.gap_user(v_user, 'trial-lic', 'doctor', 'KeepTrial');
    PERFORM pg_temp.gap_org(v_org, 'Trial Clinic', 'trial@example.com');
    INSERT INTO public.organization_members (organization_id, user_id, role, status)
    VALUES (v_org, v_user, 'doctor', 'active');
    INSERT INTO public.licenses (
      organization_id, tier, status, current_period_start, current_period_end
    ) VALUES (
      v_org, 'starter', 'trialing', now(), now() + interval '14 days'
    );
    BEGIN
      PERFORM public.erase_account(v_user);
      PERFORM pg_temp.record_case('gap_trialing_licence', 'FAIL', 'erase succeeded');
    EXCEPTION
      WHEN OTHERS THEN
        SELECT p.first_name INTO v_name FROM public.profiles AS p WHERE p.id = v_user;
        IF SQLERRM ILIKE '%erasure_blocked%' AND v_name = 'KeepTrial' THEN
          PERFORM pg_temp.record_case('gap_trialing_licence', 'PASS', 'blocked, nothing changed');
        ELSE
          PERFORM pg_temp.record_case(
            'gap_trialing_licence',
            'FAIL',
            SQLSTATE || ' ' || SQLERRM || ' name=' || coalesce(v_name, 'null')
          );
        END IF;
    END;
  EXCEPTION
    WHEN OTHERS THEN
      PERFORM pg_temp.record_case('gap_trialing_licence', 'FAIL', SQLSTATE || ' ' || SQLERRM);
  END;

  BEGIN
    v_user := gen_random_uuid();
    v_other := gen_random_uuid();
    v_org := gen_random_uuid();
    PERFORM pg_temp.gap_user(v_user, 'owner-others', 'doctor', 'KeepOwner');
    PERFORM pg_temp.gap_user(v_other, 'owner-other-member', 'doctor', 'Colleague');
    PERFORM pg_temp.gap_org(v_org, 'Shared Clinic', 'shared@example.com');
    INSERT INTO public.organization_members (organization_id, user_id, role, status)
    VALUES
      (v_org, v_user, 'owner', 'active'),
      (v_org, v_other, 'doctor', 'invited');
    BEGIN
      PERFORM public.erase_account(v_user);
      PERFORM pg_temp.record_case('gap_owner_other_members', 'FAIL', 'erase succeeded');
    EXCEPTION
      WHEN OTHERS THEN
        SELECT p.first_name INTO v_name FROM public.profiles AS p WHERE p.id = v_user;
        SELECT m.status INTO v_status
        FROM public.organization_members AS m
        WHERE m.organization_id = v_org AND m.user_id = v_user;
        SELECT o.name INTO v_email FROM public.organizations AS o WHERE o.id = v_org;
        IF SQLERRM ILIKE '%erasure_blocked%'
           AND v_name = 'KeepOwner'
           AND v_status = 'active'
           AND v_email = 'Shared Clinic' THEN
          PERFORM pg_temp.record_case('gap_owner_other_members', 'PASS', 'blocked, owner still active');
        ELSE
          PERFORM pg_temp.record_case(
            'gap_owner_other_members',
            'FAIL',
            SQLSTATE || ' ' || SQLERRM || ' status=' || coalesce(v_status, 'null')
          );
        END IF;
    END;
  EXCEPTION
    WHEN OTHERS THEN
      PERFORM pg_temp.record_case('gap_owner_other_members', 'FAIL', SQLSTATE || ' ' || SQLERRM);
  END;

  BEGIN
    v_user := gen_random_uuid();
    v_org := gen_random_uuid();
    PERFORM pg_temp.gap_user(v_user, 'owner-lic', 'doctor', 'KeepOwnerLic');
    PERFORM pg_temp.gap_org(v_org, 'Owned Licensed Clinic', 'owned-lic@example.com');
    INSERT INTO public.organization_members (organization_id, user_id, role, status)
    VALUES (v_org, v_user, 'owner', 'active');
    INSERT INTO public.licenses (
      organization_id, tier, status, current_period_start, current_period_end
    ) VALUES (
      v_org, 'clinic', 'active', now(), now() + interval '30 days'
    );
    BEGIN
      PERFORM public.erase_account(v_user);
      PERFORM pg_temp.record_case('gap_owner_active_licence', 'FAIL', 'erase succeeded');
    EXCEPTION
      WHEN OTHERS THEN
        SELECT m.status INTO v_status
        FROM public.organization_members AS m
        WHERE m.organization_id = v_org AND m.user_id = v_user;
        SELECT o.name INTO v_name FROM public.organizations AS o WHERE o.id = v_org;
        IF SQLERRM ILIKE '%erasure_blocked%'
           AND v_status = 'active'
           AND v_name = 'Owned Licensed Clinic' THEN
          PERFORM pg_temp.record_case('gap_owner_active_licence', 'PASS', 'blocked, clinic unchanged');
        ELSE
          PERFORM pg_temp.record_case(
            'gap_owner_active_licence',
            'FAIL',
            SQLSTATE || ' ' || SQLERRM || ' name=' || coalesce(v_name, 'null')
          );
        END IF;
    END;
  EXCEPTION
    WHEN OTHERS THEN
      PERFORM pg_temp.record_case('gap_owner_active_licence', 'FAIL', SQLSTATE || ' ' || SQLERRM);
  END;

  -- Sole owner, including a cancelled licence, is restricted and scrubbed.
  BEGIN
    v_user := gen_random_uuid();
    v_other := gen_random_uuid();
    v_org := gen_random_uuid();
    PERFORM pg_temp.gap_user(v_user, 'sole', 'doctor', 'Sole');
    PERFORM pg_temp.gap_user(v_other, 'removed', 'doctor', 'Gone');
    PERFORM pg_temp.gap_org(v_org, 'Sole Clinic', 'sole@example.com');
    INSERT INTO public.organization_members (organization_id, user_id, role, status)
    VALUES
      (v_org, v_user, 'owner', 'active'),
      (v_org, v_other, 'doctor', 'removed');
    INSERT INTO public.licenses (
      organization_id, tier, status, current_period_start, current_period_end
    ) VALUES (
      v_org, 'starter', 'cancelled', now() - interval '60 days', now() - interval '30 days'
    );
    v_result := public.erase_account(v_user);
    SELECT m.status INTO v_status
    FROM public.organization_members AS m
    WHERE m.organization_id = v_org AND m.user_id = v_user;
    SELECT o.name, o.email, o.slug
    INTO v_name, v_email, v_slug
    FROM public.organizations AS o
    WHERE o.id = v_org;
    v_brand := '';
    IF pg_temp.col_exists('public', 'organizations', 'brand_support_email') THEN
      EXECUTE 'SELECT brand_support_email FROM public.organizations WHERE id = $1'
        INTO v_text
        USING v_org;
      IF v_text IS NOT NULL THEN
        v_brand := 'brand_support_email';
      END IF;
    END IF;
    IF v_brand = '' AND pg_temp.col_exists('public', 'organizations', 'brand_support_phone') THEN
      EXECUTE 'SELECT brand_support_phone FROM public.organizations WHERE id = $1'
        INTO v_text
        USING v_org;
      IF v_text IS NOT NULL THEN
        v_brand := 'brand_support_phone';
      END IF;
    END IF;
    IF v_brand = '' AND pg_temp.col_exists('public', 'organizations', 'brand_display_name') THEN
      EXECUTE 'SELECT brand_display_name FROM public.organizations WHERE id = $1'
        INTO v_text
        USING v_org;
      IF v_text IS DISTINCT FROM '' THEN
        v_brand := 'brand_display_name';
      END IF;
    END IF;
    v_text := '';
    IF v_result->>'mode' IS DISTINCT FROM 'restricted' THEN
      v_text := 'mode=' || coalesce(v_result->>'mode', 'null');
    ELSIF v_status IS DISTINCT FROM 'suspended' THEN
      v_text := 'status=' || coalesce(v_status, 'null');
    ELSIF v_name IS DISTINCT FROM '' THEN
      v_text := 'name=' || coalesce(v_name, 'null');
    ELSIF v_email IS NOT NULL THEN
      v_text := 'email still set';
    ELSIF v_slug IS DISTINCT FROM 'erased-' || v_org::text THEN
      v_text := 'slug=' || coalesce(v_slug, 'null');
    ELSIF v_brand <> '' THEN
      v_text := v_brand || ' not scrubbed';
    ELSE
      v_result := public.erase_account(v_user);
      SELECT o.name INTO v_name FROM public.organizations AS o WHERE o.id = v_org;
      SELECT m.status INTO v_status
      FROM public.organization_members AS m
      WHERE m.organization_id = v_org AND m.user_id = v_user;
      IF v_result->>'mode' IS DISTINCT FROM 'restricted' OR v_name IS DISTINCT FROM '' OR v_status IS DISTINCT FROM 'suspended' THEN
        v_text := 'second run not idempotent';
      END IF;
    END IF;
    PERFORM pg_temp.record_case(
      'gap_sole_owner',
      CASE WHEN v_text = '' THEN 'PASS' ELSE 'FAIL' END,
      CASE WHEN v_text = '' THEN 'suspended, clinic identity scrubbed, idempotent' ELSE v_text END
    );
  EXCEPTION
    WHEN OTHERS THEN
      PERFORM pg_temp.record_case('gap_sole_owner', 'FAIL', SQLSTATE || ' ' || SQLERRM);
  END;

  BEGIN
    v_user := gen_random_uuid();
    PERFORM pg_temp.gap_user(v_user, 'clean', 'patient', 'Clean');
    v_result := public.erase_account(v_user);
    SELECT p.first_name INTO v_name FROM public.profiles AS p WHERE p.id = v_user;
    SELECT count(*) INTO v_count FROM auth.users WHERE id = v_user;
    v_text := '';
    IF v_result->>'mode' IS DISTINCT FROM 'hard_delete' THEN
      v_text := 'mode=' || coalesce(v_result->>'mode', 'null');
    ELSIF v_name IS DISTINCT FROM 'Clean' THEN
      v_text := 'name changed on hard_delete';
    ELSIF v_count <> 1 THEN
      v_text := 'auth user removed by sql';
    END IF;
    PERFORM pg_temp.record_case(
      'gap_clean_hard_delete',
      CASE WHEN v_text = '' THEN 'PASS' ELSE 'FAIL' END,
      CASE WHEN v_text = '' THEN 'hard_delete, auth user left for deleteUser' ELSE v_text END
    );
  EXCEPTION
    WHEN OTHERS THEN
      PERFORM pg_temp.record_case('gap_clean_hard_delete', 'FAIL', SQLSTATE || ' ' || SQLERRM);
  END;

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

  RAISE EXCEPTION E'account erasure dry run PASSED\n%\nThis exception aborts the transaction so fixture users are not kept. Do not COMMIT.',
    v_summary;
END
$gap_checks$;
