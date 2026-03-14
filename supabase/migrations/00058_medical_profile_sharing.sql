-- Add sharing consent columns to medical_profiles
ALTER TABLE medical_profiles
  ADD COLUMN IF NOT EXISTS sharing_consent BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS consent_given_at TIMESTAMPTZ;

-- Allow doctors with a completed booking to READ patient medical profiles
-- only if the patient has given sharing consent
CREATE POLICY "doctors_read_consented_medical_profiles"
  ON medical_profiles
  FOR SELECT
  TO authenticated
  USING (
    sharing_consent = TRUE
    AND EXISTS (
      SELECT 1 FROM bookings b
      JOIN doctors d ON d.id = b.doctor_id
      WHERE b.patient_id = medical_profiles.patient_id
        AND d.profile_id = auth.uid()
        AND b.status = 'completed'
    )
  );
