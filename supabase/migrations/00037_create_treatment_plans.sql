-- Treatment Plans: Post-appointment treatment plans created by doctors
-- Supports pay-in-full and pay-per-visit payment options

CREATE TABLE IF NOT EXISTS treatment_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  doctor_id UUID NOT NULL REFERENCES doctors(id) ON DELETE CASCADE,
  patient_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  booking_id UUID REFERENCES bookings(id) ON DELETE SET NULL,
  token TEXT UNIQUE NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  custom_notes TEXT,
  total_sessions INT NOT NULL CHECK (total_sessions BETWEEN 1 AND 20),
  sessions_completed INT NOT NULL DEFAULT 0,
  session_duration_minutes INT NOT NULL CHECK (session_duration_minutes IN (15, 30, 45, 60)),
  consultation_type TEXT NOT NULL CHECK (consultation_type IN ('in_person', 'video')),
  service_id UUID REFERENCES doctor_services(id) ON DELETE SET NULL,
  service_name TEXT NOT NULL,
  unit_price_cents INT NOT NULL CHECK (unit_price_cents >= 0),
  currency TEXT NOT NULL DEFAULT 'EUR',
  payment_type TEXT NOT NULL CHECK (payment_type IN ('pay_full', 'pay_per_visit')),
  discount_type TEXT CHECK (discount_type IN ('percentage', 'fixed_amount')),
  discount_value NUMERIC,
  discounted_total_cents INT,
  platform_fee_per_session_cents INT NOT NULL,
  total_platform_fee_cents INT NOT NULL,
  status TEXT NOT NULL DEFAULT 'sent' CHECK (status IN ('sent', 'accepted', 'in_progress', 'completed', 'cancelled', 'expired')),
  stripe_checkout_session_id TEXT,
  stripe_payment_intent_id TEXT,
  paid_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX idx_tp_token ON treatment_plans(token);
CREATE INDEX idx_tp_doctor ON treatment_plans(doctor_id);
CREATE INDEX idx_tp_patient ON treatment_plans(patient_id);
CREATE INDEX idx_tp_status_sent ON treatment_plans(status) WHERE status = 'sent';

-- Add treatment_plan_id to bookings for linking sessions
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS treatment_plan_id UUID REFERENCES treatment_plans(id) ON DELETE SET NULL;

-- RLS
ALTER TABLE treatment_plans ENABLE ROW LEVEL SECURITY;

-- Doctors can manage their own treatment plans
CREATE POLICY "Doctors manage own treatment plans" ON treatment_plans
  FOR ALL
  USING (doctor_id IN (SELECT id FROM doctors WHERE profile_id = auth.uid()))
  WITH CHECK (doctor_id IN (SELECT id FROM doctors WHERE profile_id = auth.uid()));

-- Patients can read their own treatment plans
CREATE POLICY "Patients read own treatment plans" ON treatment_plans
  FOR SELECT
  USING (patient_id = auth.uid());

-- Patients can update their own treatment plans (for accepting)
CREATE POLICY "Patients update own treatment plans" ON treatment_plans
  FOR UPDATE
  USING (patient_id = auth.uid())
  WITH CHECK (patient_id = auth.uid());

-- Anyone can read by token (for public invitation page)
CREATE POLICY "Anyone can read by token" ON treatment_plans
  FOR SELECT
  USING (true);

-- Service role bypass
CREATE POLICY "Service role full access" ON treatment_plans
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Updated_at trigger
CREATE OR REPLACE FUNCTION update_treatment_plans_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER treatment_plans_updated_at
  BEFORE UPDATE ON treatment_plans
  FOR EACH ROW
  EXECUTE FUNCTION update_treatment_plans_updated_at();
