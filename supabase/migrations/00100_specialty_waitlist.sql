-- ── Specialty waitlist ─────────────────────────────────────────────
-- Notify patients when *any* doctor in a specialty opens new slots
-- (e.g. "notify me when a dermatologist has openings").
-- Complements per-doctor availability_alerts.

CREATE TABLE IF NOT EXISTS specialty_waitlist (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  specialty_slug TEXT NOT NULL,
  patient_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  guest_email TEXT,
  guest_name TEXT,
  country_code TEXT,
  consultation_type TEXT,
  status TEXT NOT NULL DEFAULT 'active',
  last_notified_at TIMESTAMPTZ,
  notify_count INT NOT NULL DEFAULT 0,
  unsubscribe_token UUID NOT NULL DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT specialty_waitlist_identity_check
    CHECK (patient_id IS NOT NULL OR guest_email IS NOT NULL)
);

-- One active row per logged-in patient + specialty
CREATE UNIQUE INDEX IF NOT EXISTS idx_specialty_waitlist_patient_slug
  ON specialty_waitlist (patient_id, specialty_slug)
  WHERE patient_id IS NOT NULL AND status = 'active';

-- One active row per guest email + specialty
CREATE UNIQUE INDEX IF NOT EXISTS idx_specialty_waitlist_guest_slug
  ON specialty_waitlist (lower(guest_email), specialty_slug)
  WHERE guest_email IS NOT NULL AND status = 'active';

CREATE INDEX IF NOT EXISTS idx_specialty_waitlist_slug_active
  ON specialty_waitlist (specialty_slug)
  WHERE status = 'active';

CREATE UNIQUE INDEX IF NOT EXISTS idx_specialty_waitlist_unsub_token
  ON specialty_waitlist (unsubscribe_token);

ALTER TABLE specialty_waitlist ENABLE ROW LEVEL SECURITY;

-- Patients can read/update their own rows
CREATE POLICY specialty_waitlist_select_own
  ON specialty_waitlist FOR SELECT
  TO authenticated
  USING (patient_id = auth.uid());

CREATE POLICY specialty_waitlist_update_own
  ON specialty_waitlist FOR UPDATE
  TO authenticated
  USING (patient_id = auth.uid());

-- Inserts/guest flows go through service-role server actions
CREATE POLICY specialty_waitlist_service_all
  ON specialty_waitlist FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

COMMENT ON TABLE specialty_waitlist IS
  'Specialty-level waitlist: notify when any doctor in the specialty opens slots.';
