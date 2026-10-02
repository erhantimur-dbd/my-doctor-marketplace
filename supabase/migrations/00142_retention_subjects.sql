-- Date of birth kept for the child retention rule.
--
-- 00141's restricted path nulls dependents.date_of_birth and, when the
-- column exists, profiles.date_of_birth, without copying either value.
-- Production has no restricted profiles yet, so nothing has been lost.
-- The retention purge is not in this migration.
--
-- public.retention_subjects stores subject_type, subject_id, and
-- date_of_birth only. No names, emails, or other personal data.
-- subject_type is 'patient' for public.profiles and 'dependent' for
-- public.dependents. Row level security is enabled and there are no
-- policies. PUBLIC, anon, and authenticated have no privileges.
--
-- public.erase_account keeps the 00141 signature, return type, SECURITY
-- DEFINER, and search_path. The body below is the 00141 body with one
-- addition, marked retention_subjects_capture_begin/end: before the
-- hard-delete return (and therefore before either date of birth is
-- nulled), non-null dates of birth are upserted. ON CONFLICT keeps a
-- captured value, so a re-run cannot replace it with null.

CREATE TABLE public.retention_subjects (
  subject_type text NOT NULL CHECK (subject_type IN ('patient', 'dependent')),
  subject_id uuid NOT NULL,
  date_of_birth date,
  captured_at timestamptz NOT NULL DEFAULT pg_catalog.now(),
  PRIMARY KEY (subject_type, subject_id)
);

COMMENT ON TABLE public.retention_subjects IS
  'Date of birth copied before account erasure nulls or deletes it. No names, emails, or other personal data.';

ALTER TABLE public.retention_subjects ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.retention_subjects FROM PUBLIC, anon, authenticated;
GRANT ALL ON TABLE public.retention_subjects TO service_role;

CREATE OR REPLACE FUNCTION public.erase_account(p_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $fn$
DECLARE
  v_email text;
  v_restricted_at timestamptz;
  v_retain boolean := false;
  v_hit boolean;
  v_ok boolean;
  v_fk record;
  v_cols text[] := ARRAY[]::text[];
  v_sets text[] := ARRAY[]::text[];
  v_match text;
  v_sql text;
  v_emails text[] := ARRAY[]::text[];
  v_saved_email text;
  v_org uuid;
  v_orgs uuid[] := ARRAY[]::uuid[];
  v_others bigint;
  v_org_col text;
BEGIN
  IF coalesce((SELECT auth.role()), ''::text) IS DISTINCT FROM 'service_role'
     AND (SELECT auth.uid()) IS NOT NULL THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE id = p_user_id) THEN
    RAISE EXCEPTION 'user_not_found' USING ERRCODE = 'P0002';
  END IF;

  IF pg_catalog.to_regclass('public.bookings') IS NOT NULL
     AND pg_catalog.to_regclass('public.doctors') IS NOT NULL THEN
    BEGIN
      EXECUTE $active$
        SELECT EXISTS (
          SELECT 1
          FROM public.bookings AS b
          WHERE b.status IN ('confirmed', 'approved', 'pending_payment', 'pending_approval')
            AND (
              b.patient_id = $1
              OR b.doctor_id IN (
                SELECT d.id FROM public.doctors AS d WHERE d.profile_id = $1
              )
            )
        )
      $active$
        INTO v_hit
        USING p_user_id;
      IF v_hit THEN
        RAISE EXCEPTION 'active_bookings' USING ERRCODE = 'P0001';
      END IF;
    EXCEPTION
      WHEN undefined_table OR undefined_column THEN
        NULL;
    END;
  END IF;

  -- 00141. Block before any write. Stored status only; this does not call Stripe.
  IF pg_catalog.to_regclass('public.doctor_subscriptions') IS NOT NULL
     AND pg_catalog.to_regclass('public.doctors') IS NOT NULL THEN
    BEGIN
      EXECUTE $gap_stripe$
        SELECT EXISTS (
          SELECT 1
          FROM public.doctor_subscriptions AS s
          WHERE s.status IN ('active', 'trialing')
            AND s.doctor_id IN (
              SELECT d.id FROM public.doctors AS d WHERE d.profile_id = $1
            )
        )
      $gap_stripe$
        INTO v_hit
        USING p_user_id;
      IF v_hit THEN
        RAISE EXCEPTION 'erasure_blocked' USING ERRCODE = 'P0001';
      END IF;
    EXCEPTION
      WHEN undefined_table OR undefined_column THEN
        NULL;
    END;
  END IF;

  IF pg_catalog.to_regclass('public.licenses') IS NOT NULL
     AND pg_catalog.to_regclass('public.organization_members') IS NOT NULL THEN
    BEGIN
      EXECUTE $gap_lic_trial$
        SELECT EXISTS (
          SELECT 1
          FROM public.licenses AS l
          JOIN public.organization_members AS m
            ON m.organization_id = l.organization_id
          WHERE m.user_id = $1
            AND m.status = 'active'
            AND l.status = 'trialing'
        )
      $gap_lic_trial$
        INTO v_hit
        USING p_user_id;
      IF v_hit THEN
        RAISE EXCEPTION 'erasure_blocked' USING ERRCODE = 'P0001';
      END IF;
    EXCEPTION
      WHEN undefined_table OR undefined_column THEN
        NULL;
    END;

    BEGIN
      EXECUTE $gap_lic_active$
        SELECT EXISTS (
          SELECT 1
          FROM public.licenses AS l
          JOIN public.organization_members AS m
            ON m.organization_id = l.organization_id
          WHERE m.user_id = $1
            AND m.status = 'active'
            AND l.status = 'active'
        )
      $gap_lic_active$
        INTO v_hit
        USING p_user_id;
      IF v_hit THEN
        RAISE EXCEPTION 'erasure_blocked' USING ERRCODE = 'P0001';
      END IF;
    EXCEPTION
      WHEN undefined_table OR undefined_column THEN
        NULL;
    END;
  END IF;

  IF pg_catalog.to_regclass('public.organization_members') IS NOT NULL THEN
    BEGIN
      EXECUTE $gap_owner_members$
        SELECT EXISTS (
          SELECT 1
          FROM public.organization_members AS owner
          WHERE owner.user_id = $1
            AND owner.role = 'owner'
            AND owner.status = 'active'
            AND EXISTS (
              SELECT 1
              FROM public.organization_members AS other
              WHERE other.organization_id = owner.organization_id
                AND other.user_id IS DISTINCT FROM owner.user_id
                AND other.status IN ('active', 'invited', 'suspended')
            )
        )
      $gap_owner_members$
        INTO v_hit
        USING p_user_id;
      IF v_hit THEN
        RAISE EXCEPTION 'erasure_blocked' USING ERRCODE = 'P0001';
      END IF;
    EXCEPTION
      WHEN undefined_table OR undefined_column THEN
        NULL;
    END;
  END IF;

  IF pg_catalog.to_regclass('public.organization_members') IS NOT NULL
     AND pg_catalog.to_regclass('public.licenses') IS NOT NULL THEN
    BEGIN
      EXECUTE $gap_owner_licence$
        SELECT EXISTS (
          SELECT 1
          FROM public.organization_members AS owner
          JOIN public.licenses AS l
            ON l.organization_id = owner.organization_id
          WHERE owner.user_id = $1
            AND owner.role = 'owner'
            AND owner.status = 'active'
            AND l.status = 'active'
        )
      $gap_owner_licence$
        INTO v_hit
        USING p_user_id;
      IF v_hit THEN
        RAISE EXCEPTION 'erasure_blocked' USING ERRCODE = 'P0001';
      END IF;
    EXCEPTION
      WHEN undefined_table OR undefined_column THEN
        NULL;
    END;
  END IF;

  IF pg_catalog.to_regclass('public.prescriptions') IS NOT NULL
     AND pg_catalog.to_regclass('public.doctors') IS NOT NULL THEN
    BEGIN
      EXECUTE $rx$
        SELECT EXISTS (
          SELECT 1
          FROM public.prescriptions AS p
          WHERE p.patient_id = $1
             OR p.doctor_id IN (
               SELECT d.id FROM public.doctors AS d WHERE d.profile_id = $1
             )
        )
      $rx$
        INTO v_hit
        USING p_user_id;
      v_retain := coalesce(v_hit, false);
    EXCEPTION
      WHEN undefined_table OR undefined_column THEN
        v_retain := false;
    END;
  END IF;

  IF NOT v_retain AND pg_catalog.to_regclass('public.prescription_audit_log') IS NOT NULL THEN
    BEGIN
      EXECUTE $audit$
        SELECT EXISTS (
          SELECT 1
          FROM public.prescription_audit_log AS a
          WHERE a.actor_profile_id = $1
        )
      $audit$
        INTO v_hit
        USING p_user_id;
      v_retain := coalesce(v_hit, false);
    EXCEPTION
      WHEN undefined_table OR undefined_column THEN
        NULL;
    END;
  END IF;

  -- Shared medical profile: consent plus a completed booking, matching
  -- doctors_read_consented_medical_profiles. Without sharing_consent,
  -- any booking with a doctor counts as shared.
  IF NOT v_retain
     AND pg_catalog.to_regclass('public.medical_profiles') IS NOT NULL
     AND pg_catalog.to_regclass('public.bookings') IS NOT NULL THEN
    SELECT EXISTS (
      SELECT 1
      FROM pg_catalog.pg_attribute AS a
      JOIN pg_catalog.pg_class AS c ON c.oid = a.attrelid
      JOIN pg_catalog.pg_namespace AS n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public'
        AND c.relname = 'medical_profiles'
        AND a.attname = 'sharing_consent'
        AND a.attnum > 0
        AND NOT a.attisdropped
    ) INTO v_ok;
    BEGIN
      IF v_ok THEN
        EXECUTE $shared_med$
          SELECT EXISTS (
            SELECT 1
            FROM public.medical_profiles AS m
            WHERE m.patient_id = $1
              AND m.sharing_consent IS TRUE
              AND EXISTS (
                SELECT 1
                FROM public.bookings AS b
                WHERE b.patient_id = m.patient_id
                  AND b.status = 'completed'
              )
          )
        $shared_med$
          INTO v_hit
          USING p_user_id;
      ELSE
        EXECUTE $shared_med_fallback$
          SELECT EXISTS (
            SELECT 1
            FROM public.medical_profiles AS m
            WHERE m.patient_id = $1
              AND EXISTS (
                SELECT 1 FROM public.bookings AS b WHERE b.patient_id = m.patient_id
              )
          )
        $shared_med_fallback$
          INTO v_hit
          USING p_user_id;
      END IF;
      v_retain := coalesce(v_hit, false);
    EXCEPTION
      WHEN undefined_table OR undefined_column THEN
        NULL;
    END;
  END IF;

  IF NOT v_retain
     AND pg_catalog.to_regclass('public.dependent_medical_profiles') IS NOT NULL
     AND pg_catalog.to_regclass('public.dependents') IS NOT NULL
     AND pg_catalog.to_regclass('public.bookings') IS NOT NULL THEN
    SELECT EXISTS (
      SELECT 1
      FROM pg_catalog.pg_attribute AS a
      JOIN pg_catalog.pg_class AS c ON c.oid = a.attrelid
      JOIN pg_catalog.pg_namespace AS n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public'
        AND c.relname = 'dependent_medical_profiles'
        AND a.attname = 'sharing_consent'
        AND a.attnum > 0
        AND NOT a.attisdropped
    ) INTO v_ok;
    BEGIN
      IF v_ok THEN
        EXECUTE $shared_dep$
          SELECT EXISTS (
            SELECT 1
            FROM public.dependent_medical_profiles AS dmp
            JOIN public.dependents AS dep ON dep.id = dmp.dependent_id
            WHERE dep.parent_id = $1
              AND dmp.sharing_consent IS TRUE
              AND EXISTS (
                SELECT 1
                FROM public.bookings AS b
                WHERE b.dependent_id = dmp.dependent_id
                  AND b.status IN ('confirmed', 'approved', 'completed')
              )
          )
        $shared_dep$
          INTO v_hit
          USING p_user_id;
      ELSE
        EXECUTE $shared_dep_fallback$
          SELECT EXISTS (
            SELECT 1
            FROM public.dependent_medical_profiles AS dmp
            JOIN public.dependents AS dep ON dep.id = dmp.dependent_id
            WHERE dep.parent_id = $1
              AND EXISTS (
                SELECT 1
                FROM public.bookings AS b
                WHERE b.dependent_id = dmp.dependent_id
              )
          )
        $shared_dep_fallback$
          INTO v_hit
          USING p_user_id;
      END IF;
      v_retain := coalesce(v_hit, false);
    EXCEPTION
      WHEN undefined_table OR undefined_column THEN
        NULL;
    END;
  END IF;

  -- Live catalog: NO ACTION / RESTRICT foreign keys to profiles,
  -- auth.users, or this user's doctor row. Nullable keys count only
  -- when a row points here. A missing table or column is not retained.
  IF NOT v_retain THEN
    FOR v_fk IN
      SELECT
        n.nspname AS schema_name,
        c.relname AS table_name,
        a.attname AS column_name,
        ref.relname AS ref_table
      FROM pg_catalog.pg_constraint AS con
      JOIN pg_catalog.pg_class AS c ON c.oid = con.conrelid
      JOIN pg_catalog.pg_namespace AS n ON n.oid = c.relnamespace
      JOIN pg_catalog.pg_class AS ref ON ref.oid = con.confrelid
      JOIN pg_catalog.pg_namespace AS rn ON rn.oid = ref.relnamespace
      JOIN pg_catalog.pg_attribute AS a
        ON a.attrelid = c.oid
       AND a.attnum = con.conkey[1]
       AND NOT a.attisdropped
      JOIN pg_catalog.pg_attribute AS ra
        ON ra.attrelid = ref.oid
       AND ra.attnum = con.confkey[1]
       AND NOT ra.attisdropped
      WHERE con.contype = 'f'
        AND con.confdeltype IN ('a', 'r')
        AND pg_catalog.array_length(con.conkey, 1) = 1
        AND n.nspname = 'public'
        AND ra.attname = 'id'
        AND (
          (rn.nspname = 'public' AND ref.relname IN ('profiles', 'doctors'))
          OR (rn.nspname = 'auth' AND ref.relname = 'users')
        )
    LOOP
      BEGIN
        IF v_fk.ref_table = 'doctors' THEN
          EXECUTE pg_catalog.format(
            'SELECT EXISTS (SELECT 1 FROM %I.%I AS t WHERE t.%I IN (SELECT d.id FROM public.doctors AS d WHERE d.profile_id = $1))',
            v_fk.schema_name, v_fk.table_name, v_fk.column_name
          ) INTO v_hit USING p_user_id;
        ELSE
          EXECUTE pg_catalog.format(
            'SELECT EXISTS (SELECT 1 FROM %I.%I AS t WHERE t.%I = $1)',
            v_fk.schema_name, v_fk.table_name, v_fk.column_name
          ) INTO v_hit USING p_user_id;
        END IF;
      EXCEPTION
        WHEN undefined_table OR undefined_column THEN
          v_hit := false;
      END;
      IF v_hit THEN
        v_retain := true;
        EXIT;
      END IF;
    END LOOP;
  END IF;

  SELECT lower(u.email) INTO v_saved_email FROM auth.users AS u WHERE u.id = p_user_id;
  IF v_saved_email IS NOT NULL AND v_saved_email <> '' THEN
    v_emails := pg_catalog.array_append(v_emails, v_saved_email);
  END IF;

  IF pg_catalog.to_regclass('public.profiles') IS NOT NULL THEN
    SELECT COALESCE(pg_catalog.array_agg(a.attname), ARRAY[]::text[])
    INTO v_cols
    FROM pg_catalog.pg_attribute AS a
    JOIN pg_catalog.pg_class AS c ON c.oid = a.attrelid
    JOIN pg_catalog.pg_namespace AS n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relname = 'profiles'
      AND a.attnum > 0
      AND NOT a.attisdropped;
    IF 'email' = ANY (v_cols) THEN
      EXECUTE 'SELECT lower(email) FROM public.profiles WHERE id = $1'
        INTO v_saved_email
        USING p_user_id;
      IF v_saved_email IS NOT NULL
         AND v_saved_email <> ''
         AND NOT v_saved_email = ANY (v_emails) THEN
        v_emails := pg_catalog.array_append(v_emails, v_saved_email);
      END IF;
    END IF;
  END IF;

  -- Login data, consents, push tokens, and waitlists. Both paths.
  IF pg_catalog.to_regclass('auth.sessions') IS NOT NULL THEN
    BEGIN
      EXECUTE 'DELETE FROM auth.sessions WHERE user_id::text = $1'
        USING p_user_id::text;
    EXCEPTION
      WHEN undefined_table OR undefined_column THEN
        NULL;
    END;
  END IF;

  IF pg_catalog.to_regclass('auth.refresh_tokens') IS NOT NULL THEN
    BEGIN
      EXECUTE 'DELETE FROM auth.refresh_tokens WHERE user_id::text = $1'
        USING p_user_id::text;
    EXCEPTION
      WHEN undefined_table OR undefined_column THEN
        NULL;
    END;
  END IF;

  IF pg_catalog.to_regclass('auth.identities') IS NOT NULL THEN
    BEGIN
      EXECUTE 'DELETE FROM auth.identities WHERE user_id = $1'
        USING p_user_id;
    EXCEPTION
      WHEN undefined_table OR undefined_column THEN
        NULL;
    END;
  END IF;

  IF pg_catalog.to_regclass('public.cookie_consents') IS NOT NULL THEN
    SELECT COALESCE(pg_catalog.array_agg(a.attname), ARRAY[]::text[])
    INTO v_cols
    FROM pg_catalog.pg_attribute AS a
    JOIN pg_catalog.pg_class AS c ON c.oid = a.attrelid
    JOIN pg_catalog.pg_namespace AS n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relname = 'cookie_consents'
      AND a.attnum > 0
      AND NOT a.attisdropped;
    IF 'user_id' = ANY (v_cols) THEN
      EXECUTE pg_catalog.format(
        'DELETE FROM public.cookie_consents WHERE %I = $1',
        'user_id'
      ) USING p_user_id;
    END IF;
  END IF;

  IF pg_catalog.to_regclass('public.push_subscriptions') IS NOT NULL THEN
    SELECT COALESCE(pg_catalog.array_agg(a.attname), ARRAY[]::text[])
    INTO v_cols
    FROM pg_catalog.pg_attribute AS a
    JOIN pg_catalog.pg_class AS c ON c.oid = a.attrelid
    JOIN pg_catalog.pg_namespace AS n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relname = 'push_subscriptions'
      AND a.attnum > 0
      AND NOT a.attisdropped;
    IF 'user_id' = ANY (v_cols) THEN
      EXECUTE pg_catalog.format(
        'DELETE FROM public.push_subscriptions WHERE %I = $1',
        'user_id'
      ) USING p_user_id;
    END IF;
  END IF;

  IF pg_catalog.to_regclass('public.availability_alerts') IS NOT NULL THEN
    SELECT COALESCE(pg_catalog.array_agg(a.attname), ARRAY[]::text[])
    INTO v_cols
    FROM pg_catalog.pg_attribute AS a
    JOIN pg_catalog.pg_class AS c ON c.oid = a.attrelid
    JOIN pg_catalog.pg_namespace AS n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relname = 'availability_alerts'
      AND a.attnum > 0
      AND NOT a.attisdropped;
    IF 'patient_id' = ANY (v_cols) THEN
      EXECUTE pg_catalog.format(
        'DELETE FROM public.availability_alerts WHERE %I = $1',
        'patient_id'
      ) USING p_user_id;
    END IF;
    IF 'guest_email' = ANY (v_cols) AND pg_catalog.cardinality(v_emails) > 0 THEN
      EXECUTE 'DELETE FROM public.availability_alerts WHERE lower(guest_email) = ANY ($1)'
        USING v_emails;
    END IF;
  END IF;

  IF pg_catalog.to_regclass('public.specialty_waitlist') IS NOT NULL THEN
    SELECT COALESCE(pg_catalog.array_agg(a.attname), ARRAY[]::text[])
    INTO v_cols
    FROM pg_catalog.pg_attribute AS a
    JOIN pg_catalog.pg_class AS c ON c.oid = a.attrelid
    JOIN pg_catalog.pg_namespace AS n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relname = 'specialty_waitlist'
      AND a.attnum > 0
      AND NOT a.attisdropped;
    IF 'patient_id' = ANY (v_cols) THEN
      EXECUTE pg_catalog.format(
        'DELETE FROM public.specialty_waitlist WHERE %I = $1',
        'patient_id'
      ) USING p_user_id;
    END IF;
    IF 'guest_email' = ANY (v_cols) AND pg_catalog.cardinality(v_emails) > 0 THEN
      EXECUTE 'DELETE FROM public.specialty_waitlist WHERE lower(guest_email) = ANY ($1)'
        USING v_emails;
    END IF;
  END IF;

  IF pg_catalog.to_regclass('public.doctor_waitlist') IS NOT NULL
     AND pg_catalog.cardinality(v_emails) > 0 THEN
    SELECT COALESCE(pg_catalog.array_agg(a.attname), ARRAY[]::text[])
    INTO v_cols
    FROM pg_catalog.pg_attribute AS a
    JOIN pg_catalog.pg_class AS c ON c.oid = a.attrelid
    JOIN pg_catalog.pg_namespace AS n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relname = 'doctor_waitlist'
      AND a.attnum > 0
      AND NOT a.attisdropped;
    IF 'email' = ANY (v_cols) THEN
      EXECUTE 'DELETE FROM public.doctor_waitlist WHERE lower(email) = ANY ($1)'
        USING v_emails;
    END IF;
  END IF;

  IF pg_catalog.to_regclass('public.launch_notifications') IS NOT NULL
     AND pg_catalog.cardinality(v_emails) > 0 THEN
    SELECT COALESCE(pg_catalog.array_agg(a.attname), ARRAY[]::text[])
    INTO v_cols
    FROM pg_catalog.pg_attribute AS a
    JOIN pg_catalog.pg_class AS c ON c.oid = a.attrelid
    JOIN pg_catalog.pg_namespace AS n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relname = 'launch_notifications'
      AND a.attnum > 0
      AND NOT a.attisdropped;
    IF 'email' = ANY (v_cols) THEN
      EXECUTE 'DELETE FROM public.launch_notifications WHERE lower(email) = ANY ($1)'
        USING v_emails;
    END IF;
  END IF;

  -- Drop medical rows that were never shared. A shared row stays and,
  -- on the restricted path below, loses only emergency-contact identity.
  IF pg_catalog.to_regclass('public.medical_profiles') IS NOT NULL THEN
    SELECT EXISTS (
      SELECT 1
      FROM pg_catalog.pg_attribute AS a
      JOIN pg_catalog.pg_class AS c ON c.oid = a.attrelid
      JOIN pg_catalog.pg_namespace AS n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public'
        AND c.relname = 'medical_profiles'
        AND a.attname = 'sharing_consent'
        AND a.attnum > 0
        AND NOT a.attisdropped
    ) INTO v_ok;
    BEGIN
      IF v_ok AND pg_catalog.to_regclass('public.bookings') IS NOT NULL THEN
        EXECUTE $del_med$
          DELETE FROM public.medical_profiles AS m
          WHERE m.patient_id = $1
            AND NOT (
              m.sharing_consent IS TRUE
              AND EXISTS (
                SELECT 1
                FROM public.bookings AS b
                WHERE b.patient_id = m.patient_id
                  AND b.status = 'completed'
              )
            )
        $del_med$
          USING p_user_id;
      ELSIF pg_catalog.to_regclass('public.bookings') IS NOT NULL THEN
        EXECUTE $del_med_fallback$
          DELETE FROM public.medical_profiles AS m
          WHERE m.patient_id = $1
            AND NOT EXISTS (
              SELECT 1 FROM public.bookings AS b WHERE b.patient_id = m.patient_id
            )
        $del_med_fallback$
          USING p_user_id;
      ELSE
        EXECUTE 'DELETE FROM public.medical_profiles WHERE patient_id = $1'
          USING p_user_id;
      END IF;
    EXCEPTION
      WHEN undefined_table OR undefined_column THEN
        NULL;
    END;
  END IF;

  IF pg_catalog.to_regclass('public.dependent_medical_profiles') IS NOT NULL
     AND pg_catalog.to_regclass('public.dependents') IS NOT NULL THEN
    SELECT EXISTS (
      SELECT 1
      FROM pg_catalog.pg_attribute AS a
      JOIN pg_catalog.pg_class AS c ON c.oid = a.attrelid
      JOIN pg_catalog.pg_namespace AS n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public'
        AND c.relname = 'dependent_medical_profiles'
        AND a.attname = 'sharing_consent'
        AND a.attnum > 0
        AND NOT a.attisdropped
    ) INTO v_ok;
    BEGIN
      IF v_ok AND pg_catalog.to_regclass('public.bookings') IS NOT NULL THEN
        EXECUTE $del_dep$
          DELETE FROM public.dependent_medical_profiles AS dmp
          USING public.dependents AS dep
          WHERE dmp.dependent_id = dep.id
            AND dep.parent_id = $1
            AND NOT (
              dmp.sharing_consent IS TRUE
              AND EXISTS (
                SELECT 1
                FROM public.bookings AS b
                WHERE b.dependent_id = dmp.dependent_id
                  AND b.status IN ('confirmed', 'approved', 'completed')
              )
            )
        $del_dep$
          USING p_user_id;
      ELSIF pg_catalog.to_regclass('public.bookings') IS NOT NULL THEN
        EXECUTE $del_dep_fallback$
          DELETE FROM public.dependent_medical_profiles AS dmp
          USING public.dependents AS dep
          WHERE dmp.dependent_id = dep.id
            AND dep.parent_id = $1
            AND NOT EXISTS (
              SELECT 1
              FROM public.bookings AS b
              WHERE b.dependent_id = dmp.dependent_id
            )
        $del_dep_fallback$
          USING p_user_id;
      ELSE
        EXECUTE $del_dep_all$
          DELETE FROM public.dependent_medical_profiles AS dmp
          USING public.dependents AS dep
          WHERE dmp.dependent_id = dep.id
            AND dep.parent_id = $1
        $del_dep_all$
          USING p_user_id;
      END IF;
    EXCEPTION
      WHEN undefined_table OR undefined_column THEN
        NULL;
    END;
  END IF;


  -- 00141. CASCADE financial, plan, message, membership, and wallet rows
  -- still take the restricted path. Invoices and platform_fees stay for tax.
  -- There is no public.payments table in this repo; platform_fees is the
  -- payment ledger. public.payments is checked only when that table exists.
  IF NOT v_retain
     AND pg_catalog.to_regclass('public.doctor_subscriptions') IS NOT NULL
     AND pg_catalog.to_regclass('public.doctors') IS NOT NULL THEN
    BEGIN
      EXECUTE $gap_keep_subs$
        SELECT EXISTS (
          SELECT 1
          FROM public.doctor_subscriptions AS s
          WHERE s.doctor_id IN (
            SELECT d.id FROM public.doctors AS d WHERE d.profile_id = $1
          )
        )
      $gap_keep_subs$
        INTO v_hit
        USING p_user_id;
      v_retain := coalesce(v_hit, false);
    EXCEPTION
      WHEN undefined_table OR undefined_column THEN
        NULL;
    END;
  END IF;

  IF NOT v_retain AND pg_catalog.to_regclass('public.invoices') IS NOT NULL THEN
    BEGIN
      EXECUTE $gap_keep_inv_patient$
        SELECT EXISTS (
          SELECT 1 FROM public.invoices AS i WHERE i.patient_id = $1
        )
      $gap_keep_inv_patient$
        INTO v_hit
        USING p_user_id;
      v_retain := coalesce(v_hit, false);
      IF NOT v_retain AND pg_catalog.to_regclass('public.doctors') IS NOT NULL THEN
        EXECUTE $gap_keep_inv_doctor$
          SELECT EXISTS (
            SELECT 1
            FROM public.invoices AS i
            WHERE i.doctor_id IN (
              SELECT d.id FROM public.doctors AS d WHERE d.profile_id = $1
            )
          )
        $gap_keep_inv_doctor$
          INTO v_hit
          USING p_user_id;
        v_retain := coalesce(v_hit, false);
      END IF;
    EXCEPTION
      WHEN undefined_table OR undefined_column THEN
        NULL;
    END;
  END IF;

  IF NOT v_retain
     AND pg_catalog.to_regclass('public.platform_fees') IS NOT NULL
     AND pg_catalog.to_regclass('public.doctors') IS NOT NULL THEN
    BEGIN
      EXECUTE $gap_keep_fees$
        SELECT EXISTS (
          SELECT 1
          FROM public.platform_fees AS f
          WHERE f.doctor_id IN (
            SELECT d.id FROM public.doctors AS d WHERE d.profile_id = $1
          )
        )
      $gap_keep_fees$
        INTO v_hit
        USING p_user_id;
      v_retain := coalesce(v_hit, false);
    EXCEPTION
      WHEN undefined_table OR undefined_column THEN
        NULL;
    END;
  END IF;

  IF NOT v_retain AND pg_catalog.to_regclass('public.payments') IS NOT NULL THEN
    BEGIN
      SELECT EXISTS (
        SELECT 1
        FROM pg_catalog.pg_attribute AS a
        JOIN pg_catalog.pg_class AS c ON c.oid = a.attrelid
        JOIN pg_catalog.pg_namespace AS n ON n.oid = c.relnamespace
        WHERE n.nspname = 'public'
          AND c.relname = 'payments'
          AND a.attname = 'patient_id'
          AND a.attnum > 0
          AND NOT a.attisdropped
      ) INTO v_ok;
      IF v_ok THEN
        EXECUTE $gap_keep_pay_patient$
          SELECT EXISTS (
            SELECT 1 FROM public.payments AS p WHERE p.patient_id = $1
          )
        $gap_keep_pay_patient$
          INTO v_hit
          USING p_user_id;
        v_retain := coalesce(v_hit, false);
      END IF;
      IF NOT v_retain AND pg_catalog.to_regclass('public.doctors') IS NOT NULL THEN
        SELECT EXISTS (
          SELECT 1
          FROM pg_catalog.pg_attribute AS a
          JOIN pg_catalog.pg_class AS c ON c.oid = a.attrelid
          JOIN pg_catalog.pg_namespace AS n ON n.oid = c.relnamespace
          WHERE n.nspname = 'public'
            AND c.relname = 'payments'
            AND a.attname = 'doctor_id'
            AND a.attnum > 0
            AND NOT a.attisdropped
        ) INTO v_ok;
        IF v_ok THEN
          EXECUTE $gap_keep_pay_doctor$
            SELECT EXISTS (
              SELECT 1
              FROM public.payments AS p
              WHERE p.doctor_id IN (
                SELECT d.id FROM public.doctors AS d WHERE d.profile_id = $1
              )
            )
          $gap_keep_pay_doctor$
            INTO v_hit
            USING p_user_id;
          v_retain := coalesce(v_hit, false);
        END IF;
      END IF;
    EXCEPTION
      WHEN undefined_table OR undefined_column THEN
        NULL;
    END;
  END IF;

  IF NOT v_retain AND pg_catalog.to_regclass('public.treatment_plans') IS NOT NULL THEN
    BEGIN
      EXECUTE $gap_keep_plans_patient$
        SELECT EXISTS (
          SELECT 1 FROM public.treatment_plans AS t WHERE t.patient_id = $1
        )
      $gap_keep_plans_patient$
        INTO v_hit
        USING p_user_id;
      v_retain := coalesce(v_hit, false);
      IF NOT v_retain AND pg_catalog.to_regclass('public.doctors') IS NOT NULL THEN
        EXECUTE $gap_keep_plans_doctor$
          SELECT EXISTS (
            SELECT 1
            FROM public.treatment_plans AS t
            WHERE t.doctor_id IN (
              SELECT d.id FROM public.doctors AS d WHERE d.profile_id = $1
            )
          )
        $gap_keep_plans_doctor$
          INTO v_hit
          USING p_user_id;
        v_retain := coalesce(v_hit, false);
      END IF;
    EXCEPTION
      WHEN undefined_table OR undefined_column THEN
        NULL;
    END;
  END IF;

  IF NOT v_retain AND pg_catalog.to_regclass('public.conversations') IS NOT NULL THEN
    BEGIN
      EXECUTE $gap_keep_conv_patient$
        SELECT EXISTS (
          SELECT 1 FROM public.conversations AS c WHERE c.patient_id = $1
        )
      $gap_keep_conv_patient$
        INTO v_hit
        USING p_user_id;
      v_retain := coalesce(v_hit, false);
      IF NOT v_retain AND pg_catalog.to_regclass('public.doctors') IS NOT NULL THEN
        EXECUTE $gap_keep_conv_doctor$
          SELECT EXISTS (
            SELECT 1
            FROM public.conversations AS c
            WHERE c.doctor_id IN (
              SELECT d.id FROM public.doctors AS d WHERE d.profile_id = $1
            )
          )
        $gap_keep_conv_doctor$
          INTO v_hit
          USING p_user_id;
        v_retain := coalesce(v_hit, false);
      END IF;
    EXCEPTION
      WHEN undefined_table OR undefined_column THEN
        NULL;
    END;
  END IF;

  IF NOT v_retain AND pg_catalog.to_regclass('public.direct_messages') IS NOT NULL THEN
    BEGIN
      EXECUTE $gap_keep_dm$
        SELECT EXISTS (
          SELECT 1 FROM public.direct_messages AS m WHERE m.sender_id = $1
        )
      $gap_keep_dm$
        INTO v_hit
        USING p_user_id;
      v_retain := coalesce(v_hit, false);
    EXCEPTION
      WHEN undefined_table OR undefined_column THEN
        NULL;
    END;
  END IF;

  IF NOT v_retain AND pg_catalog.to_regclass('public.organization_members') IS NOT NULL THEN
    BEGIN
      EXECUTE $gap_keep_members$
        SELECT EXISTS (
          SELECT 1 FROM public.organization_members AS m WHERE m.user_id = $1
        )
      $gap_keep_members$
        INTO v_hit
        USING p_user_id;
      v_retain := coalesce(v_hit, false);
    EXCEPTION
      WHEN undefined_table OR undefined_column THEN
        NULL;
    END;
  END IF;

  IF NOT v_retain AND pg_catalog.to_regclass('public.patient_wallet') IS NOT NULL THEN
    BEGIN
      EXECUTE $gap_keep_wallet$
        SELECT EXISTS (
          SELECT 1 FROM public.patient_wallet AS w WHERE w.patient_id = $1
        )
      $gap_keep_wallet$
        INTO v_hit
        USING p_user_id;
      v_retain := coalesce(v_hit, false);
    EXCEPTION
      WHEN undefined_table OR undefined_column THEN
        NULL;
    END;
  END IF;

  -- retention_subjects_capture_begin
  -- 00142. Copy date of birth before the hard-delete return, which is also
  -- before the restricted path nulls profiles.date_of_birth and
  -- dependents.date_of_birth. Blocked erasures raise above and write
  -- nothing. A null date of birth is skipped. ON CONFLICT keeps a value
  -- already captured, including when a later pass would write null.
  IF pg_catalog.to_regclass('public.profiles') IS NOT NULL
     AND EXISTS (
       SELECT 1
       FROM pg_catalog.pg_attribute AS a
       JOIN pg_catalog.pg_class AS c ON c.oid = a.attrelid
       JOIN pg_catalog.pg_namespace AS n ON n.oid = c.relnamespace
       WHERE n.nspname = 'public'
         AND c.relname = 'profiles'
         AND a.attname = 'date_of_birth'
         AND a.attnum > 0
         AND NOT a.attisdropped
     ) THEN
    EXECUTE $dob_patient$
      INSERT INTO public.retention_subjects (subject_type, subject_id, date_of_birth)
      SELECT 'patient', p.id, p.date_of_birth
      FROM public.profiles AS p
      WHERE p.id = $1
        AND p.date_of_birth IS NOT NULL
      ON CONFLICT (subject_type, subject_id) DO UPDATE
      SET date_of_birth = coalesce(retention_subjects.date_of_birth, excluded.date_of_birth)
    $dob_patient$
      USING p_user_id;
  END IF;

  IF pg_catalog.to_regclass('public.dependents') IS NOT NULL
     AND EXISTS (
       SELECT 1
       FROM pg_catalog.pg_attribute AS a
       JOIN pg_catalog.pg_class AS c ON c.oid = a.attrelid
       JOIN pg_catalog.pg_namespace AS n ON n.oid = c.relnamespace
       WHERE n.nspname = 'public'
         AND c.relname = 'dependents'
         AND a.attname = 'date_of_birth'
         AND a.attnum > 0
         AND NOT a.attisdropped
     )
     AND EXISTS (
       SELECT 1
       FROM pg_catalog.pg_attribute AS a
       JOIN pg_catalog.pg_class AS c ON c.oid = a.attrelid
       JOIN pg_catalog.pg_namespace AS n ON n.oid = c.relnamespace
       WHERE n.nspname = 'public'
         AND c.relname = 'dependents'
         AND a.attname = 'parent_id'
         AND a.attnum > 0
         AND NOT a.attisdropped
     ) THEN
    EXECUTE $dob_dependent$
      INSERT INTO public.retention_subjects (subject_type, subject_id, date_of_birth)
      SELECT 'dependent', d.id, d.date_of_birth
      FROM public.dependents AS d
      WHERE d.parent_id = $1
        AND d.date_of_birth IS NOT NULL
      ON CONFLICT (subject_type, subject_id) DO UPDATE
      SET date_of_birth = coalesce(retention_subjects.date_of_birth, excluded.date_of_birth)
    $dob_dependent$
      USING p_user_id;
  END IF;

  -- retention_subjects_capture_end
  IF NOT v_retain THEN
    RETURN pg_catalog.jsonb_build_object('mode', 'hard_delete');
  END IF;

  v_email := 'erased+' || p_user_id::text || '@users.invalid';

  SELECT COALESCE(pg_catalog.array_agg(a.attname), ARRAY[]::text[])
  INTO v_cols
  FROM pg_catalog.pg_attribute AS a
  JOIN pg_catalog.pg_class AS c ON c.oid = a.attrelid
  JOIN pg_catalog.pg_namespace AS n ON n.oid = c.relnamespace
  WHERE n.nspname = 'public'
    AND c.relname = 'profiles'
    AND a.attnum > 0
    AND NOT a.attisdropped;

  v_sets := ARRAY[]::text[];
  IF 'first_name' = ANY (v_cols) THEN
    v_sets := v_sets || pg_catalog.format('%I = %L', 'first_name', '');
  END IF;
  IF 'last_name' = ANY (v_cols) THEN
    v_sets := v_sets || pg_catalog.format('%I = %L', 'last_name', '');
  END IF;
  IF 'email' = ANY (v_cols) THEN
    v_sets := v_sets || pg_catalog.format('%I = %L', 'email', v_email);
  END IF;
  IF 'phone' = ANY (v_cols) THEN
    v_sets := v_sets || pg_catalog.format('%I = NULL', 'phone');
  END IF;
  IF 'avatar_url' = ANY (v_cols) THEN
    v_sets := v_sets || pg_catalog.format('%I = NULL', 'avatar_url');
  END IF;
  IF 'address_line1' = ANY (v_cols) THEN
    v_sets := v_sets || pg_catalog.format('%I = NULL', 'address_line1');
  END IF;
  IF 'address_line2' = ANY (v_cols) THEN
    v_sets := v_sets || pg_catalog.format('%I = NULL', 'address_line2');
  END IF;
  IF 'city' = ANY (v_cols) THEN
    v_sets := v_sets || pg_catalog.format('%I = NULL', 'city');
  END IF;
  IF 'state' = ANY (v_cols) THEN
    v_sets := v_sets || pg_catalog.format('%I = NULL', 'state');
  END IF;
  IF 'postal_code' = ANY (v_cols) THEN
    v_sets := v_sets || pg_catalog.format('%I = NULL', 'postal_code');
  END IF;
  IF 'country' = ANY (v_cols) THEN
    v_sets := v_sets || pg_catalog.format('%I = NULL', 'country');
  END IF;
  IF 'date_of_birth' = ANY (v_cols) THEN
    v_sets := v_sets || pg_catalog.format('%I = NULL', 'date_of_birth');
  END IF;
  IF 'restricted_at' = ANY (v_cols) THEN
    v_sets := v_sets || pg_catalog.format(
      '%I = coalesce(%I, pg_catalog.now())',
      'restricted_at',
      'restricted_at'
    );
  END IF;
  IF pg_catalog.cardinality(v_sets) > 0 AND 'id' = ANY (v_cols) THEN
    EXECUTE pg_catalog.format(
      'UPDATE public.profiles SET %s WHERE %I = $1',
      pg_catalog.array_to_string(v_sets, ', '),
      'id'
    ) USING p_user_id;
  END IF;

  v_restricted_at := NULL;
  IF 'restricted_at' = ANY (v_cols) THEN
    EXECUTE pg_catalog.format(
      'SELECT %I FROM public.profiles WHERE id = $1',
      'restricted_at'
    ) INTO v_restricted_at USING p_user_id;
  END IF;

  v_match := NULL;
  IF pg_catalog.to_regclass('public.doctors') IS NOT NULL THEN
    SELECT COALESCE(pg_catalog.array_agg(a.attname), ARRAY[]::text[])
    INTO v_cols
    FROM pg_catalog.pg_attribute AS a
    JOIN pg_catalog.pg_class AS c ON c.oid = a.attrelid
    JOIN pg_catalog.pg_namespace AS n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relname = 'doctors'
      AND a.attnum > 0
      AND NOT a.attisdropped;

    v_sets := ARRAY[]::text[];
    IF 'is_active' = ANY (v_cols) THEN
      v_sets := v_sets || pg_catalog.format('%I = FALSE', 'is_active');
    END IF;
    IF 'is_featured' = ANY (v_cols) THEN
      v_sets := v_sets || pg_catalog.format('%I = FALSE', 'is_featured');
    END IF;
    IF 'featured_until' = ANY (v_cols) THEN
      v_sets := v_sets || pg_catalog.format('%I = NULL', 'featured_until');
    END IF;
    IF 'verification_status' = ANY (v_cols) THEN
      v_sets := v_sets || pg_catalog.format('%I = %L', 'verification_status', 'suspended');
    END IF;
    IF 'bio' = ANY (v_cols) THEN
      v_sets := v_sets || pg_catalog.format('%I = NULL', 'bio');
    END IF;
    IF 'address' = ANY (v_cols) THEN
      v_sets := v_sets || pg_catalog.format('%I = NULL', 'address');
    END IF;
    IF 'city' = ANY (v_cols) THEN
      v_sets := v_sets || pg_catalog.format('%I = NULL', 'city');
    END IF;
    IF 'postal_code' = ANY (v_cols) THEN
      v_sets := v_sets || pg_catalog.format('%I = NULL', 'postal_code');
    END IF;
    IF 'clinic_name' = ANY (v_cols) THEN
      v_sets := v_sets || pg_catalog.format('%I = NULL', 'clinic_name');
    END IF;
    IF 'clinic_latitude' = ANY (v_cols) THEN
      v_sets := v_sets || pg_catalog.format('%I = NULL', 'clinic_latitude');
    END IF;
    IF 'clinic_longitude' = ANY (v_cols) THEN
      v_sets := v_sets || pg_catalog.format('%I = NULL', 'clinic_longitude');
    END IF;
    IF 'education' = ANY (v_cols) THEN
      v_sets := v_sets || pg_catalog.format('%I = %L::jsonb', 'education', '[]');
    END IF;
    IF 'certifications' = ANY (v_cols) THEN
      v_sets := v_sets || pg_catalog.format('%I = %L::jsonb', 'certifications', '[]');
    END IF;
    IF 'meta_title' = ANY (v_cols) THEN
      v_sets := v_sets || pg_catalog.format('%I = NULL', 'meta_title');
    END IF;
    IF 'meta_description' = ANY (v_cols) THEN
      v_sets := v_sets || pg_catalog.format('%I = NULL', 'meta_description');
    END IF;
    IF 'profile_video_path' = ANY (v_cols) THEN
      v_sets := v_sets || pg_catalog.format('%I = NULL', 'profile_video_path');
    END IF;
    IF 'profile_video_status' = ANY (v_cols) THEN
      v_sets := v_sets || pg_catalog.format('%I = NULL', 'profile_video_status');
    END IF;
    IF 'profile_video_uploaded_at' = ANY (v_cols) THEN
      v_sets := v_sets || pg_catalog.format('%I = NULL', 'profile_video_uploaded_at');
    END IF;
    IF 'profile_video_reviewed_at' = ANY (v_cols) THEN
      v_sets := v_sets || pg_catalog.format('%I = NULL', 'profile_video_reviewed_at');
    END IF;
    IF 'profile_video_rejection_reason' = ANY (v_cols) THEN
      v_sets := v_sets || pg_catalog.format('%I = NULL', 'profile_video_rejection_reason');
    END IF;
    IF 'gender' = ANY (v_cols) THEN
      v_sets := v_sets || pg_catalog.format('%I = NULL', 'gender');
    END IF;
    IF 'slug' = ANY (v_cols) AND 'id' = ANY (v_cols) THEN
      v_sets := v_sets || pg_catalog.format('%I = %L || id::text', 'slug', 'erased-');
    END IF;
    IF 'referral_code' = ANY (v_cols) AND 'id' = ANY (v_cols) THEN
      v_sets := v_sets || pg_catalog.format(
        '%I = %L || pg_catalog.replace(id::text, %L, %L)',
        'referral_code', 'erased', '-', ''
      );
    END IF;
    IF 'ics_feed_token' = ANY (v_cols) THEN
      v_sets := v_sets || pg_catalog.format('%I = NULL', 'ics_feed_token');
    END IF;
    IF pg_catalog.cardinality(v_sets) > 0 AND 'profile_id' = ANY (v_cols) THEN
      EXECUTE pg_catalog.format(
        'UPDATE public.doctors SET %s WHERE %I = $1',
        pg_catalog.array_to_string(v_sets, ', '),
        'profile_id'
      ) USING p_user_id;
    END IF;
    IF 'id' = ANY (v_cols) AND 'profile_id' = ANY (v_cols) THEN
      v_match := pg_catalog.format(
        'SELECT d.%I FROM public.doctors AS d WHERE d.%I = $1',
        'id',
        'profile_id'
      );
    END IF;
  END IF;

  IF v_match IS NOT NULL AND pg_catalog.to_regclass('public.doctor_photos') IS NOT NULL THEN
    SELECT COALESCE(pg_catalog.array_agg(a.attname), ARRAY[]::text[])
    INTO v_cols
    FROM pg_catalog.pg_attribute AS a
    JOIN pg_catalog.pg_class AS c ON c.oid = a.attrelid
    JOIN pg_catalog.pg_namespace AS n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relname = 'doctor_photos'
      AND a.attnum > 0
      AND NOT a.attisdropped;
    IF 'doctor_id' = ANY (v_cols) THEN
      EXECUTE pg_catalog.format(
        'DELETE FROM public.doctor_photos WHERE %I IN (%s)',
        'doctor_id',
        v_match
      ) USING p_user_id;
    END IF;
  END IF;

  IF v_match IS NOT NULL AND pg_catalog.to_regclass('public.doctor_faqs') IS NOT NULL THEN
    SELECT COALESCE(pg_catalog.array_agg(a.attname), ARRAY[]::text[])
    INTO v_cols
    FROM pg_catalog.pg_attribute AS a
    JOIN pg_catalog.pg_class AS c ON c.oid = a.attrelid
    JOIN pg_catalog.pg_namespace AS n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relname = 'doctor_faqs'
      AND a.attnum > 0
      AND NOT a.attisdropped;
    IF 'doctor_id' = ANY (v_cols) THEN
      EXECUTE pg_catalog.format(
        'DELETE FROM public.doctor_faqs WHERE %I IN (%s)',
        'doctor_id',
        v_match
      ) USING p_user_id;
    END IF;
  END IF;

  IF v_match IS NOT NULL AND pg_catalog.to_regclass('public.doctor_calendar_connections') IS NOT NULL THEN
    SELECT COALESCE(pg_catalog.array_agg(a.attname), ARRAY[]::text[])
    INTO v_cols
    FROM pg_catalog.pg_attribute AS a
    JOIN pg_catalog.pg_class AS c ON c.oid = a.attrelid
    JOIN pg_catalog.pg_namespace AS n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relname = 'doctor_calendar_connections'
      AND a.attnum > 0
      AND NOT a.attisdropped;
    IF 'doctor_id' = ANY (v_cols) THEN
      EXECUTE pg_catalog.format(
        'DELETE FROM public.doctor_calendar_connections WHERE %I IN (%s)',
        'doctor_id',
        v_match
      ) USING p_user_id;
    END IF;
  END IF;

  IF v_match IS NOT NULL AND pg_catalog.to_regclass('public.doctor_testing_locations') IS NOT NULL THEN
    SELECT COALESCE(pg_catalog.array_agg(a.attname), ARRAY[]::text[])
    INTO v_cols
    FROM pg_catalog.pg_attribute AS a
    JOIN pg_catalog.pg_class AS c ON c.oid = a.attrelid
    JOIN pg_catalog.pg_namespace AS n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relname = 'doctor_testing_locations'
      AND a.attnum > 0
      AND NOT a.attisdropped;
    v_sets := ARRAY[]::text[];
    IF 'name' = ANY (v_cols) THEN
      v_sets := v_sets || pg_catalog.format('%I = %L', 'name', '');
    END IF;
    IF 'address' = ANY (v_cols) THEN
      v_sets := v_sets || pg_catalog.format('%I = %L', 'address', '');
    END IF;
    IF 'city' = ANY (v_cols) THEN
      v_sets := v_sets || pg_catalog.format('%I = %L', 'city', '');
    END IF;
    IF 'postal_code' = ANY (v_cols) THEN
      v_sets := v_sets || pg_catalog.format('%I = NULL', 'postal_code');
    END IF;
    IF 'phone' = ANY (v_cols) THEN
      v_sets := v_sets || pg_catalog.format('%I = NULL', 'phone');
    END IF;
    IF 'latitude' = ANY (v_cols) THEN
      v_sets := v_sets || pg_catalog.format('%I = NULL', 'latitude');
    END IF;
    IF 'longitude' = ANY (v_cols) THEN
      v_sets := v_sets || pg_catalog.format('%I = NULL', 'longitude');
    END IF;
    IF 'is_active' = ANY (v_cols) THEN
      v_sets := v_sets || pg_catalog.format('%I = FALSE', 'is_active');
    END IF;
    IF pg_catalog.cardinality(v_sets) > 0 AND 'doctor_id' = ANY (v_cols) THEN
      EXECUTE pg_catalog.format(
        'UPDATE public.doctor_testing_locations SET %s WHERE %I IN (%s)',
        pg_catalog.array_to_string(v_sets, ', '),
        'doctor_id',
        v_match
      ) USING p_user_id;
    END IF;
  END IF;

  IF pg_catalog.to_regclass('public.dependents') IS NOT NULL THEN
    SELECT COALESCE(pg_catalog.array_agg(a.attname), ARRAY[]::text[])
    INTO v_cols
    FROM pg_catalog.pg_attribute AS a
    JOIN pg_catalog.pg_class AS c ON c.oid = a.attrelid
    JOIN pg_catalog.pg_namespace AS n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relname = 'dependents'
      AND a.attnum > 0
      AND NOT a.attisdropped;
    v_sets := ARRAY[]::text[];
    IF 'first_name' = ANY (v_cols) THEN
      v_sets := v_sets || pg_catalog.format('%I = %L', 'first_name', '');
    END IF;
    IF 'last_name' = ANY (v_cols) THEN
      v_sets := v_sets || pg_catalog.format('%I = %L', 'last_name', '');
    END IF;
    IF 'date_of_birth' = ANY (v_cols) THEN
      v_sets := v_sets || pg_catalog.format('%I = NULL', 'date_of_birth');
    END IF;
    IF 'notes' = ANY (v_cols) THEN
      v_sets := v_sets || pg_catalog.format('%I = NULL', 'notes');
    END IF;
    IF pg_catalog.cardinality(v_sets) > 0 AND 'parent_id' = ANY (v_cols) THEN
      EXECUTE pg_catalog.format(
        'UPDATE public.dependents SET %s WHERE %I = $1',
        pg_catalog.array_to_string(v_sets, ', '),
        'parent_id'
      ) USING p_user_id;
    END IF;
  END IF;

  IF pg_catalog.to_regclass('public.dependent_medical_profiles') IS NOT NULL
     AND pg_catalog.to_regclass('public.dependents') IS NOT NULL THEN
    SELECT COALESCE(pg_catalog.array_agg(a.attname), ARRAY[]::text[])
    INTO v_cols
    FROM pg_catalog.pg_attribute AS a
    JOIN pg_catalog.pg_class AS c ON c.oid = a.attrelid
    JOIN pg_catalog.pg_namespace AS n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relname = 'dependent_medical_profiles'
      AND a.attnum > 0
      AND NOT a.attisdropped;
    v_sets := ARRAY[]::text[];
    IF 'emergency_contact_name' = ANY (v_cols) THEN
      v_sets := v_sets || pg_catalog.format('%I = NULL', 'emergency_contact_name');
    END IF;
    IF 'emergency_contact_phone' = ANY (v_cols) THEN
      v_sets := v_sets || pg_catalog.format('%I = NULL', 'emergency_contact_phone');
    END IF;
    IF pg_catalog.cardinality(v_sets) > 0 AND 'dependent_id' = ANY (v_cols) THEN
      EXECUTE pg_catalog.format(
        'UPDATE public.dependent_medical_profiles SET %s WHERE %I IN (SELECT dep.id FROM public.dependents AS dep WHERE dep.parent_id = $1)',
        pg_catalog.array_to_string(v_sets, ', '),
        'dependent_id'
      ) USING p_user_id;
    END IF;
  END IF;

  IF pg_catalog.to_regclass('public.medical_profiles') IS NOT NULL THEN
    SELECT COALESCE(pg_catalog.array_agg(a.attname), ARRAY[]::text[])
    INTO v_cols
    FROM pg_catalog.pg_attribute AS a
    JOIN pg_catalog.pg_class AS c ON c.oid = a.attrelid
    JOIN pg_catalog.pg_namespace AS n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relname = 'medical_profiles'
      AND a.attnum > 0
      AND NOT a.attisdropped;
    v_sets := ARRAY[]::text[];
    IF 'emergency_contact_name' = ANY (v_cols) THEN
      v_sets := v_sets || pg_catalog.format('%I = NULL', 'emergency_contact_name');
    END IF;
    IF 'emergency_contact_phone' = ANY (v_cols) THEN
      v_sets := v_sets || pg_catalog.format('%I = NULL', 'emergency_contact_phone');
    END IF;
    IF pg_catalog.cardinality(v_sets) > 0 AND 'patient_id' = ANY (v_cols) THEN
      EXECUTE pg_catalog.format(
        'UPDATE public.medical_profiles SET %s WHERE %I = $1',
        pg_catalog.array_to_string(v_sets, ', '),
        'patient_id'
      ) USING p_user_id;
    END IF;
  END IF;

  IF pg_catalog.to_regclass('public.bookings') IS NOT NULL THEN
    SELECT COALESCE(pg_catalog.array_agg(a.attname), ARRAY[]::text[])
    INTO v_cols
    FROM pg_catalog.pg_attribute AS a
    JOIN pg_catalog.pg_class AS c ON c.oid = a.attrelid
    JOIN pg_catalog.pg_namespace AS n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relname = 'bookings'
      AND a.attnum > 0
      AND NOT a.attisdropped;
    IF 'patient_notes' = ANY (v_cols)
       AND 'patient_id' = ANY (v_cols)
       AND 'status' = ANY (v_cols) THEN
      EXECUTE pg_catalog.format(
        'UPDATE public.bookings SET %I = NULL WHERE %I = $1 AND %I IN (%L, %L, %L, %L)',
        'patient_notes',
        'patient_id',
        'status',
        'completed',
        'cancelled_patient',
        'cancelled_doctor',
        'no_show'
      ) USING p_user_id;
    END IF;
  END IF;

  IF pg_catalog.to_regclass('public.reviews') IS NOT NULL THEN
    SELECT COALESCE(pg_catalog.array_agg(a.attname), ARRAY[]::text[])
    INTO v_cols
    FROM pg_catalog.pg_attribute AS a
    JOIN pg_catalog.pg_class AS c ON c.oid = a.attrelid
    JOIN pg_catalog.pg_namespace AS n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relname = 'reviews'
      AND a.attnum > 0
      AND NOT a.attisdropped;

    -- Open dispute on this review's booking. Support tickets have no
    -- review or booking link, so they are not part of this predicate.
    v_sql := 'FALSE';
    IF 'booking_id' = ANY (v_cols)
       AND pg_catalog.to_regclass('public.payment_corrections') IS NOT NULL THEN
      SELECT (
        SELECT count(*)
        FROM pg_catalog.pg_attribute AS a
        JOIN pg_catalog.pg_class AS c ON c.oid = a.attrelid
        JOIN pg_catalog.pg_namespace AS n ON n.oid = c.relnamespace
        WHERE n.nspname = 'public'
          AND c.relname = 'payment_corrections'
          AND a.attname IN ('booking_id', 'disputed_at', 'dispute_resolved_at')
          AND a.attnum > 0
          AND NOT a.attisdropped
      ) = 3 INTO v_ok;
      IF v_ok THEN
        v_sql := v_sql || ' OR EXISTS (SELECT 1 FROM public.payment_corrections AS pc WHERE pc.booking_id = r.booking_id AND pc.disputed_at IS NOT NULL AND pc.dispute_resolved_at IS NULL)';
      END IF;
    END IF;
    IF 'booking_id' = ANY (v_cols)
       AND pg_catalog.to_regclass('public.bookings') IS NOT NULL THEN
      SELECT EXISTS (
        SELECT 1
        FROM pg_catalog.pg_attribute AS a
        JOIN pg_catalog.pg_class AS c ON c.oid = a.attrelid
        JOIN pg_catalog.pg_namespace AS n ON n.oid = c.relnamespace
        WHERE n.nspname = 'public'
          AND c.relname = 'bookings'
          AND a.attname = 'stripe_dispute_status'
          AND a.attnum > 0
          AND NOT a.attisdropped
      ) INTO v_ok;
      IF v_ok THEN
        v_sql := v_sql || ' OR EXISTS (SELECT 1 FROM public.bookings AS b WHERE b.id = r.booking_id AND b.stripe_dispute_status IN (''needs_response'', ''under_review'', ''warning_needs_response'', ''warning_under_review''))';
      END IF;
    END IF;

    v_sets := ARRAY[]::text[];
    IF 'title' = ANY (v_cols) THEN
      v_sets := v_sets || pg_catalog.format('%I = NULL', 'title');
    END IF;
    IF 'comment' = ANY (v_cols) THEN
      v_sets := v_sets || pg_catalog.format('%I = NULL', 'comment');
    END IF;
    IF pg_catalog.cardinality(v_sets) > 0 AND 'patient_id' = ANY (v_cols) THEN
      EXECUTE pg_catalog.format(
        'UPDATE public.reviews AS r SET %s WHERE r.%I = $1 AND NOT (%s)',
        pg_catalog.array_to_string(v_sets, ', '),
        'patient_id',
        v_sql
      ) USING p_user_id;
    END IF;

    IF v_match IS NOT NULL AND 'doctor_response' = ANY (v_cols) AND 'doctor_id' = ANY (v_cols) THEN
      EXECUTE pg_catalog.format(
        'UPDATE public.reviews AS r SET %I = NULL WHERE r.%I IN (%s) AND NOT (%s)',
        'doctor_response',
        'doctor_id',
        v_match,
        v_sql
      ) USING p_user_id;
    END IF;
  END IF;

  -- 00141. A restricted doctor is no longer the active organisation owner.
  -- The sole member's clinic name, slug, email, phone, and brand contact
  -- fields are scrubbed. Brand columns are assigned only when present.
  IF pg_catalog.to_regclass('public.organization_members') IS NOT NULL
     AND pg_catalog.to_regclass('public.organizations') IS NOT NULL THEN
    BEGIN
      v_orgs := ARRAY[]::uuid[];
      FOR v_org IN
        EXECUTE $gap_owned$
          SELECT m.organization_id
          FROM public.organization_members AS m
          WHERE m.user_id = $1
            AND m.role = 'owner'
            AND m.status = 'active'
        $gap_owned$
        USING p_user_id
      LOOP
        v_orgs := pg_catalog.array_append(v_orgs, v_org);
      END LOOP;

      IF pg_catalog.cardinality(v_orgs) > 0 THEN
        FOREACH v_org IN ARRAY v_orgs
        LOOP
          EXECUTE $gap_others$
            SELECT count(*)
            FROM public.organization_members AS m
            WHERE m.organization_id = $1
              AND m.user_id IS DISTINCT FROM $2
              AND m.status IS DISTINCT FROM 'removed'
          $gap_others$
            INTO v_others
            USING v_org, p_user_id;

          IF coalesce(v_others, 0) = 0 THEN
            v_sets := ARRAY[]::text[];
            SELECT EXISTS (
              SELECT 1
              FROM pg_catalog.pg_attribute AS a
              JOIN pg_catalog.pg_class AS c ON c.oid = a.attrelid
              JOIN pg_catalog.pg_namespace AS n ON n.oid = c.relnamespace
              WHERE n.nspname = 'public'
                AND c.relname = 'organizations'
                AND a.attname = 'name'
                AND a.attnum > 0
                AND NOT a.attisdropped
            ) INTO v_ok;
            IF v_ok THEN
              v_sets := pg_catalog.array_append(
                v_sets, (pg_catalog.format('%I = %L', 'name', ''))::text
              );
            END IF;
            SELECT EXISTS (
              SELECT 1
              FROM pg_catalog.pg_attribute AS a
              JOIN pg_catalog.pg_class AS c ON c.oid = a.attrelid
              JOIN pg_catalog.pg_namespace AS n ON n.oid = c.relnamespace
              WHERE n.nspname = 'public'
                AND c.relname = 'organizations'
                AND a.attname = 'slug'
                AND a.attnum > 0
                AND NOT a.attisdropped
            ) INTO v_ok;
            IF v_ok THEN
              v_sets := pg_catalog.array_append(
                v_sets,
                (pg_catalog.format('%I = %L', 'slug', 'erased-' || v_org::text))::text
              );
            END IF;
            FOREACH v_org_col IN ARRAY ARRAY[
              'email',
              'phone',
              'brand_display_name',
              'brand_support_email',
              'brand_support_phone'
            ]::text[]
            LOOP
              SELECT EXISTS (
                SELECT 1
                FROM pg_catalog.pg_attribute AS a
                JOIN pg_catalog.pg_class AS c ON c.oid = a.attrelid
                JOIN pg_catalog.pg_namespace AS n ON n.oid = c.relnamespace
                WHERE n.nspname = 'public'
                  AND c.relname = 'organizations'
                  AND a.attname = v_org_col
                  AND a.attnum > 0
                  AND NOT a.attisdropped
              ) INTO v_ok;
              IF v_ok THEN
                IF v_org_col = 'brand_display_name' THEN
                  v_sets := pg_catalog.array_append(
                    v_sets, (pg_catalog.format('%I = %L', v_org_col, ''))::text
                  );
                ELSE
                  v_sets := pg_catalog.array_append(
                    v_sets, (pg_catalog.format('%I = NULL', v_org_col))::text
                  );
                END IF;
              END IF;
            END LOOP;
            IF pg_catalog.cardinality(v_sets) > 0 THEN
              EXECUTE pg_catalog.format(
                'UPDATE public.organizations SET %s WHERE %I = $1',
                pg_catalog.array_to_string(v_sets, ', '),
                'id'
              ) USING v_org;
            END IF;
          END IF;
        END LOOP;

        EXECUTE $gap_suspend$
          UPDATE public.organization_members AS m
          SET status = 'suspended'
          WHERE m.user_id = $1
            AND m.role = 'owner'
            AND m.status = 'active'
            AND m.organization_id = ANY ($2)
        $gap_suspend$
          USING p_user_id, v_orgs;
      END IF;
    EXCEPTION
      WHEN undefined_table OR undefined_column THEN
        NULL;
    END;
  END IF;

  SELECT COALESCE(pg_catalog.array_agg(a.attname), ARRAY[]::text[])
  INTO v_cols
  FROM pg_catalog.pg_attribute AS a
  JOIN pg_catalog.pg_class AS c ON c.oid = a.attrelid
  JOIN pg_catalog.pg_namespace AS n ON n.oid = c.relnamespace
  WHERE n.nspname = 'auth'
    AND c.relname = 'users'
    AND a.attnum > 0
    AND NOT a.attisdropped;

  v_sets := ARRAY[]::text[];
  IF 'email' = ANY (v_cols) THEN
    v_sets := v_sets || pg_catalog.format('%I = %L', 'email', v_email);
  END IF;
  IF 'phone' = ANY (v_cols) THEN
    v_sets := v_sets || pg_catalog.format('%I = NULL', 'phone');
  END IF;
  IF 'banned_until' = ANY (v_cols) THEN
    v_sets := v_sets || pg_catalog.format(
      '%I = pg_catalog.now() + interval %L',
      'banned_until',
      '876000 hours'
    );
  END IF;
  IF 'raw_user_meta_data' = ANY (v_cols) THEN
    v_sets := v_sets || pg_catalog.format(
      '%I = pg_catalog.jsonb_build_object(%L, pg_catalog.to_jsonb(%I ->> %L), %L, pg_catalog.to_jsonb(true))',
      'raw_user_meta_data',
      'role',
      'raw_user_meta_data',
      'role',
      'restricted'
    );
  END IF;
  IF 'updated_at' = ANY (v_cols) THEN
    v_sets := v_sets || pg_catalog.format('%I = pg_catalog.now()', 'updated_at');
  END IF;
  IF pg_catalog.cardinality(v_sets) > 0 AND 'id' = ANY (v_cols) THEN
    EXECUTE pg_catalog.format(
      'UPDATE auth.users SET %s WHERE %I = $1',
      pg_catalog.array_to_string(v_sets, ', '),
      'id'
    ) USING p_user_id;
  END IF;

  RETURN pg_catalog.jsonb_build_object(
    'mode', 'restricted',
    'restricted_at', v_restricted_at,
    'email', v_email
  );
END;
$fn$;

COMMENT ON FUNCTION public.erase_account(uuid) IS
  'Restrict an account that must keep clinical, review, booking, invoice, payment, message, membership, wallet, or other non-cascading rows. Raises erasure_blocked when a stored subscription is active or trialing, a licence is active, or the user owns an organisation that still has other members or an active licence. Returns hard_delete when auth.admin.deleteUser is still safe. Linked rows remain personal data.';

REVOKE ALL ON FUNCTION public.erase_account(uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.erase_account(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.erase_account(uuid) TO service_role;
