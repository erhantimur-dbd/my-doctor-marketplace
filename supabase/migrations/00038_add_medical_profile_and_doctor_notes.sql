-- Medical profiles table
CREATE TABLE IF NOT EXISTS medical_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  blood_type TEXT,
  allergies TEXT[] DEFAULT '{}',
  chronic_conditions TEXT[] DEFAULT '{}',
  current_medications TEXT[] DEFAULT '{}',
  emergency_contact_name TEXT,
  emergency_contact_phone TEXT,
  notes TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(patient_id)
);

-- RLS
ALTER TABLE medical_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Patients manage own medical profile"
  ON medical_profiles FOR ALL
  USING (patient_id = auth.uid())
  WITH CHECK (patient_id = auth.uid());

CREATE POLICY "Service role full access to medical profiles"
  ON medical_profiles FOR ALL
  USING (auth.jwt() ->> 'role' = 'service_role');

-- Add doctor_notes to bookings
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS doctor_notes TEXT;

-- Trigger for updated_at
CREATE OR REPLACE TRIGGER set_medical_profiles_updated_at
  BEFORE UPDATE ON medical_profiles
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();
