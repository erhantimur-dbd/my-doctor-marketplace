-- Guest availability waitlist: email-only interest capture (no account required)
-- + doctor portal visibility

-- Allow guest rows (nullable patient_id)
ALTER TABLE public.availability_alerts
  ALTER COLUMN patient_id DROP NOT NULL;

ALTER TABLE public.availability_alerts
  ADD COLUMN IF NOT EXISTS guest_email TEXT,
  ADD COLUMN IF NOT EXISTS guest_name TEXT,
  ADD COLUMN IF NOT EXISTS unsubscribe_token UUID DEFAULT gen_random_uuid(),
  ADD COLUMN IF NOT EXISTS source TEXT DEFAULT 'doctor_card',
  ADD COLUMN IF NOT EXISTS consultation_type TEXT,
  ADD COLUMN IF NOT EXISTS consented_at TIMESTAMPTZ;

-- Exactly one identity: logged-in patient OR guest email
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'availability_alerts_identity_chk'
  ) THEN
    ALTER TABLE public.availability_alerts
      ADD CONSTRAINT availability_alerts_identity_chk
      CHECK (
        (patient_id IS NOT NULL AND guest_email IS NULL)
        OR (patient_id IS NULL AND guest_email IS NOT NULL)
      );
  END IF;
END $$;

-- Guest uniqueness (case-insensitive)
CREATE UNIQUE INDEX IF NOT EXISTS idx_availability_alerts_guest_doctor
  ON public.availability_alerts (lower(guest_email), doctor_id)
  WHERE guest_email IS NOT NULL;

-- Unique token for unsubscribe links
CREATE UNIQUE INDEX IF NOT EXISTS idx_availability_alerts_unsub_token
  ON public.availability_alerts (unsubscribe_token)
  WHERE unsubscribe_token IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_availability_alerts_doctor_waiting
  ON public.availability_alerts (doctor_id, created_at DESC)
  WHERE notified_at IS NULL;

-- Doctors can view waitlist rows for their own profile
DROP POLICY IF EXISTS "doctors_view_own_waitlist" ON public.availability_alerts;
CREATE POLICY "doctors_view_own_waitlist"
  ON public.availability_alerts
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.doctors d
      WHERE d.id = availability_alerts.doctor_id
        AND d.profile_id = auth.uid()
    )
  );

-- Ensure unsubscribe_token on existing rows
UPDATE public.availability_alerts
SET unsubscribe_token = gen_random_uuid()
WHERE unsubscribe_token IS NULL;
