-- ─── Custom test name support ────────────────────────────────────
-- Allow doctors to add custom tests with a friendly name
DO $$ BEGIN
  ALTER TABLE doctor_price_book ADD COLUMN custom_name TEXT;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

-- ─── Doctor Testing Locations ────────────────────────────────────
-- Doctors/clinics offering testing can have multiple service locations.
-- Each location appears as a unique searchable entry.
CREATE TABLE IF NOT EXISTS doctor_testing_locations (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  doctor_id    UUID NOT NULL REFERENCES doctors(id) ON DELETE CASCADE,
  name         TEXT NOT NULL,               -- e.g. "Main Clinic", "City Centre Lab"
  address      TEXT NOT NULL,
  city         TEXT NOT NULL,
  country_code TEXT NOT NULL DEFAULT 'GB',
  postal_code  TEXT,
  latitude     DECIMAL(10, 8),
  longitude    DECIMAL(11, 8),
  phone        TEXT,
  is_active    BOOLEAN NOT NULL DEFAULT TRUE,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_testing_locations_doctor ON doctor_testing_locations(doctor_id);
CREATE INDEX IF NOT EXISTS idx_testing_locations_city ON doctor_testing_locations(city);
CREATE INDEX IF NOT EXISTS idx_testing_locations_active ON doctor_testing_locations(doctor_id) WHERE is_active = TRUE;

ALTER TABLE doctor_testing_locations ENABLE ROW LEVEL SECURITY;

-- Doctors manage their own testing locations
DO $$ BEGIN
  CREATE POLICY "doctor_manage_own_testing_locations"
    ON doctor_testing_locations
    FOR ALL
    USING (
      doctor_id IN (
        SELECT id FROM doctors WHERE profile_id = auth.uid()
      )
    );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Public read for search
DO $$ BEGIN
  CREATE POLICY "public_read_active_testing_locations"
    ON doctor_testing_locations
    FOR SELECT
    USING (is_active = TRUE);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Auto-update updated_at
CREATE OR REPLACE TRIGGER update_testing_locations_updated_at
  BEFORE UPDATE ON doctor_testing_locations
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
