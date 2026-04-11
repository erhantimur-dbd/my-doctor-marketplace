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

-- ===================== prescriptions: attestation columns =====================
ALTER TABLE public.prescriptions
  ADD COLUMN IF NOT EXISTS contains_controlled_drug BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE public.prescriptions
  ADD COLUMN IF NOT EXISTS controlled_drug_justification TEXT;

ALTER TABLE public.prescriptions
  ADD COLUMN IF NOT EXISTS attested_at TIMESTAMPTZ;

-- Justification required whenever the CD flag is set. 20-char minimum
-- is a sanity floor — not "yes" or "ok", but a real clinical rationale.
-- A longer minimum would be imposed by the server action; this one is the
-- last-ditch DB safeguard.
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
    REFERENCES public.prescriptions(id) ON DELETE CASCADE,
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

-- Immutability: block UPDATE and DELETE for every role including the
-- service role. The only way to alter the audit log is to drop and
-- recreate the table, which leaves a trail in pg_stat_statements and
-- requires an explicit migration review.
CREATE OR REPLACE FUNCTION public.prescription_audit_log_deny_mutation()
RETURNS TRIGGER
LANGUAGE plpgsql
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

-- RLS: authenticated doctors can read audit rows for prescriptions they
-- wrote. Patients cannot (the audit log is a doctor-facing governance
-- artefact; patient-facing history is the prescriptions row itself).
ALTER TABLE public.prescription_audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY prescription_audit_log_doctor_select
  ON public.prescription_audit_log
  FOR SELECT TO authenticated
  USING (
    prescription_id IN (
      SELECT p.id
      FROM public.prescriptions p
      JOIN public.doctors d ON d.id = p.doctor_id
      WHERE d.profile_id = auth.uid()
    )
  );

-- Inserts only allowed for the acting doctor (actor_profile_id must match
-- auth.uid()). Service-role bypasses RLS and handles cron-driven events.
CREATE POLICY prescription_audit_log_doctor_insert
  ON public.prescription_audit_log
  FOR INSERT TO authenticated
  WITH CHECK (actor_profile_id = auth.uid());
