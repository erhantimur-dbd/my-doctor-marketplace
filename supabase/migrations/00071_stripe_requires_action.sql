-- Track when a doctor's Stripe Connect account requires action
-- (e.g. identity verification, additional docs, restricted payouts)
ALTER TABLE public.doctors
  ADD COLUMN IF NOT EXISTS stripe_requires_action BOOLEAN DEFAULT FALSE;

-- Add to existing index for admin queries
CREATE INDEX IF NOT EXISTS idx_doctors_stripe_action
  ON public.doctors(stripe_requires_action)
  WHERE stripe_requires_action = true;
