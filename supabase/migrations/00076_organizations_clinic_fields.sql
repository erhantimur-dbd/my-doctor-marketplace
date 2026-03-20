-- ============================================================
-- ORGANIZATIONS: Add SEO + Onboarding fields for Clinic tier
-- ============================================================

ALTER TABLE public.organizations
  ADD COLUMN IF NOT EXISTS description TEXT,
  ADD COLUMN IF NOT EXISTS cover_image_url TEXT,
  ADD COLUMN IF NOT EXISTS specialties TEXT[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS seo_title TEXT,
  ADD COLUMN IF NOT EXISTS seo_description TEXT,
  ADD COLUMN IF NOT EXISTS onboarding_completed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS onboarding_step INT NOT NULL DEFAULT 0,
  -- Role of the person who created the org (doctor | admin)
  -- Determines whether owner consumes a doctor seat
  ADD COLUMN IF NOT EXISTS owner_role TEXT NOT NULL DEFAULT 'doctor'
    CHECK (owner_role IN ('doctor', 'admin'));

-- ============================================================
-- FIX: increment_used_seats and decrement_used_seats
-- Admin/staff seats are FREE on Clinic tier — only doctor-role
-- members should consume a seat.
-- We add a p_member_role parameter. Callers pass the role so the
-- RPC can skip the increment when the member is not a doctor.
-- ============================================================

CREATE OR REPLACE FUNCTION public.increment_used_seats(org_id UUID, p_member_role TEXT DEFAULT 'doctor')
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Only count doctor seats
  IF p_member_role != 'doctor' THEN
    RETURN;
  END IF;

  UPDATE public.licenses
  SET used_seats = used_seats + 1,
      updated_at = NOW()
  WHERE organization_id = org_id
    AND status IN ('active', 'trialing', 'past_due')
  ORDER BY created_at DESC
  LIMIT 1;
END;
$$;

CREATE OR REPLACE FUNCTION public.decrement_used_seats(org_id UUID, p_member_role TEXT DEFAULT 'doctor')
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Only count doctor seats
  IF p_member_role != 'doctor' THEN
    RETURN;
  END IF;

  UPDATE public.licenses
  SET used_seats = GREATEST(used_seats - 1, 0),
      updated_at = NOW()
  WHERE organization_id = org_id
    AND status IN ('active', 'trialing', 'past_due')
  ORDER BY created_at DESC
  LIMIT 1;
END;
$$;

-- ============================================================
-- LICENSES: Add 'free' to the tier CHECK constraint
-- (was missing — 00050 added free tier but didn't update check)
-- ============================================================
ALTER TABLE public.licenses
  DROP CONSTRAINT IF EXISTS licenses_tier_check;

ALTER TABLE public.licenses
  ADD CONSTRAINT licenses_tier_check
    CHECK (tier IN ('free', 'starter', 'professional', 'clinic', 'enterprise'));
