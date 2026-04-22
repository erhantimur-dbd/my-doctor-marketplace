-- Doctor self-declared skills.
-- Doctors pick procedural/clinical skills from a curated taxonomy
-- (src/lib/constants/skills.ts) that matches their specialties. Used for
-- search filtering and display on doctor cards.
--
-- Distinct from review_endorsements (00092): endorsements are patient-granted
-- and attached to a review. This table is the doctor's own declaration.

CREATE TABLE public.doctor_skills (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  doctor_id UUID NOT NULL REFERENCES public.doctors(id) ON DELETE CASCADE,
  skill_slug TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (doctor_id, skill_slug)
);

CREATE INDEX idx_doctor_skills_doctor
  ON public.doctor_skills(doctor_id);

CREATE INDEX idx_doctor_skills_slug
  ON public.doctor_skills(skill_slug);

ALTER TABLE public.doctor_skills ENABLE ROW LEVEL SECURITY;

-- Public read: skills are visible for any active, verified doctor.
CREATE POLICY "doctor_skills_select_public"
  ON public.doctor_skills
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.doctors d
      WHERE d.id = doctor_skills.doctor_id
        AND d.is_active = TRUE
        AND d.verification_status = 'verified'
    )
  );

-- Insert: only the doctor owner.
CREATE POLICY "doctor_skills_insert_owner"
  ON public.doctor_skills
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.doctors d
      WHERE d.id = doctor_skills.doctor_id
        AND d.profile_id = auth.uid()
    )
  );

-- Delete: only the doctor owner.
CREATE POLICY "doctor_skills_delete_owner"
  ON public.doctor_skills
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.doctors d
      WHERE d.id = doctor_skills.doctor_id
        AND d.profile_id = auth.uid()
    )
  );
