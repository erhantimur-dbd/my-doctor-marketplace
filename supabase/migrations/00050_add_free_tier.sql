-- Add 'free' to the licenses.tier CHECK constraint
ALTER TABLE public.licenses
  DROP CONSTRAINT IF EXISTS licenses_tier_check;

ALTER TABLE public.licenses
  ADD CONSTRAINT licenses_tier_check
  CHECK (tier IN ('free', 'starter', 'professional', 'clinic', 'enterprise'));
