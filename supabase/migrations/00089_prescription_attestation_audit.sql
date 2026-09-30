-- Prescription attestation + append-only audit log
-- Part of Workstream 3.1 of the UK CQC compliance plan (plan file:
-- hashed-twirling-tiger.md).
--
-- UNIVERSAL change (applies to every region, not UK-gated). Even a pure
-- technology-intermediary platform has to surface GMC remote-prescribing
-- guidance at the point of issue and retain an immutable record of the
-- doctor's clinical attestation. The clinical decision must be the
-- doctor's and must be evidenced, otherwise the platform risks being
-- characterised as carrying on the regulated activity itself.
--
-- Two changes land here:
--
-- 1. Three new columns on `prescriptions`:
--    - `contains_controlled_drug`    : doctor ticks this only for Schedule
--                                      2, 3, 4, or 5 controlled drugs.
--    - `controlled_drug_justification`: free-text rationale for remote
--                                      prescribing of a CD. A DB CHECK
--                                      constraint enforces that the
--                                      justification exists (and is
--                                      substantive — 20+ chars) whenever
--                                      the flag is TRUE.
--    - `attested_at`                 : timestamp of the doctor's
--                                      attestation submission.
--
-- 2. A new append-only table `prescription_audit_log` that captures:
--    - Event type (issued / updated / cancelled)
--    - Actor profile id (the doctor)
--    - IP address + user agent at the time of the event
--    - Full snapshot of the prescription payload as submitted
--    - Attestation checkboxes the doctor ticked
--
--    Mutation (UPDATE / DELETE) is blocked at the DB level via a trigger
--    that raises `prescription_audit_log is append-only`. This is stricter
--    than RLS because the service-role bypasses RLS but should NOT be
--    permitted to rewrite history — if an incident is investigated later
--    (GMC, ICO, civil claim) the audit trail must be trustworthy.
--
-- Prod's imported migrations do not add these columns or this table.
-- Guards below make a second apply, or a partial earlier attempt, safe.
-- The deny function is SECURITY INVOKER (it only raises). It is not a
-- definer, so it is not granted to service_role only.
--
-- prescription_id is ON DELETE RESTRICT. A prescription that already has
-- an audit row cannot be deleted: the delete fails with 23503 and the
-- append-only trigger never runs. CREATE TABLE IF NOT EXISTS does not
-- change an existing foreign key, so a CASCADE constraint is replaced.

-- ===================== prescriptions: attestation columns =====================
DO $cols$
BEGIN
  IF to_regclass('public.prescriptions') IS NULL THEN
    RAISE EXCEPTION 'public.prescriptions does not exist';
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'prescriptions'
      AND column_name = 'contains_controlled_drug' AND udt_name <> 'bool'
  ) THEN
    RAISE EXCEPTION 'prescriptions.contains_controlled_drug exists but is not boolean';
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'prescriptions'
      AND column_name = 'controlled_drug_justification' AND udt_name <> 'text'
  ) THEN
    RAISE EXCEPTION 'prescriptions.controlled_drug_justification exists but is not text';
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'prescriptions'
      AND column_name = 'attested_at' AND udt_name <> 'timestamptz'
  ) THEN
    RAISE EXCEPTION 'prescriptions.attested_at exists but is not timestamptz';
  END IF;
END
$cols$;

ALTER TABLE public.prescriptions
  ADD COLUMN IF NOT EXISTS contains_controlled_drug BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE public.prescriptions
  ADD COLUMN IF NOT EXISTS controlled_drug_justification TEXT;

ALTER TABLE public.prescriptions
  ADD COLUMN IF NOT EXISTS attested_at TIMESTAMPTZ;

-- ADD COLUMN IF NOT EXISTS does not change a pre-existing nullable column.
UPDATE public.prescriptions
SET contains_controlled_drug = FALSE
WHERE contains_controlled_drug IS NULL;

ALTER TABLE public.prescriptions
  ALTER COLUMN contains_controlled_drug SET DEFAULT FALSE;

ALTER TABLE public.prescriptions
  ALTER COLUMN contains_controlled_drug SET NOT NULL;

-- Justification required whenever the CD flag is set. 20-char minimum
-- is a sanity floor — not "yes" or "ok", but a real clinical rationale.
-- The server action requires a longer minimum; this one is the last-ditch
-- DB safeguard.
ALTER TABLE public.prescriptions
  DROP CONSTRAINT IF EXISTS prescriptions_controlled_drug_justification_required;

ALTER TABLE public.prescriptions
  ADD CONSTRAINT prescriptions_controlled_drug_justification_required
  CHECK (
    contains_controlled_drug = FALSE
    OR (
      controlled_drug_justification IS NOT NULL
      AND length(trim(controlled_drug_justification)) >= 20
    )
  );

-- ===================== prescription_audit_log =====================
CREATE TABLE IF NOT EXISTS public.prescription_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  prescription_id UUID NOT NULL
    REFERENCES public.prescriptions(id) ON DELETE RESTRICT,
  event_type TEXT NOT NULL
    CHECK (event_type IN ('issued', 'updated', 'cancelled')),
  actor_profile_id UUID NOT NULL REFERENCES public.profiles(id),
  ip_address INET,
  user_agent TEXT,
  snapshot JSONB NOT NULL,
  attestations JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_prescription_audit_log_prescription
  ON public.prescription_audit_log (prescription_id, created_at);

CREATE INDEX IF NOT EXISTS idx_prescription_audit_log_actor
  ON public.prescription_audit_log (actor_profile_id, created_at);

-- Replace a non-RESTRICT foreign key on prescription_id. A fresh CREATE
-- above already adds RESTRICT, and this block leaves that constraint in
-- place. CASCADE (or SET NULL / SET DEFAULT) is dropped and re-added.
DO $fk$
DECLARE
  rec record;
  v_has_restrict boolean := false;
BEGIN
  FOR rec IN
    SELECT c.conname, c.confdeltype
    FROM pg_constraint c
    JOIN pg_class t ON t.oid = c.conrelid
    JOIN pg_namespace n ON n.oid = t.relnamespace
    JOIN pg_attribute a
      ON a.attrelid = t.oid
     AND a.attnum = ANY (c.conkey)
     AND NOT a.attisdropped
    WHERE n.nspname = 'public'
      AND t.relname = 'prescription_audit_log'
      AND c.contype = 'f'
      AND a.attname = 'prescription_id'
  LOOP
    IF rec.confdeltype = 'r' THEN
      v_has_restrict := true;
    ELSE
      EXECUTE format(
        'ALTER TABLE public.prescription_audit_log DROP CONSTRAINT %I',
        rec.conname
      );
    END IF;
  END LOOP;

  IF NOT v_has_restrict THEN
    ALTER TABLE public.prescription_audit_log
      ADD CONSTRAINT prescription_audit_log_prescription_id_fkey
      FOREIGN KEY (prescription_id)
      REFERENCES public.prescriptions(id)
      ON DELETE RESTRICT;
  END IF;
END
$fk$;

-- Immutability: block UPDATE and DELETE for every role including the
-- service role. The only way to alter the audit log is to drop and
-- recreate the table, which leaves a trail in pg_stat_statements and
-- requires an explicit migration review.
-- INVOKER on purpose: the body only raises, and trigger execution does
-- not need a definer. Do not mark this SECURITY DEFINER.
CREATE OR REPLACE FUNCTION public.prescription_audit_log_deny_mutation()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
BEGIN
  RAISE EXCEPTION
    'prescription_audit_log is append-only; % is not permitted', TG_OP;
END;
$$;

DROP TRIGGER IF EXISTS prescription_audit_log_block_update
  ON public.prescription_audit_log;
CREATE TRIGGER prescription_audit_log_block_update
  BEFORE UPDATE ON public.prescription_audit_log
  FOR EACH ROW
  EXECUTE FUNCTION public.prescription_audit_log_deny_mutation();

DROP TRIGGER IF EXISTS prescription_audit_log_block_delete
  ON public.prescription_audit_log;
CREATE TRIGGER prescription_audit_log_block_delete
  BEFORE DELETE ON public.prescription_audit_log
  FOR EACH ROW
  EXECUTE FUNCTION public.prescription_audit_log_deny_mutation();

-- RLS: authenticated doctors can read and insert audit rows only for
-- prescriptions they wrote. Ownership matches prescriptions policies:
-- prescriptions.doctor_id -> doctors.id, doctors.profile_id = auth.uid().
-- Patients cannot (the audit log is a doctor-facing governance artefact;
-- patient-facing history is the prescriptions row itself). No UPDATE or
-- DELETE policy.
-- service_role policies cover a role that does not bypass RLS. The
-- append-only trigger still rejects UPDATE and DELETE for that role.
-- Default privileges grant the table to anon and authenticated. Those
-- grants are replaced below: authenticated may SELECT and INSERT only.
ALTER TABLE public.prescription_audit_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS prescription_audit_log_doctor_select
  ON public.prescription_audit_log;
CREATE POLICY prescription_audit_log_doctor_select
  ON public.prescription_audit_log
  FOR SELECT TO authenticated
  USING (
    prescription_id IN (
      SELECT p.id
      FROM public.prescriptions p
      JOIN public.doctors d ON d.id = p.doctor_id
      WHERE d.profile_id = (SELECT auth.uid())
    )
  );

DROP POLICY IF EXISTS prescription_audit_log_doctor_insert
  ON public.prescription_audit_log;
CREATE POLICY prescription_audit_log_doctor_insert
  ON public.prescription_audit_log
  FOR INSERT TO authenticated
  WITH CHECK (
    actor_profile_id = (SELECT auth.uid())
    AND prescription_id IN (
      SELECT p.id
      FROM public.prescriptions p
      JOIN public.doctors d ON d.id = p.doctor_id
      WHERE d.profile_id = (SELECT auth.uid())
    )
  );

DROP POLICY IF EXISTS prescription_audit_log_service_select
  ON public.prescription_audit_log;
CREATE POLICY prescription_audit_log_service_select
  ON public.prescription_audit_log
  FOR SELECT TO service_role
  USING (true);

DROP POLICY IF EXISTS prescription_audit_log_service_insert
  ON public.prescription_audit_log;
CREATE POLICY prescription_audit_log_service_insert
  ON public.prescription_audit_log
  FOR INSERT TO service_role
  WITH CHECK (true);

REVOKE ALL ON TABLE public.prescription_audit_log FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT ON TABLE public.prescription_audit_log TO authenticated;
GRANT ALL ON TABLE public.prescription_audit_log TO service_role;
