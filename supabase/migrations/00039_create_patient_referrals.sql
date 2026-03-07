-- Patient referrals table
CREATE TABLE IF NOT EXISTS patient_referrals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  referrer_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  referral_code TEXT UNIQUE NOT NULL,
  referred_email TEXT,
  referred_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'signed_up', 'booked', 'credited')),
  credit_amount_cents INT NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'EUR',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- RLS
ALTER TABLE patient_referrals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Patients manage own referrals"
  ON patient_referrals FOR ALL
  USING (referrer_id = auth.uid())
  WITH CHECK (referrer_id = auth.uid());

CREATE POLICY "Service role full access to referrals"
  ON patient_referrals FOR ALL
  USING (auth.jwt() ->> 'role' = 'service_role');

-- Index
CREATE INDEX IF NOT EXISTS idx_patient_referrals_code ON patient_referrals(referral_code);
CREATE INDEX IF NOT EXISTS idx_patient_referrals_referrer ON patient_referrals(referrer_id);
