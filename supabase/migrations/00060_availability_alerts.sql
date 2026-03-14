-- ── Availability Alerts ────────────────────────────────────────────
-- Patients can subscribe to be notified when a doctor has new availability

CREATE TABLE availability_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  doctor_id UUID NOT NULL REFERENCES doctors(id) ON DELETE CASCADE,
  notified_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (patient_id, doctor_id)
);

ALTER TABLE availability_alerts ENABLE ROW LEVEL SECURITY;

-- Patients can view their own alerts
CREATE POLICY "patients_view_own_alerts"
  ON availability_alerts
  FOR SELECT
  TO authenticated
  USING (patient_id = auth.uid());

-- Patients can create their own alerts
CREATE POLICY "patients_create_own_alerts"
  ON availability_alerts
  FOR INSERT
  TO authenticated
  WITH CHECK (patient_id = auth.uid());

-- Patients can delete their own alerts
CREATE POLICY "patients_delete_own_alerts"
  ON availability_alerts
  FOR DELETE
  TO authenticated
  USING (patient_id = auth.uid());

-- Service role full access (for cron/notification jobs)
CREATE POLICY "service_role_manage_alerts"
  ON availability_alerts
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Also enable Supabase Realtime on direct_messages for Phase 4
ALTER PUBLICATION supabase_realtime ADD TABLE direct_messages;
