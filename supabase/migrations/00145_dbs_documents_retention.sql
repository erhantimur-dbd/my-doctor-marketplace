-- DBS record fields, certificate-file clocks, and the remaining document
-- and empty-wallet rules. Replaces purge_expired_retention from 00143.
-- Does not edit 00143.
--
-- The DBS record stays on public.doctors, next to dbs_check_date and
-- dbs_document_id. Those columns already store one current check per
-- doctor, and they share the six-year clock that starts at left_at.
-- A separate history table would split that clock without a second check
-- to keep.
--
-- doctor_approval_checklist.dbs_check_verified_at is set by a trigger
-- when dbs_check_verified becomes true. The same trigger copies that
-- moment onto doctors.dbs_verified_at and doctors.dbs_verified_by
-- (the checklist reviewer). There is no separate DBS upload API: the
-- admin approval checklist is the verify flow, and registration only
-- stores an optional issue date on dbs_check_date.
--
-- The certificate file is the doctor_documents row pointed at by
-- dbs_document_id. There is still no DBS document_type. The file is
-- deleted once the record fields are stored (certificate number, level,
-- issue date, verified_at, verified_by), and otherwise six months after
-- doctor_documents.verified_at, or doctors.dbs_verified_at when the file
-- has no verified_at of its own.
-- An unverified file (both timestamps null) is deleted six months after
-- doctor_documents.created_at. There is no uploaded_at column.
-- The anniversary day is still inside the period.
--
-- dbs_reupload_required is set only when that file is removed, the
-- record fields are not all stored, and the doctor is still active
-- (left_at is null and the profile is not restricted). A complete record
-- does not ask for another upload. No email is sent.
--
-- Every doctor_documents row, including diplomas and the indemnity file,
-- is deleted six years after left_at. An open legal hold on the doctor's
-- profile blocks that delete and the certificate-file delete.
--
-- A patient wallet with no transactions and a zero balance is deleted
-- when the profile is restricted, unless a legal hold is open or a
-- credit has not yet been posted (held_pending_credit).
-- wallet_transactions has no status: a row is already posted, and a
-- wallet with any row uses the six-year activity clock instead.
-- Unposted credits that do exist:
--   gift_cards purchased by the patient, status active, redeemed_at
--   null. status pending is an unpaid card, not a credit.
--   payment_corrections for that patient that are not settled or
--   waived, and that credit the wallet: error_type
--   patient_credit_in_error, or a patient customer-favour correction
--   whose recovery_method is wallet_adjustment.
-- doctor_wallet_credit_transfers.status pending is a doctor Connect
-- payout of credit the patient already spent, not an unposted credit.
-- A non-zero balance is held_wallet_balance. A wallet that has
-- transactions keeps the six-year clock from the latest transaction.
--
-- New count keys: dbs_fields_scrubbed, dbs_reupload_flagged,
-- doctor_documents_deleted, wallets_deleted_restricted, held_pending_credit.
-- retention_purge stays seeded as dry_run. Apply still needs both gates.


ALTER TABLE public.doctors
  ADD COLUMN IF NOT EXISTS dbs_certificate_number text,
  ADD COLUMN IF NOT EXISTS dbs_level text,
  ADD COLUMN IF NOT EXISTS dbs_issue_date date,
  ADD COLUMN IF NOT EXISTS dbs_verified_at timestamptz,
  ADD COLUMN IF NOT EXISTS dbs_verified_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS dbs_reupload_required boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.doctors.dbs_certificate_number IS
  'DBS certificate number. Kept until 6 years after left_at, then nulled.';
COMMENT ON COLUMN public.doctors.dbs_level IS
  'DBS level: basic, standard, enhanced, or enhanced_barred. Kept until 6 years after left_at.';
COMMENT ON COLUMN public.doctors.dbs_issue_date IS
  'Date the DBS certificate was issued. Kept until 6 years after left_at.';
COMMENT ON COLUMN public.doctors.dbs_verified_at IS
  'When the checklist first recorded the DBS check as verified.';
COMMENT ON COLUMN public.doctors.dbs_verified_by IS
  'Profile that ticked the DBS checklist box.';
COMMENT ON COLUMN public.doctors.dbs_reupload_required IS
  'In-app flag. Set when the certificate file was removed and the DBS record is incomplete for a doctor who is still active. No email.';

DO $lvl$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_catalog.pg_constraint
    WHERE conname = 'doctors_dbs_level_check'
  ) THEN
    ALTER TABLE public.doctors
      ADD CONSTRAINT doctors_dbs_level_check
      CHECK (
        dbs_level IS NULL
        OR dbs_level IN ('basic', 'standard', 'enhanced', 'enhanced_barred')
      );
  END IF;
END
$lvl$;

ALTER TABLE public.doctor_approval_checklist
  ADD COLUMN IF NOT EXISTS dbs_check_verified_at timestamptz;

COMMENT ON COLUMN public.doctor_approval_checklist.dbs_check_verified_at IS
  'Set when dbs_check_verified becomes true. Not moved if the box stays ticked.';

CREATE OR REPLACE FUNCTION public.record_dbs_checklist_verified()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $dbs$
BEGIN
  IF NEW.dbs_check_verified IS TRUE
     AND (TG_OP = 'INSERT' OR OLD.dbs_check_verified IS DISTINCT FROM TRUE) THEN
    IF NEW.dbs_check_verified_at IS NULL THEN
      NEW.dbs_check_verified_at := pg_catalog.now();
    END IF;
    UPDATE public.doctors
    SET dbs_verified_at = coalesce(public.doctors.dbs_verified_at, pg_catalog.now()),
        dbs_verified_by = coalesce(public.doctors.dbs_verified_by, NEW.reviewer_id)
    WHERE id = NEW.doctor_id;
  END IF;
  RETURN NEW;
END;
$dbs$;

REVOKE ALL ON FUNCTION public.record_dbs_checklist_verified() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.record_dbs_checklist_verified() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.record_dbs_checklist_verified() TO service_role;

DROP TRIGGER IF EXISTS doctor_approval_checklist_dbs_verified ON public.doctor_approval_checklist;
CREATE TRIGGER doctor_approval_checklist_dbs_verified
  BEFORE INSERT OR UPDATE OF dbs_check_verified
  ON public.doctor_approval_checklist
  FOR EACH ROW
  EXECUTE FUNCTION public.record_dbs_checklist_verified();


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
  v_dbs_fields integer := 0;
  v_reupload integer := 0;
  v_all_docs integer := 0;
  v_wallets_restricted integer := 0;
  v_held_pending integer := 0;
  v_reupload_ids uuid[] := ARRAY[]::uuid[];
  v_file_ids uuid[] := ARRAY[]::uuid[];
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
        IF public.retention_has_legal_hold('profile', rec_w.patient_id) THEN
          v_held_legal := v_held_legal + 1;
          v_blocked_patients := pg_catalog.array_append(v_blocked_patients, rec_w.patient_id);
          CONTINUE;
        END IF;
        IF v_last IS NULL THEN
          -- No activity clock. A non-zero balance is still held. A zero
          -- balance with no transactions is deleted only for a restricted
          -- account, and only when nothing is waiting to credit the wallet.
          IF rec_w.balance_cents <> 0 THEN
            v_held_wallet := v_held_wallet + 1;
            v_blocked_patients := pg_catalog.array_append(v_blocked_patients, rec_w.patient_id);
            CONTINUE;
          END IF;
          v_block := false;
          IF pg_catalog.to_regclass('public.gift_cards') IS NOT NULL THEN
            EXECUTE $q$
              SELECT EXISTS (
                SELECT 1
                FROM public.gift_cards AS g
                WHERE g.purchased_by = $1
                  AND g.status = 'active'
                  AND g.redeemed_at IS NULL
              )
            $q$ INTO v_block USING rec_w.patient_id;
          END IF;
          IF NOT coalesce(v_block, false)
             AND pg_catalog.to_regclass('public.payment_corrections') IS NOT NULL
             AND public.retention_column_exists('payment_corrections', 'patient_id')
             AND public.retention_column_exists('payment_corrections', 'status')
             AND public.retention_column_exists('payment_corrections', 'error_type') THEN
            v_due := false;
            IF public.retention_column_exists('payment_corrections', 'settled_at')
               AND public.retention_column_exists('payment_corrections', 'party')
               AND public.retention_column_exists('payment_corrections', 'direction')
               AND public.retention_column_exists('payment_corrections', 'recovery_method') THEN
              EXECUTE $q$
                SELECT EXISTS (
                  SELECT 1
                  FROM public.payment_corrections AS c
                  WHERE c.patient_id = $1
                    AND c.status NOT IN ('settled', 'waived')
                    AND c.settled_at IS NULL
                    AND (
                      c.error_type = 'patient_credit_in_error'
                      OR (
                        c.party = 'patient'
                        AND c.direction = 'customer_favour'
                        AND c.recovery_method = 'wallet_adjustment'
                      )
                    )
                )
              $q$ INTO v_due USING rec_w.patient_id;
            ELSE
              EXECUTE $q$
                SELECT EXISTS (
                  SELECT 1
                  FROM public.payment_corrections AS c
                  WHERE c.patient_id = $1
                    AND c.status NOT IN ('settled', 'waived')
                    AND c.error_type = 'patient_credit_in_error'
                )
              $q$ INTO v_due USING rec_w.patient_id;
            END IF;
            v_block := coalesce(v_due, false);
          END IF;
          IF coalesce(v_block, false) THEN
            v_held_pending := v_held_pending + 1;
            CONTINUE;
          END IF;
          v_due := false;
          IF public.retention_column_exists('profiles', 'restricted_at') THEN
            EXECUTE $q$
              SELECT p.restricted_at IS NOT NULL
              FROM public.profiles AS p
              WHERE p.id = $1
            $q$ INTO v_due USING rec_w.patient_id;
          END IF;
          IF coalesce(v_due, false)
             AND coalesce(pg_catalog.cardinality(v_wallet_ids), 0) < p_limit THEN
            v_wallet_ids := pg_catalog.array_append(v_wallet_ids, rec_w.id);
            v_wallets_restricted := v_wallets_restricted + 1;
          END IF;
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
               cqc_provider_id, indemnity_insurer, mpl_designated_body,
               dbs_certificate_number, dbs_level, dbs_issue_date,
               dbs_verified_at, dbs_verified_by, dbs_reupload_required
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
           AND rec_d.dbs_certificate_number IS NULL
           AND rec_d.dbs_level IS NULL
           AND rec_d.dbs_issue_date IS NULL
           AND rec_d.dbs_verified_at IS NULL
           AND rec_d.dbs_verified_by IS NULL
           AND rec_d.dbs_reupload_required IS NOT TRUE
           AND NOT EXISTS (
             SELECT 1
             FROM public.doctor_approval_checklist AS k
             WHERE k.doctor_id = rec_d.id
               AND (
                 k.gmc_verified
                 OR k.website_verified
                 OR k.dbs_check_verified
                 OR k.dbs_check_verified_at IS NOT NULL
                 OR k.notes IS NOT NULL
               )
           ) THEN
          CONTINUE;
        END IF;
        IF coalesce(pg_catalog.cardinality(v_doctor_ids), 0) < p_limit THEN
          v_doctor_ids := pg_catalog.array_append(v_doctor_ids, rec_d.id);
          IF rec_d.dbs_certificate_number IS NOT NULL
             OR rec_d.dbs_level IS NOT NULL
             OR rec_d.dbs_issue_date IS NOT NULL
             OR rec_d.dbs_verified_at IS NOT NULL
             OR rec_d.dbs_verified_by IS NOT NULL THEN
            v_dbs_fields := v_dbs_fields + 1;
          END IF;
        END IF;
      END LOOP;
      v_doctors := coalesce(pg_catalog.cardinality(v_doctor_ids), 0);
    END IF;

    IF pg_catalog.to_regclass('public.doctor_documents') IS NOT NULL
       AND public.retention_column_exists('doctors', 'dbs_document_id')
       AND public.retention_column_exists('doctor_documents', 'verified_at')
       AND public.retention_column_exists('doctor_documents', 'created_at')
       AND public.retention_column_exists('doctors', 'dbs_certificate_number') THEN
      FOR rec_doc IN
        SELECT
          doc.id,
          doc.storage_path,
          doc.verified_at,
          doc.created_at,
          d.id AS doctor_id,
          d.left_at,
          d.profile_id,
          d.dbs_certificate_number,
          d.dbs_level,
          d.dbs_issue_date,
          d.dbs_verified_at,
          d.dbs_verified_by,
          p.restricted_at
        FROM public.doctor_documents AS doc
        JOIN public.doctors AS d ON d.dbs_document_id = doc.id
        LEFT JOIN public.profiles AS p ON p.id = d.profile_id
        ORDER BY doc.id
      LOOP
        IF coalesce(pg_catalog.cardinality(v_doc_ids), 0) >= p_limit THEN
          EXIT;
        END IF;
        IF public.retention_has_legal_hold('profile', rec_doc.profile_id) THEN
          v_held_legal := v_held_legal + 1;
          CONTINUE;
        END IF;
        v_block := rec_doc.dbs_certificate_number IS NOT NULL
          AND rec_doc.dbs_level IS NOT NULL
          AND rec_doc.dbs_issue_date IS NOT NULL
          AND rec_doc.dbs_verified_at IS NOT NULL
          AND rec_doc.dbs_verified_by IS NOT NULL;
        v_due := false;
        IF v_block THEN
          v_due := true;
        ELSIF coalesce(rec_doc.verified_at, rec_doc.dbs_verified_at) IS NOT NULL THEN
          v_due := v_today > (
            public.retention_london_date(coalesce(rec_doc.verified_at, rec_doc.dbs_verified_at))
            + interval '6 months'
          )::date;
        ELSIF rec_doc.created_at IS NOT NULL THEN
          v_due := v_today > (
            public.retention_london_date(rec_doc.created_at) + interval '6 months'
          )::date;
        END IF;
        IF NOT v_due THEN
          CONTINUE;
        END IF;
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
        IF NOT v_block
           AND rec_doc.left_at IS NULL
           AND rec_doc.restricted_at IS NULL THEN
          v_reupload_ids := pg_catalog.array_append(v_reupload_ids, rec_doc.doctor_id);
        END IF;
      END LOOP;
      v_dbs := coalesce(pg_catalog.cardinality(v_doc_ids), 0);
      v_reupload := coalesce(pg_catalog.cardinality(v_reupload_ids), 0);
    END IF;

    IF pg_catalog.to_regclass('public.doctor_documents') IS NOT NULL
       AND pg_catalog.to_regclass('public.doctors') IS NOT NULL
       AND public.retention_column_exists('doctors', 'left_at') THEN
      FOR rec_doc IN
        SELECT doc.id, doc.storage_path, d.profile_id
        FROM public.doctor_documents AS doc
        JOIN public.doctors AS d ON d.id = doc.doctor_id
        WHERE d.left_at IS NOT NULL
          AND v_today > (public.retention_london_date(d.left_at) + interval '6 years')::date
        ORDER BY doc.id
      LOOP
        IF coalesce(pg_catalog.cardinality(v_file_ids), 0) >= p_limit THEN
          EXIT;
        END IF;
        IF public.retention_has_legal_hold('profile', rec_doc.profile_id) THEN
          v_held_legal := v_held_legal + 1;
          CONTINUE;
        END IF;
        v_file_ids := pg_catalog.array_append(v_file_ids, rec_doc.id);
        IF rec_doc.id = ANY (v_doc_ids) THEN
          CONTINUE;
        END IF;
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
      v_all_docs := coalesce(pg_catalog.cardinality(v_file_ids), 0);
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
          dbs_check_date = NULL,
          dbs_certificate_number = NULL,
          dbs_level = NULL,
          dbs_issue_date = NULL,
          dbs_verified_at = NULL,
          dbs_verified_by = NULL,
          dbs_reupload_required = false
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
            dbs_check_verified_at = NULL,
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

    IF v_reupload > 0 THEN
      UPDATE public.doctors
      SET dbs_reupload_required = true
      WHERE id = ANY (v_reupload_ids)
        AND dbs_reupload_required IS DISTINCT FROM true;
    END IF;

    IF v_all_docs > 0 THEN
      UPDATE public.doctors
      SET dbs_document_id = NULL
      WHERE dbs_document_id = ANY (v_file_ids);
      UPDATE public.doctors
      SET indemnity_document_id = NULL
      WHERE indemnity_document_id = ANY (v_file_ids);
      DELETE FROM public.doctor_documents WHERE id = ANY (v_file_ids);
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
    'dbs_fields_scrubbed', v_dbs_fields,
    'dbs_reupload_flagged', v_reupload,
    'doctor_documents_deleted', v_all_docs,
    'wallets_deleted_restricted', v_wallets_restricted,
    'held_pending_credit', v_held_pending,
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
