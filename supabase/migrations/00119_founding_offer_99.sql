-- Founding offer (29 Sep 2026): £99/month for doctors 1–100.
-- Does not update or revoke licences already stored as tier = 'free'.

ALTER TABLE public.licenses
  DROP CONSTRAINT IF EXISTS licenses_tier_check;

ALTER TABLE public.licenses
  ADD CONSTRAINT licenses_tier_check
  CHECK (tier IN ('free', 'founding', 'starter', 'professional', 'clinic', 'enterprise'));

-- Set when the £99 licence is granted. Survives so a later cancel can forfeit.
ALTER TABLE public.doctors
  ADD COLUMN IF NOT EXISTS founding_offer_redeemed_at TIMESTAMPTZ;

-- Set when the founding subscription ends. Blocks another £99 checkout.
ALTER TABLE public.doctors
  ADD COLUMN IF NOT EXISTS founding_offer_forfeited_at TIMESTAMPTZ;

COMMENT ON COLUMN public.doctors.founding_offer_redeemed_at IS
  'When this doctor was granted the £99 founding plan. Null on grandfathered £0 licences.';

COMMENT ON COLUMN public.doctors.founding_offer_forfeited_at IS
  'When the doctor cancelled the £99 founding plan. They cannot subscribe at £99 again.';
