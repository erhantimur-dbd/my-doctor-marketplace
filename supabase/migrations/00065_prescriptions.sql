-- ============================================================
-- 00065 – Prescriptions
-- ============================================================

CREATE TABLE IF NOT EXISTS prescriptions (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  doctor_id     uuid NOT NULL REFERENCES doctors(id) ON DELETE CASCADE,
  patient_id    uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  booking_id    uuid REFERENCES bookings(id) ON DELETE SET NULL,

  -- Clinical data
  diagnosis     text,
  medications   jsonb NOT NULL DEFAULT '[]'::jsonb,
  -- Each medication: { name, dosage, frequency, duration, instructions }
  notes         text,

  -- Status
  status        text NOT NULL DEFAULT 'active'
                CHECK (status IN ('active', 'completed', 'cancelled')),

  -- Validity
  prescribed_at timestamptz NOT NULL DEFAULT now(),
  valid_until   date,

  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX idx_prescriptions_doctor   ON prescriptions(doctor_id);
CREATE INDEX idx_prescriptions_patient  ON prescriptions(patient_id);
CREATE INDEX idx_prescriptions_booking  ON prescriptions(booking_id);
CREATE INDEX idx_prescriptions_status   ON prescriptions(status);

-- RLS
ALTER TABLE prescriptions ENABLE ROW LEVEL SECURITY;

-- Doctors can see prescriptions they wrote
CREATE POLICY prescriptions_doctor_select ON prescriptions
  FOR SELECT TO authenticated
  USING (doctor_id IN (
    SELECT id FROM doctors WHERE user_id = auth.uid()
  ));

-- Doctors can insert prescriptions
CREATE POLICY prescriptions_doctor_insert ON prescriptions
  FOR INSERT TO authenticated
  WITH CHECK (doctor_id IN (
    SELECT id FROM doctors WHERE user_id = auth.uid()
  ));

-- Doctors can update their own prescriptions
CREATE POLICY prescriptions_doctor_update ON prescriptions
  FOR UPDATE TO authenticated
  USING (doctor_id IN (
    SELECT id FROM doctors WHERE user_id = auth.uid()
  ))
  WITH CHECK (doctor_id IN (
    SELECT id FROM doctors WHERE user_id = auth.uid()
  ));

-- Patients can view their own prescriptions
CREATE POLICY prescriptions_patient_select ON prescriptions
  FOR SELECT TO authenticated
  USING (patient_id = auth.uid());

-- Service-role bypass
CREATE POLICY prescriptions_service ON prescriptions
  FOR ALL TO service_role
  USING (true) WITH CHECK (true);
