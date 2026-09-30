-- Migration A checks. Not a migration.
--
-- Run after 00108, 00090, and 00089, inside a transaction that rolls back:
--
--   BEGIN;
--   \i supabase/tests/migration_a_checks.sql
--   ROLLBACK;
--
-- The script sets the role and request.jwt.claims. It looks up one doctor
-- (profiles.role = 'doctor') and one platform admin (profiles.role = 'admin').
-- It does not insert those rows and it does not hard-code ids.
--
-- Doctor cases need the existing doctors RLS: the owner can SELECT and UPDATE
-- their row. A result of 0 rows means RLS hid the row and the trigger did not run.
--
-- Cases:
--   (a) service_role updates verification_status and is_featured — must succeed
--   (b) that admin updates the same columns — must succeed
--   (c) the doctor owner updates each privileged column — must fail with
--       the trigger error
--   (d) the doctor owner updates bio — must succeed
--   raw_symptom_text_rows — rows still holding raw symptom text — expected 0
--
-- Each case is RAISE NOTICE'd and stored in migration_a_check_results.
-- A failing case raises at the end, after the SELECT results.

DROP TABLE IF EXISTS migration_a_check_results;
CREATE TEMP TABLE migration_a_check_results (
  case_id text PRIMARY KEY,
  outcome text NOT NULL,
  detail text NOT NULL
);

DROP TABLE IF EXISTS migration_a_raw_symptom_text;
CREATE TEMP TABLE migration_a_raw_symptom_text (
  raw_symptom_text_rows bigint NOT NULL
);

CREATE OR REPLACE FUNCTION pg_temp.record_case(p_case text, p_outcome text, p_detail text)
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE NOTICE '% % — %', p_outcome, p_case, p_detail;
  INSERT INTO migration_a_check_results (case_id, outcome, detail)
  VALUES (p_case, p_outcome, p_detail);
END;
$$;

CREATE OR REPLACE FUNCTION pg_temp.set_jwt(p_sub uuid, p_role text)
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  IF p_sub IS NULL THEN
    PERFORM set_config(
      'request.jwt.claims',
      json_build_object('role', p_role)::text,
      true
    );
    PERFORM set_config('request.jwt.claim.sub', '', true);
  ELSE
    PERFORM set_config(
      'request.jwt.claims',
      json_build_object('sub', p_sub::text, 'role', p_role)::text,
      true
    );
    PERFORM set_config('request.jwt.claim.sub', p_sub::text, true);
  END IF;
  PERFORM set_config('request.jwt.claim.role', p_role, true);
END;
$$;

DO $checks$
DECLARE
  v_doctor uuid;
  v_doctor_profile uuid;
  v_admin uuid;
  v_rows integer;
  v_part bigint;
  v_raw bigint := 0;
  v_plaintext_column boolean := false;
  v_search bigint;
  v_col text;
  v_table text;
  v_schema text;
  denylist text[] := ARRAY[
    'urgencyreason',
    'urgency_reason',
    'input',
    'input_text',
    'inputtext',
    'raw',
    'raw_input',
    'query',
    'prompt',
    'description',
    'text',
    'user_input',
    'userinput',
    'symptom',
    'symptoms',
    'patient_input',
    'message'
  ];
BEGIN
  SELECT d.id, d.profile_id
  INTO v_doctor, v_doctor_profile
  FROM public.doctors d
  JOIN public.profiles p ON p.id = d.profile_id
  WHERE p.role = 'doctor'
  ORDER BY d.created_at NULLS LAST, d.id
  LIMIT 1;

  SELECT p.id
  INTO v_admin
  FROM public.profiles p
  WHERE p.role = 'admin'
  ORDER BY p.created_at NULLS LAST, p.id
  LIMIT 1;

  IF v_doctor IS NULL THEN
    PERFORM pg_temp.record_case(
      'a_service_role_verification_status',
      'FAIL',
      'no doctors row whose profile role is doctor'
    );
    PERFORM pg_temp.record_case(
      'a_service_role_is_featured',
      'FAIL',
      'no doctors row whose profile role is doctor'
    );
    PERFORM pg_temp.record_case(
      'c_doctor_verification_status',
      'FAIL',
      'no doctors row whose profile role is doctor'
    );
    PERFORM pg_temp.record_case(
      'c_doctor_is_featured',
      'FAIL',
      'no doctors row whose profile role is doctor'
    );
    PERFORM pg_temp.record_case(
      'd_doctor_bio',
      'FAIL',
      'no doctors row whose profile role is doctor'
    );
  END IF;

  IF v_admin IS NULL THEN
    PERFORM pg_temp.record_case(
      'b_admin_verification_status',
      'FAIL',
      'no profiles row with role = admin'
    );
    PERFORM pg_temp.record_case(
      'b_admin_is_featured',
      'FAIL',
      'no profiles row with role = admin'
    );
  ELSIF v_doctor IS NULL THEN
    PERFORM pg_temp.record_case(
      'b_admin_verification_status',
      'FAIL',
      'no doctors row whose profile role is doctor'
    );
    PERFORM pg_temp.record_case(
      'b_admin_is_featured',
      'FAIL',
      'no doctors row whose profile role is doctor'
    );
  END IF;

  IF v_doctor IS NOT NULL THEN
    BEGIN
      PERFORM pg_temp.set_jwt(NULL, 'service_role');
      EXECUTE 'SET LOCAL ROLE service_role';
      UPDATE public.doctors
      SET verification_status = CASE
        WHEN verification_status = 'verified' THEN 'pending'
        ELSE 'verified'
      END
      WHERE id = v_doctor;
      GET DIAGNOSTICS v_rows = ROW_COUNT;
      EXECUTE 'RESET ROLE';
      IF v_rows = 1 THEN
        PERFORM pg_temp.record_case(
          'a_service_role_verification_status',
          'PASS',
          format('service_role updated verification_status on doctor %s', v_doctor)
        );
      ELSE
        PERFORM pg_temp.record_case(
          'a_service_role_verification_status',
          'FAIL',
          format('updated %s rows for doctor %s', v_rows, v_doctor)
        );
      END IF;
    EXCEPTION WHEN OTHERS THEN
      BEGIN
        EXECUTE 'RESET ROLE';
      EXCEPTION WHEN OTHERS THEN
        NULL;
      END;
      PERFORM pg_temp.record_case(
        'a_service_role_verification_status',
        'FAIL',
        SQLERRM
      );
    END;

    BEGIN
      PERFORM pg_temp.set_jwt(NULL, 'service_role');
      EXECUTE 'SET LOCAL ROLE service_role';
      UPDATE public.doctors
      SET is_featured = NOT COALESCE(is_featured, FALSE)
      WHERE id = v_doctor;
      GET DIAGNOSTICS v_rows = ROW_COUNT;
      EXECUTE 'RESET ROLE';
      IF v_rows = 1 THEN
        PERFORM pg_temp.record_case(
          'a_service_role_is_featured',
          'PASS',
          format('service_role updated is_featured on doctor %s', v_doctor)
        );
      ELSE
        PERFORM pg_temp.record_case(
          'a_service_role_is_featured',
          'FAIL',
          format('updated %s rows for doctor %s', v_rows, v_doctor)
        );
      END IF;
    EXCEPTION WHEN OTHERS THEN
      BEGIN
        EXECUTE 'RESET ROLE';
      EXCEPTION WHEN OTHERS THEN
        NULL;
      END;
      PERFORM pg_temp.record_case('a_service_role_is_featured', 'FAIL', SQLERRM);
    END;
  END IF;

  IF v_admin IS NOT NULL AND v_doctor IS NOT NULL THEN
    BEGIN
      PERFORM pg_temp.set_jwt(v_admin, 'authenticated');
      EXECUTE 'SET LOCAL ROLE authenticated';
      UPDATE public.doctors
      SET verification_status = CASE
        WHEN verification_status = 'verified' THEN 'pending'
        ELSE 'verified'
      END
      WHERE id = v_doctor;
      GET DIAGNOSTICS v_rows = ROW_COUNT;
      EXECUTE 'RESET ROLE';
      IF v_rows = 1 THEN
        PERFORM pg_temp.record_case(
          'b_admin_verification_status',
          'PASS',
          format('admin %s updated verification_status on doctor %s', v_admin, v_doctor)
        );
      ELSE
        PERFORM pg_temp.record_case(
          'b_admin_verification_status',
          'FAIL',
          format('updated %s rows', v_rows)
        );
      END IF;
    EXCEPTION WHEN OTHERS THEN
      BEGIN
        EXECUTE 'RESET ROLE';
      EXCEPTION WHEN OTHERS THEN
        NULL;
      END;
      PERFORM pg_temp.record_case('b_admin_verification_status', 'FAIL', SQLERRM);
    END;

    BEGIN
      PERFORM pg_temp.set_jwt(v_admin, 'authenticated');
      EXECUTE 'SET LOCAL ROLE authenticated';
      UPDATE public.doctors
      SET is_featured = NOT COALESCE(is_featured, FALSE)
      WHERE id = v_doctor;
      GET DIAGNOSTICS v_rows = ROW_COUNT;
      EXECUTE 'RESET ROLE';
      IF v_rows = 1 THEN
        PERFORM pg_temp.record_case(
          'b_admin_is_featured',
          'PASS',
          format('admin %s updated is_featured on doctor %s', v_admin, v_doctor)
        );
      ELSE
        PERFORM pg_temp.record_case(
          'b_admin_is_featured',
          'FAIL',
          format('updated %s rows', v_rows)
        );
      END IF;
    EXCEPTION WHEN OTHERS THEN
      BEGIN
        EXECUTE 'RESET ROLE';
      EXCEPTION WHEN OTHERS THEN
        NULL;
      END;
      PERFORM pg_temp.record_case('b_admin_is_featured', 'FAIL', SQLERRM);
    END;
  END IF;

  IF v_doctor IS NOT NULL THEN
    BEGIN
      PERFORM pg_temp.set_jwt(v_doctor_profile, 'authenticated');
      EXECUTE 'SET LOCAL ROLE authenticated';
      UPDATE public.doctors
      SET verification_status = CASE
        WHEN verification_status = 'verified' THEN 'pending'
        ELSE 'verified'
      END
      WHERE id = v_doctor;
      GET DIAGNOSTICS v_rows = ROW_COUNT;
      EXECUTE 'RESET ROLE';
      PERFORM pg_temp.record_case(
        'c_doctor_verification_status',
        'FAIL',
        format('trigger did not fire; updated %s rows for %s (0 means RLS hid the row)', v_rows, v_doctor_profile)
      );
    EXCEPTION WHEN OTHERS THEN
      BEGIN
        EXECUTE 'RESET ROLE';
      EXCEPTION WHEN OTHERS THEN
        NULL;
      END;
      IF position('Cannot modify privileged doctor columns' IN SQLERRM) > 0 THEN
        PERFORM pg_temp.record_case(
          'c_doctor_verification_status',
          'PASS',
          format('doctor %s blocked: %s', v_doctor_profile, SQLERRM)
        );
      ELSE
        PERFORM pg_temp.record_case(
          'c_doctor_verification_status',
          'FAIL',
          SQLERRM
        );
      END IF;
    END;

    BEGIN
      PERFORM pg_temp.set_jwt(v_doctor_profile, 'authenticated');
      EXECUTE 'SET LOCAL ROLE authenticated';
      UPDATE public.doctors
      SET is_featured = NOT COALESCE(is_featured, FALSE)
      WHERE id = v_doctor;
      GET DIAGNOSTICS v_rows = ROW_COUNT;
      EXECUTE 'RESET ROLE';
      PERFORM pg_temp.record_case(
        'c_doctor_is_featured',
        'FAIL',
        format('trigger did not fire; updated %s rows for %s (0 means RLS hid the row)', v_rows, v_doctor_profile)
      );
    EXCEPTION WHEN OTHERS THEN
      BEGIN
        EXECUTE 'RESET ROLE';
      EXCEPTION WHEN OTHERS THEN
        NULL;
      END;
      IF position('Cannot modify privileged doctor columns' IN SQLERRM) > 0 THEN
        PERFORM pg_temp.record_case(
          'c_doctor_is_featured',
          'PASS',
          format('doctor %s blocked: %s', v_doctor_profile, SQLERRM)
        );
      ELSE
        PERFORM pg_temp.record_case('c_doctor_is_featured', 'FAIL', SQLERRM);
      END IF;
    END;

    BEGIN
      PERFORM pg_temp.set_jwt(v_doctor_profile, 'authenticated');
      EXECUTE 'SET LOCAL ROLE authenticated';
      UPDATE public.doctors
      SET bio = coalesce(bio, '') || ' migration-a'
      WHERE id = v_doctor;
      GET DIAGNOSTICS v_rows = ROW_COUNT;
      EXECUTE 'RESET ROLE';
      IF v_rows = 1 THEN
        PERFORM pg_temp.record_case(
          'd_doctor_bio',
          'PASS',
          format('doctor %s updated bio', v_doctor_profile)
        );
      ELSE
        PERFORM pg_temp.record_case(
          'd_doctor_bio',
          'FAIL',
          format('updated %s rows (0 means RLS hid the doctor row)', v_rows)
        );
      END IF;
    EXCEPTION WHEN OTHERS THEN
      BEGIN
        EXECUTE 'RESET ROLE';
      EXCEPTION WHEN OTHERS THEN
        NULL;
      END;
      PERFORM pg_temp.record_case('d_doctor_bio', 'FAIL', SQLERRM);
    END;
  END IF;

  -- Raw symptom text still stored after 00090. Expected 0.
  -- Counts plaintext columns on ai_symptom_cache (except the hash and locale),
  -- jsonb strings longer than 80 characters, denylist keys that still hold a
  -- string, and the same plaintext column names on any other public table.
  -- ai_search_cache is reported separately: 00120 owns that column.
  IF to_regclass('public.ai_symptom_cache') IS NULL THEN
    v_raw := 0;
    PERFORM pg_temp.record_case(
      'raw_symptom_text_rows',
      'FAIL',
      'public.ai_symptom_cache does not exist'
    );
  ELSE
    FOR v_col IN
      SELECT column_name
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'ai_symptom_cache'
        AND data_type IN ('text', 'character varying')
        AND column_name NOT IN ('input_hash', 'locale')
    LOOP
      EXECUTE format(
        'SELECT count(*) FROM public.ai_symptom_cache WHERE %1$I IS NOT NULL AND btrim(%1$I) <> '''' AND %1$I !~ %2$L',
        v_col,
        '^[0-9a-fA-F]{64}$'
      ) INTO v_part;
      v_raw := v_raw + v_part;
    END LOOP;

    FOR v_col IN
      SELECT column_name
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'ai_symptom_cache'
        AND udt_name = 'jsonb'
    LOOP
      EXECUTE format($q$
        WITH RECURSIVE walk AS (
          SELECT id, NULL::text AS key, %1$I AS node
          FROM public.ai_symptom_cache
          WHERE %1$I IS NOT NULL
          UNION ALL
          SELECT w.id, child.key, child.value
          FROM walk w
          CROSS JOIN LATERAL (
            SELECT e.key, e.value
            FROM jsonb_each(
              CASE WHEN jsonb_typeof(w.node) = 'object' THEN w.node ELSE NULL END
            ) AS e(key, value)
            UNION ALL
            SELECT NULL::text, a.value
            FROM jsonb_array_elements(
              CASE WHEN jsonb_typeof(w.node) = 'array' THEN w.node ELSE NULL END
            ) AS a(value)
          ) AS child(key, value)
        )
        SELECT count(DISTINCT id) FROM walk
        WHERE (
          jsonb_typeof(node) = 'string'
          AND char_length(node #>> '{}') > 80
        ) OR (
          lower(coalesce(key, '')) = ANY ($1)
          AND jsonb_typeof(node) = 'string'
          AND btrim(node #>> '{}') <> ''
        )
      $q$, v_col) INTO v_part USING denylist;
      v_raw := v_raw + v_part;
    END LOOP;

    SELECT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'ai_symptom_cache'
        AND column_name IN (
          'input_text',
          'input_text_backup',
          'input_text_old',
          'raw_input',
          'symptom_text'
        )
    ) INTO v_plaintext_column;

    FOR v_schema, v_table, v_col IN
      SELECT table_schema, table_name, column_name
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name <> 'ai_symptom_cache'
        AND table_name <> 'ai_search_cache'
        AND column_name IN (
          'input_text',
          'input_text_backup',
          'input_text_old',
          'raw_input',
          'symptom_text'
        )
        AND data_type IN ('text', 'character varying')
    LOOP
      EXECUTE format(
        'SELECT count(*) FROM %I.%I WHERE %I IS NOT NULL AND btrim(%I) <> '''' AND %I !~ %L',
        v_schema,
        v_table,
        v_col,
        v_col,
        v_col,
        '^[0-9a-fA-F]{64}$'
      ) INTO v_part;
      v_raw := v_raw + v_part;
    END LOOP;

    IF v_raw = 0 AND NOT v_plaintext_column THEN
      PERFORM pg_temp.record_case(
        'raw_symptom_text_rows',
        'PASS',
        'count=0'
      );
    ELSIF v_plaintext_column THEN
      PERFORM pg_temp.record_case(
        'raw_symptom_text_rows',
        'FAIL',
        format('plaintext symptom column still present; count=%s', v_raw)
      );
    ELSE
      PERFORM pg_temp.record_case(
        'raw_symptom_text_rows',
        'FAIL',
        format('count=%s', v_raw)
      );
    END IF;
  END IF;

  INSERT INTO migration_a_raw_symptom_text (raw_symptom_text_rows)
  VALUES (v_raw);

  IF to_regclass('public.ai_search_cache') IS NOT NULL
     AND EXISTS (
       SELECT 1 FROM information_schema.columns
       WHERE table_schema = 'public'
         AND table_name = 'ai_search_cache'
         AND column_name = 'input_text'
     ) THEN
    EXECUTE
      'SELECT count(*) FROM public.ai_search_cache WHERE input_text IS NOT NULL AND btrim(input_text) <> '''''
      INTO v_search;
    RAISE NOTICE
      'ai_search_cache.input_text still present (% rows). 00120 drops that column; 00090 does not.',
      v_search;
  ELSE
    RAISE NOTICE 'ai_search_cache.input_text is absent (00120 already applied, or the table has no such column).';
  END IF;

  EXECUTE 'RESET ROLE';
END
$checks$;

-- Expected: one row, raw_symptom_text_rows = 0.
SELECT raw_symptom_text_rows FROM migration_a_raw_symptom_text;

SELECT case_id, outcome, detail
FROM migration_a_check_results
ORDER BY case_id;

DO $done$
DECLARE
  v_failed integer;
BEGIN
  SELECT count(*) INTO v_failed
  FROM migration_a_check_results
  WHERE outcome <> 'PASS';

  IF v_failed > 0 THEN
    RAISE EXCEPTION 'migration A checks failed (% case(s))', v_failed;
  END IF;

  RAISE NOTICE 'migration A checks passed';
END
$done$;
