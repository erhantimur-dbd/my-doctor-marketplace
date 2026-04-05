-- Medical profiles for family dependents
-- Mirrors medical_profiles but keyed to dependent_id instead of patient_id
CREATE TABLE IF NOT EXISTS dependent_medical_profiles (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  dependent_id uuid NOT NULL REFERENCES dependents(id) ON DELETE CASCADE,
  blood_type text,
  allergies text[] DEFAULT '{}',
  chronic_conditions text[] DEFAULT '{}',
  current_medications text[] DEFAULT '{}',
  emergency_contact_name text,
  emergency_contact_phone text,
  notes text,
  sharing_consent boolean DEFAULT false,
  consent_given_at timestamptz,
  updated_at timestamptz DEFAULT now(),
  CONSTRAINT dependent_medical_profiles_dependent_id_key UNIQUE (dependent_id)
);

-- Index
CREATE INDEX IF NOT EXISTS idx_dep_med_profiles_dependent ON dependent_medical_profiles(dependent_id);

-- RLS
ALTER TABLE dependent_medical_profiles ENABLE ROW LEVEL SECURITY;

-- Parents can manage their dependents' medical profiles
CREATE POLICY "Parents manage dependent medical profiles"
  ON dependent_medical_profiles FOR ALL
  USING (
    dependent_id IN (
      SELECT id FROM dependents WHERE parent_id = auth.uid()
    )
  );

-- Service role full access
CREATE POLICY "Service role manages dependent medical profiles"
  ON dependent_medical_profiles FOR ALL
  USING (auth.role() = 'service_role');

-- Doctors can read if sharing_consent is true and they have a completed booking
CREATE POLICY "Doctors read consented dependent medical profiles"
  ON dependent_medical_profiles FOR SELECT
  USING (
    sharing_consent = true
    AND EXISTS (
      SELECT 1 FROM bookings b
      JOIN doctors d ON d.id = b.doctor_id
      WHERE b.dependent_id = dependent_medical_profiles.dependent_id
      AND d.profile_id = auth.uid()
      AND b.status IN ('confirmed', 'approved', 'completed')
    )
  );
