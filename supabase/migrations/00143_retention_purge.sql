-- Retention purge.
--
-- Company financial year, not a fixed calendar date in April. The
-- anniversary day is still inside the period; a row is eligible on the
-- next Europe/London civil day. platform_settings.retention_financial_year_end
-- is a JSON string month-day such as "03-31". JSON null, or anything that
-- is not MM-DD, means the financial clock does not run and those rows are
-- counted as held_no_fy_end.
--
-- A refund in a later financial year keeps the booking until the later of
-- the payment clock and the refund clock. A booking with a visit summary,
-- doctor notes, or a prescription is a consultation and follows the
-- clinical clock from the last consultation even when it was refunded.
--
-- Clinical clock, from the last consultation, using
-- coalesce(retention_subjects.date_of_birth, the live column):
--   completed age 18 or over: 8 years
--   completed age 17: the later of 8 years and the 26th birthday
--   completed age 16 or under: the later of 8 years and the 25th birthday
--   no date of birth: never purged, held_missing_dob
-- Age is the year part of age(consultation_date, date_of_birth).
--
-- An open Stripe dispute is a status still in the open set:
-- needs_response, under_review, warning_needs_response, or
-- warning_under_review. Once that status leaves the set, the booking
-- follows its normal clock. stripe_dispute_closed_at starts the
-- 12-month narrative clock; a null closed_at is not itself a hold.
-- An open payment-correction dispute is disputed_at set and
-- dispute_resolved_at null. flagged, notified, approved, and recovering
-- are workflow statuses and are not a hold.
-- Dispute free text is removed 12 months after stripe_dispute_closed_at.
-- Append-only payment_correction_events and payment_correction_approvals
-- are not updated or deleted for that redaction. The purge appends one
-- payment_correction_events row, event_type dispute_redacted, payload
-- {"redacted": true}, and one audit_log row with the same marker when
-- created_by is present. Reads go through payment_correction_events_read
-- and audit_log_read, which drop free-text keys from earlier payloads
-- once that marker exists. Amounts, dates, statement_line, and
-- dispute_outcome stay until the financial clock.
-- payment_corrections.reason is NOT NULL, so the redacted value is the
-- literal [redacted]. Mutable dispute columns are nulled.
--
-- audit_log, prescription_audit_log, and the payment-correction audit
-- tables stay append-only. DELETE is allowed only while the
-- transaction-local setting mydoctors360.retention_purge is on. UPDATE
-- is never allowed. The purge turns the setting off before it returns.
-- audit_log is kept 2 years, except prescription audit (clinical clock)
-- and payment correction or recovery audit (financial clock).
--
-- DBS findings from the schema:
--   doctors.dbs_check_date is the check date. Kept until 6 years after
--   doctors.left_at, then nulled.
--   doctors.dbs_document_id points at doctor_documents. There is no DBS
--   document_type. The certificate copy is that row's storage_path and
--   file_name. There is no certificate-number column and no DBS level
--   column.
--   doctor_approval_checklist.dbs_check_verified is the decision flag.
--   It has no decision timestamp. Kept until 6 years after left_at, then
--   set false.
--   The certificate row is deleted 6 months after
--   doctor_documents.verified_at. If verified_at is null, and there is no
--   hiring-decision date anywhere in the schema, the file is not deleted.
--   doctor_documents.storage_path has no bucket in the migrations. The
--   purge queues the object only when storage.objects names one of
--   avatars, public-read, or message-attachments. Otherwise it counts
--   missing_object and does not record the path.
-- Medical Performers List, GMC, CQC, and indemnity columns are cleared
-- 6 years after left_at. cqc_status cannot be null; it is set to unknown.
-- doctors.excluded_procedures_attestation is not named in the retention
-- rules and is left in place.
--
-- contact_inquiries has no user id and no complaint flag. A legal_holds
-- row with subject_type contact_inquiry means the inquiry became a
-- complaint, claim, or regulator matter. An open hold blocks the purge.
-- After the latest hold is closed, the row is kept 6 years from that
-- close. With no hold, the row is kept 2 years from created_at.
--
-- A wallet with a non-zero balance is never deleted (held_wallet_balance).
-- The wallet clock is 6 financial years from the latest matching
-- wallet_transactions row, not from wallet creation. A zero balance and
-- no transactions has not started a clock: the wallet is left, and it is
-- not counted as held_wallet_balance. Loyalty points follow that clock.
--
-- Auth users are counted in accounts_clear and are not deleted.
-- Stripe is never called. stripe_customer_id is cleared in the database
-- only after the organisation licence financial clock ends.
-- No restore from backup is implemented.
--
-- Clocks read mydoctors360.retention_as_of when that transaction-local
-- setting is present, so tests can pin a civil date. The cron must not
-- set it.

ALTER TABLE public.doctors
  ADD COLUMN IF NOT EXISTS left_at timestamptz;

COMMENT ON COLUMN public.doctors.left_at IS
  'Set when the doctor profile is restricted. Starts the 6-year regulatory clock. is_active false does not set it.';

ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS stripe_dispute_closed_at timestamptz;

COMMENT ON COLUMN public.bookings.stripe_dispute_closed_at IS
  'Set once, when the Stripe dispute leaves the open statuses. The 12-month evidence clock starts here.';

CREATE OR REPLACE FUNCTION public.retention_column_exists(p_table text, p_column text)
RETURNS boolean
LANGUAGE sql
STABLE
SET search_path = ''
AS $col$
  SELECT EXISTS (
    SELECT 1
    FROM pg_catalog.pg_attribute AS a
    JOIN pg_catalog.pg_class AS c ON c.oid = a.attrelid
    JOIN pg_catalog.pg_namespace AS n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relname = p_table
      AND a.attname = p_column
      AND a.attnum > 0
      AND NOT a.attisdropped
  );
$col$;

CREATE OR REPLACE FUNCTION public.retention_london_date(p_ts timestamptz)
RETURNS date
LANGUAGE sql
IMMUTABLE
SET search_path = ''
AS $ld$
  SELECT (p_ts AT TIME ZONE 'Europe/London')::date;
$ld$;

CREATE OR REPLACE FUNCTION public.retention_fy_end(p_on date, p_month_day text)
RETURNS date
LANGUAGE sql
IMMUTABLE
SET search_path = ''
AS $fy$
  SELECT CASE
    WHEN p_on IS NULL OR p_month_day IS NULL OR p_month_day !~ '^\d{2}-\d{2}$' THEN NULL::date
    WHEN substring(p_month_day, 1, 2)::int NOT BETWEEN 1 AND 12 THEN NULL::date
    WHEN substring(p_month_day, 4, 2)::int NOT BETWEEN 1 AND 31 THEN NULL::date
    ELSE (
      SELECT CASE
        WHEN p_on <= ends.this_end THEN ends.this_end
        ELSE ends.next_end
      END
      FROM (
        SELECT
          pg_catalog.make_date(
            extract(year FROM p_on)::int,
            substring(p_month_day, 1, 2)::int,
            least(
              substring(p_month_day, 4, 2)::int,
              extract(day FROM (
                pg_catalog.date_trunc(
                  'month',
                  pg_catalog.make_date(
                    extract(year FROM p_on)::int,
                    substring(p_month_day, 1, 2)::int,
                    1
                  )
                ) + interval '1 month - 1 day'
              ))::int
            )
          ) AS this_end,
          pg_catalog.make_date(
            extract(year FROM p_on)::int + 1,
            substring(p_month_day, 1, 2)::int,
            least(
              substring(p_month_day, 4, 2)::int,
              extract(day FROM (
                pg_catalog.date_trunc(
                  'month',
                  pg_catalog.make_date(
                    extract(year FROM p_on)::int + 1,
                    substring(p_month_day, 1, 2)::int,
                    1
                  )
                ) + interval '1 month - 1 day'
              ))::int
            )
          ) AS next_end
      ) AS ends
    )
  END;
$fy$;

CREATE OR REPLACE FUNCTION public.retention_financial_end(p_on date, p_month_day text)
RETURNS date
LANGUAGE sql
IMMUTABLE
SET search_path = ''
AS $fe$
  SELECT CASE
    WHEN public.retention_fy_end(p_on, p_month_day) IS NULL THEN NULL::date
    ELSE (public.retention_fy_end(p_on, p_month_day) + interval '6 years')::date
  END;
$fe$;

CREATE OR REPLACE FUNCTION public.retention_clinical_end(p_last date, p_dob date)
RETURNS date
LANGUAGE sql
IMMUTABLE
SET search_path = ''
AS $clin$
  SELECT CASE
    WHEN p_last IS NULL OR p_dob IS NULL THEN NULL::date
    WHEN extract(year FROM pg_catalog.age(p_last, p_dob)) >= 18
      THEN (p_last + interval '8 years')::date
    WHEN extract(year FROM pg_catalog.age(p_last, p_dob)) = 17
      THEN GREATEST(
        (p_last + interval '8 years')::date,
        (p_dob + interval '26 years')::date
      )
    ELSE GREATEST(
      (p_last + interval '8 years')::date,
      (p_dob + interval '25 years')::date
    )
  END;
$clin$;

REVOKE ALL ON FUNCTION public.retention_column_exists(text, text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.retention_column_exists(text, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.retention_london_date(timestamptz) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.retention_london_date(timestamptz) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.retention_fy_end(date, text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.retention_fy_end(date, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.retention_financial_end(date, text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.retention_financial_end(date, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.retention_clinical_end(date, date) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.retention_clinical_end(date, date) FROM PUBLIC, anon, authenticated;

DO $backfill$
BEGIN
  IF pg_catalog.to_regclass('public.doctors') IS NOT NULL
     AND pg_catalog.to_regclass('public.profiles') IS NOT NULL
     AND public.retention_column_exists('doctors', 'left_at')
     AND public.retention_column_exists('profiles', 'restricted_at') THEN
    UPDATE public.doctors AS d
    SET left_at = p.restricted_at
    FROM public.profiles AS p
    WHERE d.profile_id = p.id
      AND p.restricted_at IS NOT NULL
      AND d.left_at IS NULL;
  END IF;

  IF pg_catalog.to_regclass('public.retention_subjects') IS NOT NULL
     AND pg_catalog.to_regclass('public.dependents') IS NOT NULL
     AND public.retention_column_exists('dependents', 'date_of_birth') THEN
    INSERT INTO public.retention_subjects (subject_type, subject_id, date_of_birth)
    SELECT 'dependent', d.id, d.date_of_birth
    FROM public.dependents AS d
    WHERE d.date_of_birth IS NOT NULL
    ON CONFLICT (subject_type, subject_id) DO UPDATE
      SET date_of_birth = coalesce(public.retention_subjects.date_of_birth, EXCLUDED.date_of_birth);
  END IF;

  IF pg_catalog.to_regclass('public.retention_subjects') IS NOT NULL
     AND pg_catalog.to_regclass('public.profiles') IS NOT NULL
     AND public.retention_column_exists('profiles', 'date_of_birth') THEN
    INSERT INTO public.retention_subjects (subject_type, subject_id, date_of_birth)
    SELECT 'patient', p.id, p.date_of_birth
    FROM public.profiles AS p
    WHERE p.date_of_birth IS NOT NULL
    ON CONFLICT (subject_type, subject_id) DO UPDATE
      SET date_of_birth = coalesce(public.retention_subjects.date_of_birth, EXCLUDED.date_of_birth);
  END IF;
END
$backfill$;

CREATE TABLE public.legal_holds (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  subject_type text NOT NULL CHECK (subject_type IN (
    'profile', 'dependent', 'booking', 'organization',
    'payment_correction', 'support_ticket', 'contact_inquiry'
  )),
  subject_id uuid NOT NULL,
  opened_at timestamptz NOT NULL DEFAULT pg_catalog.now(),
  closed_at timestamptz,
  reason_code text NOT NULL CHECK (reason_code IN (
    'litigation', 'regulatory', 'police', 'complaint', 'other'
  ))
);

CREATE UNIQUE INDEX legal_holds_one_open
  ON public.legal_holds (subject_type, subject_id)
  WHERE closed_at IS NULL;

COMMENT ON TABLE public.legal_holds IS
  'Open dispute, complaint, legal claim, or regulator request. No free-text notes. An open row blocks every purge for that subject.';

CREATE OR REPLACE FUNCTION public.retention_has_legal_hold(p_type text, p_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SET search_path = ''
AS $hold$
  SELECT p_id IS NOT NULL AND EXISTS (
    SELECT 1
    FROM public.legal_holds AS h
    WHERE h.subject_type = p_type
      AND h.subject_id = p_id
      AND h.closed_at IS NULL
  );
$hold$;

REVOKE ALL ON FUNCTION public.retention_has_legal_hold(text, uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.retention_has_legal_hold(text, uuid) FROM PUBLIC, anon, authenticated;

ALTER TABLE public.legal_holds ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.legal_holds FROM PUBLIC, anon, authenticated;
GRANT ALL ON TABLE public.legal_holds TO service_role;

CREATE TABLE public.retention_purge_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  started_at timestamptz NOT NULL DEFAULT pg_catalog.now(),
  finished_at timestamptz,
  dry_run boolean NOT NULL,
  mode text NOT NULL,
  batch_limit integer NOT NULL,
  counts jsonb NOT NULL,
  sqlstate text
);

COMMENT ON TABLE public.retention_purge_runs IS
  'One row per purge call. counts holds numbers only: no ids, names, emails, paths, or payloads.';

ALTER TABLE public.retention_purge_runs ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.retention_purge_runs FROM PUBLIC, anon, authenticated;
GRANT ALL ON TABLE public.retention_purge_runs TO service_role;

CREATE TABLE public.retention_purge_objects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bucket_id text,
  object_name text,
  daily_room_name text,
  enqueued_at timestamptz NOT NULL DEFAULT pg_catalog.now(),
  deleted_at timestamptz,
  CHECK (bucket_id IS NOT NULL OR daily_room_name IS NOT NULL)
);

COMMENT ON TABLE public.retention_purge_objects IS
  'Storage and Daily names queued by an apply run. The purge log stores the count, not these names. Rows are removed seven days after deleted_at.';

ALTER TABLE public.retention_purge_objects ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.retention_purge_objects FROM PUBLIC, anon, authenticated;
GRANT ALL ON TABLE public.retention_purge_objects TO service_role;

INSERT INTO public.platform_settings (key, value)
VALUES ('retention_purge', '{"mode":"dry_run"}'::jsonb)
ON CONFLICT (key) DO NOTHING;

INSERT INTO public.platform_settings (key, value)
VALUES ('retention_financial_year_end', 'null'::jsonb)
ON CONFLICT (key) DO NOTHING;

CREATE OR REPLACE FUNCTION public.prescription_audit_log_deny_mutation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $deny_rx$
BEGIN
  IF TG_OP = 'DELETE'
     AND pg_catalog.current_setting('mydoctors360.retention_purge', true) = 'on' THEN
    RETURN OLD;
  END IF;
  RAISE EXCEPTION 'prescription_audit_log is append-only; % is not permitted', TG_OP;
END;
$deny_rx$;

DROP TRIGGER IF EXISTS prescription_audit_log_block_update ON public.prescription_audit_log;
CREATE TRIGGER prescription_audit_log_block_update
  BEFORE UPDATE ON public.prescription_audit_log
  FOR EACH ROW
  EXECUTE FUNCTION public.prescription_audit_log_deny_mutation();

DROP TRIGGER IF EXISTS prescription_audit_log_block_delete ON public.prescription_audit_log;
CREATE TRIGGER prescription_audit_log_block_delete
  BEFORE DELETE ON public.prescription_audit_log
  FOR EACH ROW
  EXECUTE FUNCTION public.prescription_audit_log_deny_mutation();

CREATE OR REPLACE FUNCTION public.reject_payment_correction_audit_mutation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $deny_pay$
BEGIN
  IF TG_OP = 'DELETE'
     AND pg_catalog.current_setting('mydoctors360.retention_purge', true) = 'on' THEN
    RETURN OLD;
  END IF;
  RAISE EXCEPTION 'payment correction audit rows are append-only';
END;
$deny_pay$;

DROP TRIGGER IF EXISTS payment_correction_approvals_append_only ON public.payment_correction_approvals;
CREATE TRIGGER payment_correction_approvals_append_only
  BEFORE UPDATE OR DELETE ON public.payment_correction_approvals
  FOR EACH ROW
  EXECUTE FUNCTION public.reject_payment_correction_audit_mutation();

DROP TRIGGER IF EXISTS payment_correction_events_append_only ON public.payment_correction_events;
CREATE TRIGGER payment_correction_events_append_only
  BEFORE UPDATE OR DELETE ON public.payment_correction_events
  FOR EACH ROW
  EXECUTE FUNCTION public.reject_payment_correction_audit_mutation();

CREATE OR REPLACE FUNCTION public.audit_log_deny_mutation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $deny_audit$
BEGIN
  IF TG_OP = 'DELETE'
     AND pg_catalog.current_setting('mydoctors360.retention_purge', true) = 'on' THEN
    RETURN OLD;
  END IF;
  RAISE EXCEPTION 'audit_log is append-only; % is not permitted', TG_OP;
END;
$deny_audit$;

DROP TRIGGER IF EXISTS audit_log_append_only ON public.audit_log;
CREATE TRIGGER audit_log_append_only
  BEFORE UPDATE OR DELETE ON public.audit_log
  FOR EACH ROW
  EXECUTE FUNCTION public.audit_log_deny_mutation();

CREATE OR REPLACE VIEW public.payment_correction_events_read
WITH (security_invoker = true) AS
SELECT
  e.id,
  e.correction_id,
  e.event_type,
  e.actor_id,
  e.created_at,
  CASE
    WHEN e.event_type = 'dispute_redacted' THEN e.payload
    WHEN EXISTS (
      SELECT 1
      FROM public.payment_correction_events AS r
      WHERE r.correction_id = e.correction_id
        AND r.event_type = 'dispute_redacted'
    ) THEN e.payload
      - 'dispute_reason' - 'dispute_findings' - 'customer_response'
      - 'reason' - 'clear_risk_reason' - 'notes' - 'message' - 'text' - 'narrative'
    ELSE e.payload
  END AS payload
FROM public.payment_correction_events AS e;

REVOKE ALL ON TABLE public.payment_correction_events_read FROM PUBLIC, anon;
GRANT SELECT ON TABLE public.payment_correction_events_read TO authenticated, service_role;

CREATE OR REPLACE VIEW public.audit_log_read
WITH (security_invoker = true) AS
SELECT
  a.id,
  a.actor_id,
  a.action,
  a.target_type,
  a.target_id,
  a.created_at,
  CASE
    WHEN a.action = 'dispute_redacted' THEN a.metadata
    WHEN a.target_type = 'payment_correction'
      AND a.target_id IS NOT NULL
      AND EXISTS (
        SELECT 1
        FROM public.audit_log AS r
        WHERE r.target_type = 'payment_correction'
          AND r.target_id = a.target_id
          AND r.action = 'dispute_redacted'
      ) THEN a.metadata
      - 'dispute_reason' - 'dispute_findings' - 'customer_response'
      - 'reason' - 'clear_risk_reason' - 'notes' - 'message' - 'text' - 'narrative'
    ELSE a.metadata
  END AS metadata
FROM public.audit_log AS a;

REVOKE ALL ON TABLE public.audit_log_read FROM PUBLIC, anon;
GRANT SELECT ON TABLE public.audit_log_read TO authenticated, service_role;

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
    IF 'left_at' = ANY (v_cols) THEN
      v_sets := v_sets || pg_catalog.format('%I = coalesce(%I, pg_catalog.now())', 'left_at', 'left_at');
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
              AND m.status IN ('active', 'invited', 'suspended')
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
              'address_line1',
              'address_line2',
              'city',
              'state',
              'postal_code',
              'country',
              'website',
              'logo_url',
              'description',
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



REVOKE ALL ON FUNCTION public.erase_account(uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.erase_account(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.erase_account(uuid) TO service_role;

CREATE OR REPLACE FUNCTION public.purge_expired_retention(
  p_dry_run boolean DEFAULT true,
  p_limit integer DEFAULT 500
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $purge$
#variable_conflict use_column
DECLARE
  v_mode text := 'dry_run';
  v_fy text;
  v_fy_raw text;
  v_apply boolean := false;
  v_now timestamptz;
  v_today date;
  v_raw text;
  v_started timestamptz := pg_catalog.clock_timestamp();
  v_sqlstate text;
  v_counts jsonb;
  v_full_bookings boolean;
  v_has_rx boolean;
  v_org uuid;
  v_sets text[];
  v_col text;
  v_n integer;
  v_block boolean;
  v_scrub_ids uuid[] := ARRAY[]::uuid[];
  v_delete_ids uuid[] := ARRAY[]::uuid[];
  v_redact_ids uuid[] := ARRAY[]::uuid[];
  v_corr_ids uuid[] := ARRAY[]::uuid[];
  v_rx_ids uuid[] := ARRAY[]::uuid[];
  v_conv_ids uuid[] := ARRAY[]::uuid[];
  v_audit_ids uuid[] := ARRAY[]::uuid[];
  v_wallet_ids uuid[] := ARRAY[]::uuid[];
  v_point_patients uuid[] := ARRAY[]::uuid[];
  v_inquiry_ids uuid[] := ARRAY[]::uuid[];
  v_doctor_ids uuid[] := ARRAY[]::uuid[];
  v_doc_ids uuid[] := ARRAY[]::uuid[];
  v_stripe_ids uuid[] := ARRAY[]::uuid[];
  v_ticket_ids uuid[] := ARRAY[]::uuid[];
  v_held_dob integer := 0;
  v_held_dispute integer := 0;
  v_held_legal integer := 0;
  v_held_fy integer := 0;
  v_held_wallet integer := 0;
  v_scrubbed integer := 0;
  v_bookings_deleted integer := 0;
  v_rx_audit integer := 0;
  v_rx integer := 0;
  v_reviews integer := 0;
  v_messages integer := 0;
  v_orgs integer := 0;
  v_stripe integer := 0;
  v_redacted integer := 0;
  v_audit integer := 0;
  v_wallets integer := 0;
  v_wallet_tx integer := 0;
  v_points integer := 0;
  v_inquiries integer := 0;
  v_doctors integer := 0;
  v_dbs integer := 0;
  v_support_messages integer := 0;
  v_support_tickets integer := 0;
  v_accounts integer := 0;
  v_queued integer := 0;
  v_missing integer := 0;
  rec_b record;
  rec_c record;
  rec_w record;
  rec_q record;
  rec_a record;
  rec_d record;
  rec_t record;
  rec_doc record;
  v_stype text;
  v_sid uuid;
  v_cend date;
  v_mdob boolean;
  v_is_consult boolean;
  v_legal boolean;
  v_open boolean;
  v_paid_on date;
  v_fin date;
  v_ref date;
  v_end date;
  v_dep_end date;
  v_dep_missing boolean;
  v_patient_end date;
  v_patient_missing boolean;
  v_has_subject boolean;
  v_last timestamptz;
  v_due boolean;
  v_blocked_patients uuid[] := ARRAY[]::uuid[];
  v_open_hold boolean;
  v_closed timestamptz;
  v_bucket text;
  v_object text;
  v_path text;
BEGIN
  IF p_limit IS NULL OR p_limit < 1 OR p_limit > 2000 THEN
    RAISE EXCEPTION 'retention_purge_limit' USING ERRCODE = '22023';
  END IF;

  IF coalesce((SELECT auth.role()), ''::text) IS DISTINCT FROM 'service_role'
     AND auth.uid() IS NOT NULL THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;

  SELECT s.value ->> 'mode'
  INTO v_mode
  FROM public.platform_settings AS s
  WHERE s.key = 'retention_purge';
  IF v_mode IS NULL OR v_mode NOT IN ('off', 'dry_run', 'apply') THEN
    v_mode := 'dry_run';
  END IF;

  SELECT s.value #>> '{}'
  INTO v_fy_raw
  FROM public.platform_settings AS s
  WHERE s.key = 'retention_financial_year_end';
  IF v_fy_raw IS NOT NULL AND v_fy_raw ~ '^\d{2}-\d{2}$' THEN
    v_fy := v_fy_raw;
  ELSE
    v_fy := NULL;
  END IF;

  v_raw := pg_catalog.current_setting('mydoctors360.retention_as_of', true);
  IF v_raw IS NULL OR v_raw = '' THEN
    v_now := pg_catalog.now();
  ELSE
    v_now := v_raw::timestamptz;
  END IF;
  v_today := public.retention_london_date(v_now);
  v_apply := v_mode = 'apply' AND p_dry_run IS FALSE;

  IF v_mode <> 'off' THEN
    DROP TABLE IF EXISTS pg_temp.ret_consults;
    DROP TABLE IF EXISTS pg_temp.ret_subjects;
    DROP TABLE IF EXISTS pg_temp.ret_queue;
    CREATE TEMP TABLE ret_consults (
      subject_type text NOT NULL,
      subject_id uuid NOT NULL,
      doctor_id uuid,
      consult_date date NOT NULL
    ) ON COMMIT DROP;
    CREATE TEMP TABLE ret_subjects (
      subject_type text NOT NULL,
      subject_id uuid NOT NULL,
      dob date,
      last_consult date,
      clinical_end date,
      missing_dob boolean NOT NULL DEFAULT false,
      PRIMARY KEY (subject_type, subject_id)
    ) ON COMMIT DROP;
    CREATE TEMP TABLE ret_queue (
      bucket_id text,
      object_name text,
      daily_room_name text
    ) ON COMMIT DROP;

    v_has_rx := pg_catalog.to_regclass('public.prescriptions') IS NOT NULL;
    v_full_bookings := pg_catalog.to_regclass('public.bookings') IS NOT NULL
      AND public.retention_column_exists('bookings', 'appointment_date')
      AND public.retention_column_exists('bookings', 'visit_summary')
      AND public.retention_column_exists('bookings', 'doctor_notes')
      AND public.retention_column_exists('bookings', 'patient_notes')
      AND public.retention_column_exists('bookings', 'paid_at')
      AND public.retention_column_exists('bookings', 'refunded_at')
      AND public.retention_column_exists('bookings', 'created_at')
      AND public.retention_column_exists('bookings', 'dependent_id')
      AND public.retention_column_exists('bookings', 'stripe_dispute_status')
      AND public.retention_column_exists('bookings', 'stripe_dispute_reason')
      AND public.retention_column_exists('bookings', 'stripe_dispute_closed_at')
      AND public.retention_column_exists('bookings', 'daily_room_name')
      AND public.retention_column_exists('bookings', 'visit_summary_at');

    IF v_full_bookings THEN
      INSERT INTO pg_temp.ret_consults (subject_type, subject_id, doctor_id, consult_date)
      SELECT
        CASE WHEN b.dependent_id IS NOT NULL THEN 'dependent' ELSE 'patient' END,
        coalesce(b.dependent_id, b.patient_id),
        b.doctor_id,
        b.appointment_date
      FROM public.bookings AS b
      WHERE b.appointment_date IS NOT NULL
        AND (
          b.status = 'completed'
          OR b.visit_summary IS NOT NULL
          OR b.doctor_notes IS NOT NULL
          OR (
            v_has_rx AND EXISTS (
              SELECT 1 FROM public.prescriptions AS p WHERE p.booking_id = b.id
            )
          )
        );
    END IF;

    IF v_has_rx
       AND public.retention_column_exists('prescriptions', 'prescribed_at')
       AND public.retention_column_exists('prescriptions', 'booking_id') THEN
      INSERT INTO pg_temp.ret_consults (subject_type, subject_id, doctor_id, consult_date)
      SELECT
        'patient',
        p.patient_id,
        p.doctor_id,
        public.retention_london_date(p.prescribed_at)
      FROM public.prescriptions AS p
      WHERE p.booking_id IS NULL
        AND p.prescribed_at IS NOT NULL;
    END IF;

    INSERT INTO pg_temp.ret_subjects (subject_type, subject_id, last_consult)
    SELECT subject_type, subject_id, max(consult_date)
    FROM pg_temp.ret_consults
    GROUP BY subject_type, subject_id;

    UPDATE pg_temp.ret_subjects AS s
    SET dob = rs.date_of_birth
    FROM public.retention_subjects AS rs
    WHERE rs.subject_type = s.subject_type
      AND rs.subject_id = s.subject_id;

    IF pg_catalog.to_regclass('public.dependents') IS NOT NULL THEN
      UPDATE pg_temp.ret_subjects AS s
      SET dob = coalesce(s.dob, d.date_of_birth)
      FROM public.dependents AS d
      WHERE s.subject_type = 'dependent'
        AND d.id = s.subject_id
        AND s.dob IS NULL;
    END IF;

    IF public.retention_column_exists('profiles', 'date_of_birth') THEN
      UPDATE pg_temp.ret_subjects AS s
      SET dob = coalesce(s.dob, p.date_of_birth)
      FROM public.profiles AS p
      WHERE s.subject_type = 'patient'
        AND p.id = s.subject_id
        AND s.dob IS NULL;
    END IF;

    UPDATE pg_temp.ret_subjects
    SET clinical_end = public.retention_clinical_end(last_consult, dob),
        missing_dob = dob IS NULL;

    SELECT count(*)
    INTO v_held_dob
    FROM pg_temp.ret_subjects AS s
    WHERE s.missing_dob
      AND NOT public.retention_has_legal_hold(
        CASE WHEN s.subject_type = 'dependent' THEN 'dependent' ELSE 'profile' END,
        s.subject_id
      );

    IF pg_catalog.to_regclass('public.organizations') IS NOT NULL
       AND pg_catalog.to_regclass('public.organization_members') IS NOT NULL
       AND public.retention_column_exists('profiles', 'restricted_at') THEN
      SELECT coalesce(pg_catalog.array_agg(picked.id), ARRAY[]::uuid[])
      INTO v_scrub_ids
      FROM (
        SELECT o.id
        FROM public.organizations AS o
        WHERE o.slug IS DISTINCT FROM ('erased-' || o.id::text)
          AND EXISTS (
            SELECT 1
            FROM public.organization_members AS m
            JOIN public.profiles AS p ON p.id = m.user_id
            WHERE m.organization_id = o.id
              AND m.role = 'owner'
              AND p.restricted_at IS NOT NULL
          )
          AND NOT EXISTS (
            SELECT 1
            FROM public.organization_members AS m
            LEFT JOIN public.profiles AS p ON p.id = m.user_id
            WHERE m.organization_id = o.id
              AND m.status IN ('active', 'invited', 'suspended')
              AND NOT (m.status = 'suspended' AND p.restricted_at IS NOT NULL)
              AND NOT (m.role = 'owner' AND p.restricted_at IS NOT NULL)
          )
          AND NOT public.retention_has_legal_hold('organization', o.id)
        ORDER BY o.id
        LIMIT p_limit
      ) AS picked;
      v_orgs := coalesce(pg_catalog.cardinality(v_scrub_ids), 0);

      SELECT count(*)
      INTO v_n
      FROM public.organizations AS o
      WHERE o.slug IS DISTINCT FROM ('erased-' || o.id::text)
        AND EXISTS (
          SELECT 1
          FROM public.organization_members AS m
          JOIN public.profiles AS p ON p.id = m.user_id
          WHERE m.organization_id = o.id
            AND m.role = 'owner'
            AND p.restricted_at IS NOT NULL
        )
        AND NOT EXISTS (
          SELECT 1
          FROM public.organization_members AS m
          LEFT JOIN public.profiles AS p ON p.id = m.user_id
          WHERE m.organization_id = o.id
            AND m.status IN ('active', 'invited', 'suspended')
            AND NOT (m.status = 'suspended' AND p.restricted_at IS NOT NULL)
            AND NOT (m.role = 'owner' AND p.restricted_at IS NOT NULL)
        )
        AND public.retention_has_legal_hold('organization', o.id);
      v_held_legal := v_held_legal + coalesce(v_n, 0);
    END IF;

    -- v_scrub_ids currently holds organisations. Move them and reuse the array.
    v_stripe_ids := v_scrub_ids;
    v_scrub_ids := ARRAY[]::uuid[];

    IF v_full_bookings THEN
      FOR rec_b IN
        SELECT
          bk.id,
          bk.patient_id,
          bk.doctor_id,
          bk.dependent_id,
          bk.status,
          bk.appointment_date,
          bk.paid_at,
          bk.refunded_at,
          bk.created_at,
          bk.doctor_notes,
          bk.visit_summary,
          bk.visit_summary_at,
          bk.patient_notes,
          bk.stripe_dispute_status,
          bk.stripe_dispute_reason,
          bk.stripe_dispute_closed_at,
          bk.daily_room_name,
          doc.profile_id AS doctor_profile_id
        FROM public.bookings AS bk
        JOIN public.doctors AS doc ON doc.id = bk.doctor_id
      LOOP
        IF rec_b.dependent_id IS NOT NULL THEN
          v_stype := 'dependent';
          v_sid := rec_b.dependent_id;
        ELSE
          v_stype := 'patient';
          v_sid := rec_b.patient_id;
        END IF;

        SELECT s.clinical_end, s.missing_dob
        INTO v_cend, v_mdob
        FROM pg_temp.ret_subjects AS s
        WHERE s.subject_type = v_stype
          AND s.subject_id = v_sid;
        IF NOT FOUND THEN
          v_cend := NULL;
          v_mdob := false;
        END IF;

        v_is_consult := rec_b.status = 'completed'
          OR rec_b.visit_summary IS NOT NULL
          OR rec_b.doctor_notes IS NOT NULL
          OR (
            v_has_rx AND EXISTS (
              SELECT 1 FROM public.prescriptions AS p WHERE p.booking_id = rec_b.id
            )
          );
        v_legal := public.retention_has_legal_hold('booking', rec_b.id)
          OR public.retention_has_legal_hold('profile', rec_b.patient_id)
          OR public.retention_has_legal_hold('dependent', rec_b.dependent_id)
          OR public.retention_has_legal_hold('profile', rec_b.doctor_profile_id);
        v_open := coalesce(
            rec_b.stripe_dispute_status IN (
              'needs_response', 'under_review', 'warning_needs_response', 'warning_under_review'
            ),
            false
          );
        IF NOT v_open
           AND pg_catalog.to_regclass('public.payment_corrections') IS NOT NULL
           AND public.retention_column_exists('payment_corrections', 'disputed_at')
           AND public.retention_column_exists('payment_corrections', 'dispute_resolved_at') THEN
          EXECUTE $q$
            SELECT EXISTS (
              SELECT 1
              FROM public.payment_corrections AS c
              WHERE c.booking_id = $1
                AND c.disputed_at IS NOT NULL
                AND c.dispute_resolved_at IS NULL
            )
          $q$ INTO v_block USING rec_b.id;
          v_open := v_open OR coalesce(v_block, false);
        END IF;

        IF v_is_consult AND v_cend IS NOT NULL AND v_today > v_cend
           AND NOT coalesce(v_mdob, false) AND NOT v_legal AND NOT v_open
           AND (
             rec_b.doctor_notes IS NOT NULL
             OR rec_b.visit_summary IS NOT NULL
             OR rec_b.visit_summary_at IS NOT NULL
             OR rec_b.patient_notes IS NOT NULL
           )
           AND coalesce(pg_catalog.cardinality(v_scrub_ids), 0) < p_limit THEN
          v_scrub_ids := pg_catalog.array_append(v_scrub_ids, rec_b.id);
        END IF;

        IF rec_b.stripe_dispute_closed_at IS NOT NULL
           AND rec_b.stripe_dispute_reason IS NOT NULL
           AND NOT v_open
           AND NOT v_legal
           AND v_today > (public.retention_london_date(rec_b.stripe_dispute_closed_at) + interval '12 months')::date
           AND coalesce(pg_catalog.cardinality(v_redact_ids), 0) < p_limit THEN
          v_redact_ids := pg_catalog.array_append(v_redact_ids, rec_b.id);
        END IF;

        v_paid_on := public.retention_london_date(coalesce(rec_b.paid_at, rec_b.created_at));
        v_fin := public.retention_financial_end(v_paid_on, v_fy);
        IF rec_b.refunded_at IS NOT NULL THEN
          v_ref := public.retention_financial_end(public.retention_london_date(rec_b.refunded_at), v_fy);
          IF v_fin IS NULL OR (v_ref IS NOT NULL AND v_ref > v_fin) THEN
            v_fin := v_ref;
          END IF;
        END IF;

        IF v_legal THEN
          v_held_legal := v_held_legal + 1;
        ELSIF v_open THEN
          v_held_dispute := v_held_dispute + 1;
        ELSIF v_is_consult AND coalesce(v_mdob, false) THEN
          NULL;
        ELSIF v_is_consult AND NOT (v_cend IS NOT NULL AND v_today > v_cend) THEN
          NULL;
        ELSIF v_fy IS NULL THEN
          v_held_fy := v_held_fy + 1;
        ELSIF v_fin IS NULL OR NOT (v_today > v_fin) THEN
          NULL;
        ELSIF coalesce(pg_catalog.cardinality(v_delete_ids), 0) < p_limit THEN
          v_block := false;
          IF pg_catalog.to_regclass('public.payment_corrections') IS NOT NULL
             AND public.retention_column_exists('payment_corrections', 'created_at') THEN
            EXECUTE $q$
              SELECT EXISTS (
                SELECT 1
                FROM public.payment_corrections AS c
                WHERE c.booking_id = $1
                  AND (
                    public.retention_has_legal_hold('payment_correction', c.id)
                    OR NOT (
                      $2::date > public.retention_financial_end(
                        public.retention_london_date(c.created_at),
                        $3
                      )
                    )
                  )
              )
            $q$ INTO v_block USING rec_b.id, v_today, v_fy;
          END IF;
          IF NOT coalesce(v_block, false) THEN
            v_delete_ids := pg_catalog.array_append(v_delete_ids, rec_b.id);
          END IF;
        END IF;
      END LOOP;
      v_scrubbed := coalesce(pg_catalog.cardinality(v_scrub_ids), 0);
      v_bookings_deleted := coalesce(pg_catalog.cardinality(v_delete_ids), 0);
      v_redacted := coalesce(pg_catalog.cardinality(v_redact_ids), 0);
    END IF;

    IF v_has_rx AND v_full_bookings THEN
      SELECT coalesce(pg_catalog.array_agg(picked.id), ARRAY[]::uuid[])
      INTO v_rx_ids
      FROM (
        SELECT p.id
        FROM public.prescriptions AS p
        LEFT JOIN public.bookings AS b ON b.id = p.booking_id
        JOIN pg_temp.ret_subjects AS s
          ON s.subject_type = CASE
            WHEN b.dependent_id IS NOT NULL THEN 'dependent'
            ELSE 'patient'
          END
         AND s.subject_id = CASE
            WHEN b.dependent_id IS NOT NULL THEN b.dependent_id
            ELSE p.patient_id
          END
        WHERE s.clinical_end IS NOT NULL
          AND v_today > s.clinical_end
          AND NOT s.missing_dob
          AND NOT public.retention_has_legal_hold('profile', p.patient_id)
          AND NOT public.retention_has_legal_hold('dependent', b.dependent_id)
          AND NOT public.retention_has_legal_hold('booking', b.id)
          AND NOT coalesce(
            b.stripe_dispute_status IN (
              'needs_response', 'under_review', 'warning_needs_response', 'warning_under_review'
            ),
            false
          )
        ORDER BY p.id
        LIMIT p_limit
      ) AS picked;
      v_rx := coalesce(pg_catalog.cardinality(v_rx_ids), 0);
    END IF;

    IF pg_catalog.to_regclass('public.conversations') IS NOT NULL
       AND pg_catalog.to_regclass('public.direct_messages') IS NOT NULL THEN
      FOR rec_c IN
        SELECT id, doctor_id, patient_id
        FROM public.conversations
        ORDER BY id
      LOOP
        IF coalesce(pg_catalog.cardinality(v_conv_ids), 0) >= p_limit THEN
          EXIT;
        END IF;
        v_patient_end := NULL;
        v_patient_missing := false;
        v_has_subject := false;
        SELECT s.clinical_end, s.missing_dob
        INTO v_patient_end, v_patient_missing
        FROM pg_temp.ret_subjects AS s
        WHERE s.subject_type = 'patient'
          AND s.subject_id = rec_c.patient_id;
        IF FOUND THEN
          v_has_subject := true;
        END IF;

        SELECT max(s.clinical_end), bool_or(s.missing_dob), count(*) > 0
        INTO v_dep_end, v_dep_missing, v_block
        FROM pg_temp.ret_subjects AS s
        WHERE s.subject_type = 'dependent'
          AND EXISTS (
            SELECT 1
            FROM pg_temp.ret_consults AS k
            WHERE k.subject_type = 'dependent'
              AND k.subject_id = s.subject_id
              AND k.doctor_id = rec_c.doctor_id
          );
        IF coalesce(v_block, false) THEN
          v_has_subject := true;
        END IF;
        IF NOT v_has_subject THEN
          CONTINUE;
        END IF;
        IF public.retention_has_legal_hold('profile', rec_c.patient_id) THEN
          v_held_legal := v_held_legal + 1;
          CONTINUE;
        END IF;
        IF coalesce(v_patient_missing, false) OR coalesce(v_dep_missing, false) THEN
          CONTINUE;
        END IF;
        v_end := v_patient_end;
        IF v_dep_end IS NOT NULL AND (v_end IS NULL OR v_dep_end > v_end) THEN
          v_end := v_dep_end;
        END IF;
        IF v_end IS NOT NULL AND v_today > v_end THEN
          v_conv_ids := pg_catalog.array_append(v_conv_ids, rec_c.id);
        END IF;
      END LOOP;
    END IF;

    IF pg_catalog.to_regclass('public.patient_wallet') IS NOT NULL
       AND pg_catalog.to_regclass('public.wallet_transactions') IS NOT NULL THEN
      FOR rec_w IN
        SELECT id, patient_id, currency, balance_cents
        FROM public.patient_wallet
      LOOP
        SELECT max(tx.created_at)
        INTO v_last
        FROM public.wallet_transactions AS tx
        WHERE tx.patient_id = rec_w.patient_id
          AND tx.currency = rec_w.currency;
        IF v_last IS NULL THEN
          CONTINUE;
        END IF;
        IF public.retention_has_legal_hold('profile', rec_w.patient_id) THEN
          v_held_legal := v_held_legal + 1;
          v_blocked_patients := pg_catalog.array_append(v_blocked_patients, rec_w.patient_id);
          CONTINUE;
        END IF;
        IF v_fy IS NULL THEN
          v_held_fy := v_held_fy + 1;
          v_blocked_patients := pg_catalog.array_append(v_blocked_patients, rec_w.patient_id);
          CONTINUE;
        END IF;
        v_fin := public.retention_financial_end(public.retention_london_date(v_last), v_fy);
        v_due := v_fin IS NOT NULL AND v_today > v_fin;
        IF NOT v_due THEN
          v_blocked_patients := pg_catalog.array_append(v_blocked_patients, rec_w.patient_id);
          CONTINUE;
        END IF;
        IF rec_w.balance_cents <> 0 THEN
          v_held_wallet := v_held_wallet + 1;
          v_blocked_patients := pg_catalog.array_append(v_blocked_patients, rec_w.patient_id);
          CONTINUE;
        END IF;
        IF coalesce(pg_catalog.cardinality(v_wallet_ids), 0) < p_limit THEN
          v_wallet_ids := pg_catalog.array_append(v_wallet_ids, rec_w.id);
          v_point_patients := pg_catalog.array_append(v_point_patients, rec_w.patient_id);
        ELSE
          v_blocked_patients := pg_catalog.array_append(v_blocked_patients, rec_w.patient_id);
        END IF;
      END LOOP;
      v_wallets := coalesce(pg_catalog.cardinality(v_wallet_ids), 0);
    END IF;

    IF pg_catalog.to_regclass('public.contact_inquiries') IS NOT NULL THEN
      FOR rec_q IN
        SELECT id, created_at
        FROM public.contact_inquiries
        ORDER BY id
      LOOP
        SELECT bool_or(h.closed_at IS NULL), max(h.closed_at)
        INTO v_open_hold, v_closed
        FROM public.legal_holds AS h
        WHERE h.subject_type = 'contact_inquiry'
          AND h.subject_id = rec_q.id;
        IF coalesce(v_open_hold, false) THEN
          v_held_legal := v_held_legal + 1;
          CONTINUE;
        END IF;
        IF v_closed IS NOT NULL THEN
          v_end := (public.retention_london_date(v_closed) + interval '6 years')::date;
        ELSE
          v_end := (public.retention_london_date(rec_q.created_at) + interval '2 years')::date;
        END IF;
        IF v_today > v_end
           AND coalesce(pg_catalog.cardinality(v_inquiry_ids), 0) < p_limit THEN
          v_inquiry_ids := pg_catalog.array_append(v_inquiry_ids, rec_q.id);
        END IF;
      END LOOP;
      v_inquiries := coalesce(pg_catalog.cardinality(v_inquiry_ids), 0);
    END IF;

    IF pg_catalog.to_regclass('public.audit_log') IS NOT NULL THEN
      FOR rec_a IN
        SELECT id, created_at, action, target_type, target_id
        FROM public.audit_log
        ORDER BY id
      LOOP
        IF coalesce(pg_catalog.cardinality(v_audit_ids), 0) >= p_limit THEN
          EXIT;
        END IF;
        v_legal := public.retention_has_legal_hold(rec_a.target_type, rec_a.target_id);
        IF rec_a.target_type IN ('prescription', 'prescription_audit') AND v_has_rx THEN
          SELECT s.clinical_end, s.missing_dob
          INTO v_cend, v_mdob
          FROM public.prescriptions AS p
          LEFT JOIN public.bookings AS b ON b.id = p.booking_id
          JOIN pg_temp.ret_subjects AS s
            ON s.subject_type = CASE
              WHEN b.dependent_id IS NOT NULL THEN 'dependent'
              ELSE 'patient'
            END
           AND s.subject_id = CASE
              WHEN b.dependent_id IS NOT NULL THEN b.dependent_id
              ELSE p.patient_id
            END
          WHERE p.id = rec_a.target_id;
          IF NOT FOUND THEN
            IF v_today > (public.retention_london_date(rec_a.created_at) + interval '2 years')::date
               AND NOT v_legal THEN
              v_audit_ids := pg_catalog.array_append(v_audit_ids, rec_a.id);
            ELSIF v_legal THEN
              v_held_legal := v_held_legal + 1;
            END IF;
          ELSIF v_legal THEN
            v_held_legal := v_held_legal + 1;
          ELSIF coalesce(v_mdob, false) THEN
            NULL;
          ELSIF v_cend IS NOT NULL AND v_today > v_cend THEN
            v_audit_ids := pg_catalog.array_append(v_audit_ids, rec_a.id);
          END IF;
        ELSIF rec_a.target_type IN ('payment_correction', 'payment_recovery', 'recovery') THEN
          IF v_legal THEN
            v_held_legal := v_held_legal + 1;
          ELSIF v_fy IS NULL THEN
            v_held_fy := v_held_fy + 1;
          ELSE
            v_fin := public.retention_financial_end(
              public.retention_london_date(rec_a.created_at),
              v_fy
            );
            IF v_fin IS NOT NULL AND v_today > v_fin THEN
              v_audit_ids := pg_catalog.array_append(v_audit_ids, rec_a.id);
            END IF;
          END IF;
        ELSE
          IF v_legal THEN
            v_held_legal := v_held_legal + 1;
          ELSIF v_today > (public.retention_london_date(rec_a.created_at) + interval '2 years')::date THEN
            v_audit_ids := pg_catalog.array_append(v_audit_ids, rec_a.id);
          END IF;
        END IF;
      END LOOP;
      v_audit := coalesce(pg_catalog.cardinality(v_audit_ids), 0);
    END IF;

    IF pg_catalog.to_regclass('public.doctors') IS NOT NULL
       AND public.retention_column_exists('doctors', 'left_at')
       AND public.retention_column_exists('doctors', 'gmc_number')
       AND public.retention_column_exists('doctors', 'cqc_status') THEN
      FOR rec_d IN
        SELECT id, profile_id, left_at, gmc_number, cqc_status, dbs_check_date,
               cqc_provider_id, indemnity_insurer, mpl_designated_body
        FROM public.doctors
        WHERE left_at IS NOT NULL
        ORDER BY id
      LOOP
        v_end := (public.retention_london_date(rec_d.left_at) + interval '6 years')::date;
        IF NOT (v_today > v_end) THEN
          CONTINUE;
        END IF;
        IF public.retention_has_legal_hold('profile', rec_d.profile_id) THEN
          v_held_legal := v_held_legal + 1;
          CONTINUE;
        END IF;
        IF rec_d.gmc_number IS NULL
           AND rec_d.cqc_status = 'unknown'
           AND rec_d.dbs_check_date IS NULL
           AND rec_d.cqc_provider_id IS NULL
           AND rec_d.indemnity_insurer IS NULL
           AND rec_d.mpl_designated_body IS NULL
           AND NOT EXISTS (
             SELECT 1
             FROM public.doctor_approval_checklist AS k
             WHERE k.doctor_id = rec_d.id
               AND (
                 k.gmc_verified
                 OR k.website_verified
                 OR k.dbs_check_verified
                 OR k.notes IS NOT NULL
               )
           ) THEN
          CONTINUE;
        END IF;
        IF coalesce(pg_catalog.cardinality(v_doctor_ids), 0) < p_limit THEN
          v_doctor_ids := pg_catalog.array_append(v_doctor_ids, rec_d.id);
        END IF;
      END LOOP;
      v_doctors := coalesce(pg_catalog.cardinality(v_doctor_ids), 0);
    END IF;

    IF pg_catalog.to_regclass('public.doctor_documents') IS NOT NULL
       AND public.retention_column_exists('doctors', 'dbs_document_id')
       AND public.retention_column_exists('doctor_documents', 'verified_at') THEN
      FOR rec_doc IN
        SELECT doc.id, doc.storage_path
        FROM public.doctor_documents AS doc
        JOIN public.doctors AS d ON d.dbs_document_id = doc.id
        WHERE doc.verified_at IS NOT NULL
          AND v_today > (public.retention_london_date(doc.verified_at) + interval '6 months')::date
        ORDER BY doc.id
        LIMIT p_limit
      LOOP
        v_doc_ids := pg_catalog.array_append(v_doc_ids, rec_doc.id);
        v_path := rec_doc.storage_path;
        v_bucket := NULL;
        v_object := NULL;
        IF v_path IS NOT NULL AND pg_catalog.to_regclass('storage.objects') IS NOT NULL THEN
          EXECUTE $q$
            SELECT o.bucket_id, o.name
            FROM storage.objects AS o
            WHERE o.name = $1
              AND o.bucket_id IN ('avatars', 'public-read', 'message-attachments')
            LIMIT 1
          $q$ INTO v_bucket, v_object USING v_path;
        END IF;
        IF v_bucket IS NOT NULL THEN
          INSERT INTO pg_temp.ret_queue (bucket_id, object_name, daily_room_name)
          VALUES (v_bucket, v_object, NULL);
        ELSIF v_path IS NOT NULL THEN
          v_missing := v_missing + 1;
        END IF;
      END LOOP;
      v_dbs := coalesce(pg_catalog.cardinality(v_doc_ids), 0);
    END IF;

    IF pg_catalog.to_regclass('public.support_tickets') IS NOT NULL
       AND pg_catalog.to_regclass('public.support_messages') IS NOT NULL THEN
      FOR rec_t IN
        SELECT id, status, closed_at, resolved_at, updated_at
        FROM public.support_tickets
        ORDER BY id
      LOOP
        IF rec_t.status NOT IN ('resolved', 'closed') THEN
          CONTINUE;
        END IF;
        IF public.retention_has_legal_hold('support_ticket', rec_t.id) THEN
          v_held_legal := v_held_legal + 1;
          CONTINUE;
        END IF;
        v_end := public.retention_london_date(coalesce(rec_t.closed_at, rec_t.resolved_at, rec_t.updated_at));
        IF v_end IS NOT NULL
           AND v_today > (v_end + interval '2 years')::date
           AND NOT EXISTS (
             SELECT 1
             FROM public.support_messages AS m
             WHERE m.ticket_id = rec_t.id
               AND NOT (v_today > (public.retention_london_date(m.created_at) + interval '2 years')::date)
           )
           AND coalesce(pg_catalog.cardinality(v_ticket_ids), 0) < p_limit THEN
          v_ticket_ids := pg_catalog.array_append(v_ticket_ids, rec_t.id);
        END IF;
      END LOOP;
    END IF;

    IF pg_catalog.to_regclass('public.organizations') IS NOT NULL
       AND public.retention_column_exists('organizations', 'stripe_customer_id')
       AND pg_catalog.to_regclass('public.licenses') IS NOT NULL THEN
      FOR rec_c IN
        SELECT o.id
        FROM public.organizations AS o
        WHERE o.stripe_customer_id IS NOT NULL
          AND NOT public.retention_has_legal_hold('organization', o.id)
          AND EXISTS (
            SELECT 1 FROM public.licenses AS l WHERE l.organization_id = o.id
          )
          AND NOT EXISTS (
            SELECT 1
            FROM public.licenses AS l
            WHERE l.organization_id = o.id
              AND l.status IN ('active', 'trialing')
          )
        ORDER BY o.id
      LOOP
        IF v_fy IS NULL THEN
          v_held_fy := v_held_fy + 1;
          CONTINUE;
        END IF;
        IF EXISTS (
          SELECT 1
          FROM public.licenses AS l
          WHERE l.organization_id = rec_c.id
            AND (
              coalesce(l.cancelled_at, l.current_period_end) IS NULL
              OR NOT (
                v_today > public.retention_financial_end(
                  public.retention_london_date(coalesce(l.cancelled_at, l.current_period_end)),
                  v_fy
                )
              )
            )
        ) THEN
          CONTINUE;
        END IF;
        IF coalesce(pg_catalog.cardinality(v_corr_ids), 0) < p_limit THEN
          v_corr_ids := pg_catalog.array_append(v_corr_ids, rec_c.id);
        END IF;
      END LOOP;
      v_stripe := coalesce(pg_catalog.cardinality(v_corr_ids), 0);
    END IF;
  END IF;

  IF v_apply AND v_mode <> 'off' THEN
    PERFORM pg_catalog.set_config('mydoctors360.retention_purge', 'on', true);

    IF v_orgs > 0 THEN
      FOREACH v_org IN ARRAY v_stripe_ids
      LOOP
        v_sets := ARRAY[]::text[];
        IF public.retention_column_exists('organizations', 'name') THEN
          v_sets := pg_catalog.array_append(v_sets, pg_catalog.format('%I = %L', 'name', ''));
        END IF;
        IF public.retention_column_exists('organizations', 'slug') THEN
          v_sets := pg_catalog.array_append(
            v_sets,
            pg_catalog.format('%I = %L', 'slug', 'erased-' || v_org::text)
          );
        END IF;
        FOREACH v_col IN ARRAY ARRAY[
          'email', 'phone', 'address_line1', 'address_line2', 'city', 'state',
          'postal_code', 'country', 'website', 'logo_url', 'description',
          'brand_display_name', 'brand_support_email', 'brand_support_phone'
        ]::text[]
        LOOP
          IF public.retention_column_exists('organizations', v_col) THEN
            IF v_col = 'brand_display_name' THEN
              v_sets := pg_catalog.array_append(v_sets, pg_catalog.format('%I = %L', v_col, ''));
            ELSE
              v_sets := pg_catalog.array_append(v_sets, pg_catalog.format('%I = NULL', v_col));
            END IF;
          END IF;
        END LOOP;
        IF coalesce(pg_catalog.cardinality(v_sets), 0) > 0 THEN
          EXECUTE pg_catalog.format(
            'UPDATE public.organizations SET %s WHERE id = $1',
            pg_catalog.array_to_string(v_sets, ', ')
          ) USING v_org;
        END IF;
      END LOOP;
    END IF;

    IF v_scrubbed > 0 THEN
      UPDATE public.bookings
      SET doctor_notes = NULL,
          visit_summary = NULL,
          visit_summary_at = NULL,
          patient_notes = NULL
      WHERE id = ANY (v_scrub_ids);
    END IF;

    IF v_redacted > 0 THEN
      UPDATE public.bookings
      SET stripe_dispute_reason = NULL
      WHERE id = ANY (v_redact_ids);
    END IF;

    IF pg_catalog.to_regclass('public.payment_corrections') IS NOT NULL
       AND public.retention_column_exists('payment_corrections', 'dispute_reason')
       AND public.retention_column_exists('payment_corrections', 'reason')
       AND v_full_bookings THEN
      FOR rec_b IN
        EXECUTE $q$
          SELECT c.id, c.created_by
          FROM public.payment_corrections AS c
          JOIN public.bookings AS b ON b.id = c.booking_id
          WHERE b.stripe_dispute_closed_at IS NOT NULL
            AND NOT coalesce(
              b.stripe_dispute_status IN (
                'needs_response', 'under_review', 'warning_needs_response', 'warning_under_review'
              ),
              false
            )
            AND NOT public.retention_has_legal_hold('payment_correction', c.id)
            AND NOT public.retention_has_legal_hold('booking', b.id)
            AND $1::date > (public.retention_london_date(b.stripe_dispute_closed_at) + interval '12 months')::date
            AND (
              c.dispute_reason IS NOT NULL
              OR c.dispute_findings IS NOT NULL
              OR c.customer_response IS NOT NULL
              OR c.clear_risk_reason IS NOT NULL
              OR c.reason IS DISTINCT FROM '[redacted]'
            )
            AND (
              c.disputed_at IS NOT NULL
              OR c.dispute_reason IS NOT NULL
              OR c.dispute_findings IS NOT NULL
              OR c.customer_response IS NOT NULL
            )
          LIMIT $2
        $q$ USING v_today, p_limit
      LOOP
        UPDATE public.payment_corrections
        SET dispute_reason = NULL,
            dispute_findings = NULL,
            customer_response = NULL,
            clear_risk = FALSE,
            clear_risk_reason_code = NULL,
            clear_risk_reason = NULL,
            reason = '[redacted]'
        WHERE id = rec_b.id;
        v_redacted := v_redacted + 1;
        INSERT INTO public.payment_correction_events (correction_id, event_type, payload)
        SELECT rec_b.id, 'dispute_redacted', '{"redacted": true}'::jsonb
        WHERE NOT EXISTS (
          SELECT 1
          FROM public.payment_correction_events AS e
          WHERE e.correction_id = rec_b.id
            AND e.event_type = 'dispute_redacted'
        );
        IF rec_b.created_by IS NOT NULL THEN
          INSERT INTO public.audit_log (actor_id, action, target_type, target_id, metadata)
          SELECT rec_b.created_by, 'dispute_redacted', 'payment_correction', rec_b.id, '{"redacted": true}'::jsonb
          WHERE NOT EXISTS (
            SELECT 1
            FROM public.audit_log AS existing
            WHERE existing.action = 'dispute_redacted'
              AND existing.target_type = 'payment_correction'
              AND existing.target_id = rec_b.id
          );
        END IF;
      END LOOP;
    END IF;

    IF v_rx > 0 THEN
      DELETE FROM public.prescription_audit_log
      WHERE prescription_id = ANY (v_rx_ids);
      GET DIAGNOSTICS v_rx_audit = ROW_COUNT;
      DELETE FROM public.prescriptions
      WHERE id = ANY (v_rx_ids);
    END IF;

    IF v_bookings_deleted > 0 THEN
      IF pg_catalog.to_regclass('public.reviews') IS NOT NULL THEN
        DELETE FROM public.reviews WHERE booking_id = ANY (v_delete_ids);
        GET DIAGNOSTICS v_reviews = ROW_COUNT;
      END IF;
      IF pg_catalog.to_regclass('public.platform_fees') IS NOT NULL THEN
        EXECUTE 'DELETE FROM public.platform_fees WHERE booking_id = ANY ($1)' USING v_delete_ids;
      END IF;
      IF pg_catalog.to_regclass('public.payment_corrections') IS NOT NULL THEN
        IF pg_catalog.to_regclass('public.payment_correction_offset_holds') IS NOT NULL THEN
          EXECUTE $q$
            DELETE FROM public.payment_correction_offset_holds
            WHERE correction_id IN (
              SELECT id FROM public.payment_corrections WHERE booking_id = ANY ($1)
            )
          $q$ USING v_delete_ids;
        END IF;
        IF pg_catalog.to_regclass('public.payment_correction_events') IS NOT NULL THEN
          EXECUTE $q$
            DELETE FROM public.payment_correction_events
            WHERE correction_id IN (
              SELECT id FROM public.payment_corrections WHERE booking_id = ANY ($1)
            )
          $q$ USING v_delete_ids;
        END IF;
        IF pg_catalog.to_regclass('public.payment_correction_approvals') IS NOT NULL THEN
          EXECUTE $q$
            DELETE FROM public.payment_correction_approvals
            WHERE correction_id IN (
              SELECT id FROM public.payment_corrections WHERE booking_id = ANY ($1)
            )
          $q$ USING v_delete_ids;
        END IF;
        DELETE FROM public.payment_corrections WHERE booking_id = ANY (v_delete_ids);
      END IF;
      INSERT INTO pg_temp.ret_queue (bucket_id, object_name, daily_room_name)
      SELECT NULL, NULL, bk.daily_room_name
      FROM public.bookings AS bk
      WHERE bk.id = ANY (v_delete_ids)
        AND bk.daily_room_name IS NOT NULL;
      DELETE FROM public.bookings WHERE id = ANY (v_delete_ids);
    END IF;

    IF coalesce(pg_catalog.cardinality(v_conv_ids), 0) > 0 THEN
      IF pg_catalog.to_regclass('public.message_attachments') IS NOT NULL THEN
        FOR rec_doc IN
          EXECUTE $q$
            SELECT storage_path
            FROM public.message_attachments
            WHERE conversation_id = ANY ($1)
          $q$ USING v_conv_ids
        LOOP
          v_path := rec_doc.storage_path;
          v_bucket := NULL;
          v_object := NULL;
          IF pg_catalog.to_regclass('storage.objects') IS NOT NULL THEN
            EXECUTE $q$
              SELECT o.bucket_id, o.name
              FROM storage.objects AS o
              WHERE o.name = $1
                AND o.bucket_id IN ('avatars', 'public-read', 'message-attachments')
              LIMIT 1
            $q$ INTO v_bucket, v_object USING v_path;
          END IF;
          IF v_bucket IS NOT NULL THEN
            INSERT INTO pg_temp.ret_queue (bucket_id, object_name, daily_room_name)
            VALUES (v_bucket, v_object, NULL);
          ELSE
            v_missing := v_missing + 1;
          END IF;
        END LOOP;
      END IF;
      DELETE FROM public.direct_messages WHERE conversation_id = ANY (v_conv_ids);
      GET DIAGNOSTICS v_messages = ROW_COUNT;
      DELETE FROM public.conversations WHERE id = ANY (v_conv_ids);
    END IF;

    IF coalesce(pg_catalog.cardinality(v_ticket_ids), 0) > 0 THEN
      DELETE FROM public.support_messages
      WHERE ticket_id = ANY (v_ticket_ids)
        AND v_today > (public.retention_london_date(created_at) + interval '2 years')::date;
      GET DIAGNOSTICS v_support_messages = ROW_COUNT;
      DELETE FROM public.support_tickets AS t
      WHERE t.id = ANY (v_ticket_ids)
        AND NOT EXISTS (
          SELECT 1 FROM public.support_messages AS m WHERE m.ticket_id = t.id
        );
      GET DIAGNOSTICS v_support_tickets = ROW_COUNT;
    END IF;

    -- Messages on closed tickets whose ticket itself is not yet 2 years old.
    IF pg_catalog.to_regclass('public.support_messages') IS NOT NULL
       AND pg_catalog.to_regclass('public.support_tickets') IS NOT NULL THEN
      DELETE FROM public.support_messages AS m
      USING public.support_tickets AS t
      WHERE m.ticket_id = t.id
        AND t.status IN ('resolved', 'closed')
        AND NOT public.retention_has_legal_hold('support_ticket', t.id)
        AND v_today > (public.retention_london_date(m.created_at) + interval '2 years')::date
        AND NOT (m.ticket_id = ANY (v_ticket_ids));
      GET DIAGNOSTICS v_n = ROW_COUNT;
      v_support_messages := v_support_messages + coalesce(v_n, 0);
    END IF;

    IF v_doctors > 0 THEN
      UPDATE public.doctors
      SET gmc_number = NULL,
          cqc_provider_id = NULL,
          cqc_location_id = NULL,
          cqc_verified_at = NULL,
          cqc_status = 'unknown',
          indemnity_insurer = NULL,
          indemnity_cover_gbp = NULL,
          indemnity_expiry = NULL,
          indemnity_document_id = NULL,
          mpl_designated_body = NULL,
          mpl_attestation_signed_at = NULL,
          dbs_check_date = NULL
      WHERE id = ANY (v_doctor_ids);
      IF pg_catalog.to_regclass('public.doctor_approval_checklist') IS NOT NULL THEN
        UPDATE public.doctor_approval_checklist
        SET gmc_verified = false,
            website_verified = false,
            cqc_status_evidenced = false,
            mpl_attestation_reviewed = false,
            indemnity_document_verified = false,
            indemnity_in_date = false,
            dbs_check_verified = false,
            notes = NULL
        WHERE doctor_id = ANY (v_doctor_ids);
      END IF;
    END IF;

    IF v_dbs > 0 THEN
      UPDATE public.doctors
      SET dbs_document_id = NULL
      WHERE dbs_document_id = ANY (v_doc_ids);
      DELETE FROM public.doctor_documents WHERE id = ANY (v_doc_ids);
    END IF;

    IF v_wallets > 0 THEN
      DELETE FROM public.wallet_transactions AS tx
      USING public.patient_wallet AS w
      WHERE tx.patient_id = w.patient_id
        AND tx.currency = w.currency
        AND w.id = ANY (v_wallet_ids);
      GET DIAGNOSTICS v_wallet_tx = ROW_COUNT;
      DELETE FROM public.patient_wallet WHERE id = ANY (v_wallet_ids);
      IF pg_catalog.to_regclass('public.patient_points') IS NOT NULL THEN
        DELETE FROM public.points_transactions AS pt
        WHERE pt.patient_id = ANY (v_point_patients)
          AND NOT (pt.patient_id = ANY (v_blocked_patients));
        DELETE FROM public.patient_points AS pp
        WHERE pp.patient_id = ANY (v_point_patients)
          AND NOT (pp.patient_id = ANY (v_blocked_patients));
        GET DIAGNOSTICS v_points = ROW_COUNT;
      END IF;
    END IF;

    IF v_audit > 0 THEN
      DELETE FROM public.audit_log WHERE id = ANY (v_audit_ids);
    END IF;

    IF v_inquiries > 0 THEN
      DELETE FROM public.contact_inquiries WHERE id = ANY (v_inquiry_ids);
    END IF;

    IF v_stripe > 0 THEN
      UPDATE public.organizations
      SET stripe_customer_id = NULL
      WHERE id = ANY (v_corr_ids);
    END IF;

    DELETE FROM public.retention_purge_objects
    WHERE deleted_at IS NOT NULL
      AND v_today > (public.retention_london_date(deleted_at) + 7);

    INSERT INTO public.retention_purge_objects (bucket_id, object_name, daily_room_name)
    SELECT bucket_id, object_name, daily_room_name
    FROM pg_temp.ret_queue;

    PERFORM pg_catalog.set_config('mydoctors360.retention_purge', 'off', true);
  END IF;

  IF v_mode <> 'off' THEN
    SELECT count(*)
    INTO v_queued
    FROM pg_temp.ret_queue;
  END IF;

  IF v_mode <> 'off'
     AND public.retention_column_exists('profiles', 'restricted_at') THEN
    SELECT count(*)
    INTO v_accounts
    FROM public.profiles AS p
    WHERE p.restricted_at IS NOT NULL
      AND NOT EXISTS (SELECT 1 FROM public.bookings AS b WHERE b.patient_id = p.id)
      AND NOT EXISTS (
        SELECT 1
        FROM public.bookings AS b
        JOIN public.doctors AS d ON d.id = b.doctor_id
        WHERE d.profile_id = p.id
      )
      AND NOT EXISTS (SELECT 1 FROM public.prescriptions AS rx WHERE rx.patient_id = p.id)
      AND NOT EXISTS (
        SELECT 1
        FROM public.prescriptions AS rx
        JOIN public.doctors AS d ON d.id = rx.doctor_id
        WHERE d.profile_id = p.id
      )
      AND NOT EXISTS (
        SELECT 1 FROM public.direct_messages AS m WHERE m.sender_id = p.id
      )
      AND NOT EXISTS (
        SELECT 1
        FROM public.conversations AS c
        WHERE c.patient_id = p.id
           OR c.doctor_id IN (SELECT d.id FROM public.doctors AS d WHERE d.profile_id = p.id)
      )
      AND NOT EXISTS (
        SELECT 1
        FROM public.patient_wallet AS w
        WHERE w.patient_id = p.id
          AND w.balance_cents <> 0
      );
  END IF;

  v_counts := pg_catalog.jsonb_build_object(
    'dry_run', NOT v_apply,
    'mode', v_mode,
    'limit', p_limit,
    'bookings_scrubbed_clinical', v_scrubbed,
    'bookings_deleted', v_bookings_deleted,
    'prescription_audit_log_deleted', v_rx_audit,
    'prescriptions_deleted', v_rx,
    'reviews_deleted', v_reviews,
    'messages_deleted', CASE WHEN v_apply THEN v_messages ELSE coalesce(pg_catalog.cardinality(v_conv_ids), 0) END,
    'organizations_scrubbed', v_orgs,
    'organizations_stripe_customer_cleared', v_stripe,
    'dispute_narratives_redacted', v_redacted,
    'audit_log_deleted', v_audit,
    'wallets_deleted', v_wallets,
    'wallet_transactions_deleted', v_wallet_tx,
    'points_deleted', v_points,
    'contact_inquiries_deleted', v_inquiries,
    'doctor_regulatory_scrubbed', v_doctors,
    'dbs_documents_deleted', v_dbs,
    'support_messages_deleted', v_support_messages,
    'support_tickets_deleted', CASE WHEN v_apply THEN v_support_tickets ELSE coalesce(pg_catalog.cardinality(v_ticket_ids), 0) END,
    'accounts_clear', coalesce(v_accounts, 0),
    'objects_queued', coalesce(v_queued, 0),
    'missing_object', v_missing,
    'call_attendance', 0,
    'held_missing_dob', v_held_dob,
    'held_open_dispute', v_held_dispute,
    'held_legal_hold', v_held_legal,
    'held_no_fy_end', v_held_fy,
    'held_wallet_balance', v_held_wallet
  );

  INSERT INTO public.retention_purge_runs (
    started_at, finished_at, dry_run, mode, batch_limit, counts, sqlstate
  ) VALUES (
    v_started, pg_catalog.clock_timestamp(), NOT v_apply, v_mode, p_limit, v_counts, NULL
  );

  RETURN v_counts;
EXCEPTION
  WHEN OTHERS THEN
    PERFORM pg_catalog.set_config('mydoctors360.retention_purge', 'off', true);
    GET STACKED DIAGNOSTICS v_sqlstate = RETURNED_SQLSTATE;
    RAISE;
END;
$purge$;

REVOKE ALL ON FUNCTION public.purge_expired_retention(boolean, integer) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.purge_expired_retention(boolean, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.purge_expired_retention(boolean, integer) TO service_role;

COMMENT ON FUNCTION public.purge_expired_retention(boolean, integer) IS
  'Deletes or counts retained rows whose clock has ended. Apply runs only when platform_settings.retention_purge mode is apply and p_dry_run is false. Counts only; no row content is returned or logged.';
