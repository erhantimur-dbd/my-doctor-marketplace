-- Patient satisfaction surveys (NPS) — sent 24h after completed appointments
CREATE TABLE public.satisfaction_surveys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id UUID NOT NULL UNIQUE REFERENCES public.bookings(id) ON DELETE CASCADE,
  patient_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  doctor_id UUID NOT NULL REFERENCES public.doctors(id) ON DELETE CASCADE,
  token VARCHAR(64) NOT NULL UNIQUE,
  nps_score SMALLINT CHECK (nps_score >= 0 AND nps_score <= 10),
  would_recommend BOOLEAN,
  feedback_text TEXT,
  submitted_at TIMESTAMPTZ,
  sent_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.satisfaction_surveys ENABLE ROW LEVEL SECURITY;

-- Patients can view their own surveys
CREATE POLICY "patients_view_own_surveys" ON public.satisfaction_surveys
  FOR SELECT USING (patient_id = auth.uid());

-- Admin full access
CREATE POLICY "admin_manage_surveys" ON public.satisfaction_surveys
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );

CREATE INDEX idx_surveys_booking ON public.satisfaction_surveys(booking_id);
CREATE INDEX idx_surveys_doctor ON public.satisfaction_surveys(doctor_id);
CREATE INDEX idx_surveys_token ON public.satisfaction_surveys(token);
CREATE INDEX idx_surveys_pending ON public.satisfaction_surveys(submitted_at)
  WHERE submitted_at IS NULL;
