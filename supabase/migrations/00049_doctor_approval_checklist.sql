-- ============================================================================
-- Migration 00049: Doctor Approval Checklist
-- Structured checklist for admin verification of doctors/clinics
-- ============================================================================

CREATE TABLE public.doctor_approval_checklist (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  doctor_id       UUID NOT NULL REFERENCES public.doctors(id) ON DELETE CASCADE,
  reviewer_id     UUID NOT NULL REFERENCES public.profiles(id),
  gmc_verified    BOOLEAN NOT NULL DEFAULT FALSE,
  website_verified BOOLEAN NOT NULL DEFAULT FALSE,
  notes           TEXT,
  completed_at    TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(doctor_id)  -- one checklist per doctor
);

-- RLS: admin-only read/write
ALTER TABLE public.doctor_approval_checklist ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage approval checklists" ON public.doctor_approval_checklist
  FOR ALL USING (public.rls_is_admin());
