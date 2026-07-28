-- ============================================================
-- Doctify parity features (Wave A2/A4/A6 + B + C3)
-- A2 insurers · A6 gender · B3 location hours/facilities
-- B4 doctor FAQs · B5 review requests · C3 profile video approval
-- ============================================================

-- ── A2: Accepted private medical insurers ────────────────────
ALTER TABLE public.doctors
  ADD COLUMN IF NOT EXISTS accepted_insurers TEXT[] NOT NULL DEFAULT '{}';

CREATE INDEX IF NOT EXISTS idx_doctors_accepted_insurers
  ON public.doctors USING GIN (accepted_insurers);

COMMENT ON COLUMN public.doctors.accepted_insurers
  IS 'Private medical insurance providers this doctor accepts (e.g. bupa, aviva).';

-- ── A6: Gender (patient filter) ──────────────────────────────
ALTER TABLE public.doctors
  ADD COLUMN IF NOT EXISTS gender TEXT
    CHECK (gender IS NULL OR gender IN ('female', 'male', 'non_binary', 'prefer_not_to_say'));

CREATE INDEX IF NOT EXISTS idx_doctors_gender
  ON public.doctors (gender)
  WHERE gender IS NOT NULL AND gender <> 'prefer_not_to_say';

COMMENT ON COLUMN public.doctors.gender
  IS 'Optional gender for patient search filtering. prefer_not_to_say is never exposed publicly.';

-- ── C3: Profile intro video (public only when approved) ──────
ALTER TABLE public.doctors
  ADD COLUMN IF NOT EXISTS profile_video_path TEXT,
  ADD COLUMN IF NOT EXISTS profile_video_status TEXT
    CHECK (profile_video_status IS NULL OR profile_video_status IN ('pending', 'approved', 'rejected')),
  ADD COLUMN IF NOT EXISTS profile_video_uploaded_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS profile_video_reviewed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS profile_video_reviewed_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS profile_video_rejection_reason TEXT;

CREATE INDEX IF NOT EXISTS idx_doctors_profile_video_pending
  ON public.doctors (profile_video_uploaded_at DESC)
  WHERE profile_video_status = 'pending';

COMMENT ON COLUMN public.doctors.profile_video_status
  IS 'pending = awaiting MyDoctors360 approval; approved = public; rejected = not public.';

-- ── B3: Clinic location opening hours + facilities ───────────
ALTER TABLE public.clinic_locations
  ADD COLUMN IF NOT EXISTS opening_hours JSONB NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS facilities TEXT[] NOT NULL DEFAULT '{}';

COMMENT ON COLUMN public.clinic_locations.opening_hours
  IS 'Per-day hours: {"mon":{"open":"09:00","close":"17:00"},"tue":null,...}. null day = closed/enquire.';
COMMENT ON COLUMN public.clinic_locations.facilities
  IS 'Facility tags e.g. wheelchair_accessible, free_parking, disabled_parking, lift_access.';

-- ── B4: Doctor profile FAQs ──────────────────────────────────
CREATE TABLE IF NOT EXISTS public.doctor_faqs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  doctor_id UUID NOT NULL REFERENCES public.doctors(id) ON DELETE CASCADE,
  question TEXT NOT NULL,
  answer TEXT NOT NULL,
  display_order INT NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_doctor_faqs_doctor
  ON public.doctor_faqs (doctor_id, display_order)
  WHERE is_active = TRUE;

CREATE TRIGGER trg_doctor_faqs_updated_at
BEFORE UPDATE ON public.doctor_faqs
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

ALTER TABLE public.doctor_faqs ENABLE ROW LEVEL SECURITY;

-- Public can read active FAQs for active/verified doctors
CREATE POLICY "doctor_faqs_select_public"
  ON public.doctor_faqs
  FOR SELECT
  USING (
    is_active = TRUE
    AND EXISTS (
      SELECT 1 FROM public.doctors d
      WHERE d.id = doctor_faqs.doctor_id
        AND d.is_active = TRUE
        AND d.verification_status = 'verified'
    )
  );

-- Doctor can manage own FAQs
CREATE POLICY "doctor_faqs_select_own"
  ON public.doctor_faqs
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.doctors d
      WHERE d.id = doctor_faqs.doctor_id
        AND d.profile_id = auth.uid()
    )
  );

CREATE POLICY "doctor_faqs_insert_own"
  ON public.doctor_faqs
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.doctors d
      WHERE d.id = doctor_faqs.doctor_id
        AND d.profile_id = auth.uid()
    )
  );

CREATE POLICY "doctor_faqs_update_own"
  ON public.doctor_faqs
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.doctors d
      WHERE d.id = doctor_faqs.doctor_id
        AND d.profile_id = auth.uid()
    )
  );

CREATE POLICY "doctor_faqs_delete_own"
  ON public.doctor_faqs
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.doctors d
      WHERE d.id = doctor_faqs.doctor_id
        AND d.profile_id = auth.uid()
    )
  );

-- Admins can manage all FAQs
CREATE POLICY "doctor_faqs_admin_all"
  ON public.doctor_faqs
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role = 'admin'
    )
  );

-- ── B5: Automated review request tracking ────────────────────
CREATE TABLE IF NOT EXISTS public.review_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id UUID NOT NULL UNIQUE REFERENCES public.bookings(id) ON DELETE CASCADE,
  patient_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  doctor_id UUID NOT NULL REFERENCES public.doctors(id) ON DELETE CASCADE,
  token UUID NOT NULL UNIQUE DEFAULT gen_random_uuid(),
  sent_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_review_requests_sent
  ON public.review_requests (sent_at DESC);

ALTER TABLE public.review_requests ENABLE ROW LEVEL SECURITY;

-- Patients can read their own review request tokens
CREATE POLICY "review_requests_select_own"
  ON public.review_requests
  FOR SELECT
  USING (patient_id = auth.uid());

-- Service role / admin inserts via createAdminClient (bypasses RLS)
CREATE POLICY "review_requests_admin_all"
  ON public.review_requests
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role = 'admin'
    )
  );
