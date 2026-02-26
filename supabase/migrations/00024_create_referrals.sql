-- ============================================================================
-- Doctor Referral Program
-- ============================================================================

-- 1. Add referral_code column to doctors table
ALTER TABLE public.doctors ADD COLUMN IF NOT EXISTS referral_code TEXT UNIQUE;

-- Backfill existing doctors with unique 8-character codes
UPDATE public.doctors
SET referral_code = UPPER(SUBSTR(MD5(id::text), 1, 8))
WHERE referral_code IS NULL;

-- Make NOT NULL after backfill, with default for new doctors
ALTER TABLE public.doctors
  ALTER COLUMN referral_code SET NOT NULL,
  ALTER COLUMN referral_code SET DEFAULT UPPER(SUBSTR(MD5(gen_random_uuid()::text), 1, 8));

CREATE INDEX IF NOT EXISTS idx_doctors_referral_code ON public.doctors(referral_code);

-- 2. Create doctor_referrals table
CREATE TABLE public.doctor_referrals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- The doctor who made the referral
  referrer_doctor_id UUID NOT NULL REFERENCES public.doctors(id) ON DELETE CASCADE,

  -- Invitation details
  referred_email TEXT NOT NULL,
  referred_name TEXT,

  -- The referred doctor (populated when they sign up)
  referred_doctor_id UUID REFERENCES public.doctors(id) ON DELETE SET NULL,

  -- Status tracking: invited → signed_up → subscribed → rewarded
  status TEXT NOT NULL DEFAULT 'invited'
    CHECK (status IN ('invited', 'signed_up', 'subscribed', 'rewarded', 'expired')),

  -- Reward tracking
  referrer_rewarded BOOLEAN DEFAULT FALSE,
  referred_rewarded BOOLEAN DEFAULT FALSE,

  -- Timestamps
  invitation_sent_at TIMESTAMPTZ,
  signed_up_at TIMESTAMPTZ,
  subscribed_at TIMESTAMPTZ,
  rewarded_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '90 days'),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_referrals_referrer ON public.doctor_referrals(referrer_doctor_id);
CREATE INDEX idx_referrals_referred_email ON public.doctor_referrals(referred_email);
CREATE INDEX idx_referrals_referred_doctor ON public.doctor_referrals(referred_doctor_id);
CREATE INDEX idx_referrals_status ON public.doctor_referrals(status);

-- Only one active referral per email address
CREATE UNIQUE INDEX idx_referrals_unique_active
  ON public.doctor_referrals(referred_email)
  WHERE status IN ('invited', 'signed_up');

-- Updated_at trigger
CREATE TRIGGER trg_referrals_updated_at
  BEFORE UPDATE ON public.doctor_referrals
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- 3. RLS Policies
ALTER TABLE public.doctor_referrals ENABLE ROW LEVEL SECURITY;

-- Doctors can view their own referrals (as referrer)
CREATE POLICY "Doctors can view own referrals"
  ON public.doctor_referrals
  FOR SELECT
  USING (
    referrer_doctor_id IN (
      SELECT id FROM public.doctors WHERE profile_id = auth.uid()
    )
  );

-- Doctors can create referrals for themselves
CREATE POLICY "Doctors can create own referrals"
  ON public.doctor_referrals
  FOR INSERT
  WITH CHECK (
    referrer_doctor_id IN (
      SELECT id FROM public.doctors WHERE profile_id = auth.uid()
    )
  );

-- Admins can read all referrals
CREATE POLICY "Admins can read all referrals"
  ON public.doctor_referrals
  FOR SELECT
  USING (public.rls_is_admin());

-- Service role can manage all referrals (for webhooks & server actions using admin client)
CREATE POLICY "Service role can manage referrals"
  ON public.doctor_referrals
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

NOTIFY pgrst, 'reload schema';
