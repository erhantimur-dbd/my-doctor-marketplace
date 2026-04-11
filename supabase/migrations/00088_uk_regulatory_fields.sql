-- UK regulatory fields for doctors
-- Part of Workstream 2 of the UK CQC compliance plan (plan file: hashed-twirling-tiger.md).
--
-- Strategy: these fields are ATTRIBUTE-gated, not domain-gated. A doctor
-- whose `practising_country = 'GB'` must complete the UK evidence flow
-- regardless of whether they registered on .com, .eu, or .co.uk. The
-- ADMIN APPROVAL CHECKLIST enforces that no UK-practising doctor can be
-- moved to `verification_status = 'verified'` until every UK-conditional
-- box is ticked (see 00088 checklist ALTERs below and src/actions/admin.ts).
--
-- None of the new columns are nullable-constrained with NOT NULL because
-- pre-existing rows (both UK and non-UK) would fail the migration. Instead
-- the server action + approval checklist are the enforcement points.

-- ===================== doctors: practising country =====================
-- ISO 3166-1 alpha-2 country code of the doctor's PRIMARY practising
-- jurisdiction, as distinct from the clinic address country (which may be
-- the same, but is a physical fact rather than a regulatory one).
ALTER TABLE public.doctors
  ADD COLUMN IF NOT EXISTS practising_country TEXT;

CREATE INDEX IF NOT EXISTS idx_doctors_practising_country
  ON public.doctors (practising_country)
  WHERE practising_country IS NOT NULL;

-- ===================== doctors: CQC (Care Quality Commission) =====================
-- cqc_status codes:
--   'registered'       — doctor is CQC-registered in their own right as a provider
--   'exempt_mpl'       — Medical Performers List exempt (NHS GP doing private work
--                        within the MPL exemption; still must evidence a designated
--                        body for revalidation)
--   'exempt_employed'  — employed by another CQC-registered provider who is
--                        "carrying on" the regulated activity; the employer's
--                        registration covers this doctor
--   'not_applicable'   — practice location is in Wales / Scotland / NI where
--                        CQC does not regulate; the relevant regulator is HIW,
--                        HIS, or RQIA respectively
--   'unknown'          — DEFAULT for backfill; the admin checklist treats this
--                        as unverified and blocks UK approval
ALTER TABLE public.doctors
  ADD COLUMN IF NOT EXISTS cqc_status TEXT
    CHECK (cqc_status IN (
      'registered',
      'exempt_mpl',
      'exempt_employed',
      'not_applicable',
      'unknown'
    ))
    DEFAULT 'unknown';

-- CQC provider ID from CQC Syndication API (e.g. '1-10716659568')
ALTER TABLE public.doctors
  ADD COLUMN IF NOT EXISTS cqc_provider_id TEXT;

-- CQC location ID — a provider may have multiple locations
ALTER TABLE public.doctors
  ADD COLUMN IF NOT EXISTS cqc_location_id TEXT;

-- When CQC status was last confirmed against the Syndication API
ALTER TABLE public.doctors
  ADD COLUMN IF NOT EXISTS cqc_verified_at TIMESTAMPTZ;

-- ===================== doctors: MPL (Medical Performers List) exemption =====================
-- Name of the designated body responsible for this doctor's revalidation
-- (typically an NHS trust, ICB, or a responsible officer via a faculty body)
ALTER TABLE public.doctors
  ADD COLUMN IF NOT EXISTS mpl_designated_body TEXT;

-- Timestamp the doctor signed the MPL exemption attestation at onboarding
ALTER TABLE public.doctors
  ADD COLUMN IF NOT EXISTS mpl_attestation_signed_at TIMESTAMPTZ;

-- Doctor's self-attestation that they do NOT provide any of the Schedule 2
-- paragraph 4 excluded procedures through the platform (anaesthesia/IV
-- sedation, childbirth services, termination, cosmetic surgery, haemodialysis,
-- endoscopy with lumen, hyperbaric therapy, IV/intrathecal/epidural
-- medicines, X-ray/MRI/proton therapy, invasive cardiac physiology).
-- Signed at onboarding; re-asserted on approval checklist review.
ALTER TABLE public.doctors
  ADD COLUMN IF NOT EXISTS excluded_procedures_attestation BOOLEAN NOT NULL DEFAULT FALSE;

-- ===================== doctors: indemnity insurance =====================
-- All regions benefit from indemnity evidence; the admin checklist only
-- blocks UK-practising doctors on this, but collecting it universally is
-- a good default.
ALTER TABLE public.doctors
  ADD COLUMN IF NOT EXISTS indemnity_insurer TEXT;

-- Cover in GBP pence/cents — integer so no rounding loss. Patients and
-- regulators expect cover in the doctor's local currency; stored in GBP for
-- comparability across the platform's UK rule-set.
ALTER TABLE public.doctors
  ADD COLUMN IF NOT EXISTS indemnity_cover_gbp INTEGER;

ALTER TABLE public.doctors
  ADD COLUMN IF NOT EXISTS indemnity_expiry DATE;

-- FK to the uploaded indemnity certificate (optional — nullable to allow
-- staged onboarding where the admin may upload the document out-of-band)
ALTER TABLE public.doctors
  ADD COLUMN IF NOT EXISTS indemnity_document_id UUID
    REFERENCES public.doctor_documents(id);

-- ===================== doctors: DBS check (UK only) =====================
-- Disclosure and Barring Service check — mandatory in UK for patient-facing
-- roles with children or vulnerable adults. We collect for every UK doctor
-- at onboarding and let the admin decide whether to require it at approval
-- time based on the doctor's self-declared patient population.
ALTER TABLE public.doctors
  ADD COLUMN IF NOT EXISTS dbs_check_date DATE;

ALTER TABLE public.doctors
  ADD COLUMN IF NOT EXISTS dbs_document_id UUID
    REFERENCES public.doctor_documents(id);

-- ===================== doctor_approval_checklist: UK-conditional columns =====================
-- The existing checklist (00049) has gmc_verified and website_verified. We
-- add UK-specific columns that only gate approval when the doctor's
-- practising_country = 'GB'. Admin UI shows/hides these conditionally.
--
-- The approval server action (src/actions/admin.ts::updateDoctorVerification)
-- blocks verified status until:
--   1. gmc_verified = TRUE (always)
--   2. IF practising_country = 'GB' THEN all UK columns below must be TRUE
ALTER TABLE public.doctor_approval_checklist
  ADD COLUMN IF NOT EXISTS cqc_status_evidenced BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE public.doctor_approval_checklist
  ADD COLUMN IF NOT EXISTS mpl_attestation_reviewed BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE public.doctor_approval_checklist
  ADD COLUMN IF NOT EXISTS excluded_procedures_attestation_confirmed BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE public.doctor_approval_checklist
  ADD COLUMN IF NOT EXISTS indemnity_document_verified BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE public.doctor_approval_checklist
  ADD COLUMN IF NOT EXISTS indemnity_in_date BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE public.doctor_approval_checklist
  ADD COLUMN IF NOT EXISTS dbs_check_verified BOOLEAN NOT NULL DEFAULT FALSE;

-- ===================== Indexes for cron + admin queries =====================
-- Cron: find UK doctors whose indemnity is lapsing in the next 30 days
CREATE INDEX IF NOT EXISTS idx_doctors_indemnity_expiry
  ON public.doctors (indemnity_expiry)
  WHERE indemnity_expiry IS NOT NULL;

-- Cron: find UK doctors whose CQC status hasn't been re-checked recently
CREATE INDEX IF NOT EXISTS idx_doctors_cqc_verified_at
  ON public.doctors (cqc_verified_at)
  WHERE practising_country = 'GB';

-- ===================== compliance_notifications_sent =====================
-- Dedup table for the /api/cron/verify-doctor-credentials cron. Each row
-- records a single notification the platform has sent to a doctor about a
-- regulatory matter (e.g. indemnity renewal chase). The cron checks for a
-- matching row before sending to avoid spamming the doctor on consecutive
-- runs.
--
-- notification_key is a free-form string chosen by the caller to namespace
-- the dedup. For indemnity chases it embeds the target expiry date so a
-- subsequent renewal + new expiry re-enables the chase cycle. Example:
--   "indemnity_chase:2026-05-01"
CREATE TABLE IF NOT EXISTS public.compliance_notifications_sent (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  doctor_id UUID NOT NULL REFERENCES public.doctors(id) ON DELETE CASCADE,
  notification_key TEXT NOT NULL,
  sent_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (doctor_id, notification_key)
);

CREATE INDEX IF NOT EXISTS idx_compliance_notifications_sent_doctor
  ON public.compliance_notifications_sent (doctor_id);

-- RLS: the cron runs with the service role which bypasses RLS, and there
-- is no patient/doctor-facing read path, so we enable RLS with no policies
-- to lock the table down for non-service-role access.
ALTER TABLE public.compliance_notifications_sent ENABLE ROW LEVEL SECURITY;

-- ===================== Notes =====================
-- Backfill posture:
--   * Existing doctors keep practising_country = NULL. They are treated as
--     "not yet UK-gated" by the admin checklist and the cron. A manual
--     migration of existing doctors to practising_country = 'GB' must be
--     done before they can be listed on the UK variant of the site.
--   * cqc_status defaults to 'unknown', which blocks UK approval until
--     an admin confirms a real value through the approval checklist.
--   * excluded_procedures_attestation defaults to FALSE. The wizard
--     requires an explicit tick before submission for UK doctors.
--
-- No RLS changes are needed: the existing doctors table RLS covers these
-- columns, and the new approval_checklist columns inherit from 00049.
