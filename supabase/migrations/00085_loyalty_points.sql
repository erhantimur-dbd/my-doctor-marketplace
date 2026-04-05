-- Loyalty Points System
-- Replaces cashback with points-based rewards.
-- Points are earned on completed bookings and redeemed for discounts.

-- Patient points balance
CREATE TABLE IF NOT EXISTS patient_points (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  patient_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  available_points integer NOT NULL DEFAULT 0,
  lifetime_points integer NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  CONSTRAINT patient_points_patient_id_key UNIQUE (patient_id),
  CONSTRAINT available_points_non_negative CHECK (available_points >= 0),
  CONSTRAINT lifetime_points_non_negative CHECK (lifetime_points >= 0)
);

-- Points transaction ledger (immutable)
CREATE TABLE IF NOT EXISTS points_transactions (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  patient_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type text NOT NULL CHECK (type IN ('earn', 'redeem')),
  points integer NOT NULL CHECK (points > 0),
  balance_after integer NOT NULL,
  source text NOT NULL, -- 'booking', 'referral', 'promotion', 'redemption'
  booking_id uuid REFERENCES bookings(id) ON DELETE SET NULL,
  description text,
  created_at timestamptz DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_patient_points_patient ON patient_points(patient_id);
CREATE INDEX IF NOT EXISTS idx_points_txn_patient ON points_transactions(patient_id);
CREATE INDEX IF NOT EXISTS idx_points_txn_created ON points_transactions(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_points_txn_booking ON points_transactions(booking_id);

-- RLS
ALTER TABLE patient_points ENABLE ROW LEVEL SECURITY;
ALTER TABLE points_transactions ENABLE ROW LEVEL SECURITY;

-- Patients can read own points
CREATE POLICY "Patients read own points"
  ON patient_points FOR SELECT
  USING (auth.uid() = patient_id);

-- Patients can read own transactions
CREATE POLICY "Patients read own points transactions"
  ON points_transactions FOR SELECT
  USING (auth.uid() = patient_id);

-- Service role full access (for webhook/admin operations)
CREATE POLICY "Service role manages points"
  ON patient_points FOR ALL
  USING (auth.role() = 'service_role');

CREATE POLICY "Service role manages points transactions"
  ON points_transactions FOR ALL
  USING (auth.role() = 'service_role');
