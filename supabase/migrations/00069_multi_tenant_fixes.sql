-- ============================================================
-- Multi-tenant production readiness fixes:
-- 1. Create missing increment/decrement_used_seats RPCs
-- 2. Add organization_id to bookings + backfill from doctor
-- 3. Add org-scoped RLS on bookings for doctor-dashboard views
-- ============================================================

-- 1. SEAT COUNT RPCs
-- These are called by organization.ts acceptInvitation/removeMember
-- but were never created, causing runtime crashes.

CREATE OR REPLACE FUNCTION public.increment_used_seats(org_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.licenses
  SET used_seats = used_seats + 1,
      updated_at = NOW()
  WHERE organization_id = org_id
    AND status IN ('active', 'trialing', 'past_due')
  ORDER BY created_at DESC
  LIMIT 1;
END;
$$;

CREATE OR REPLACE FUNCTION public.decrement_used_seats(org_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.licenses
  SET used_seats = GREATEST(used_seats - 1, 0),
      updated_at = NOW()
  WHERE organization_id = org_id
    AND status IN ('active', 'trialing', 'past_due')
  ORDER BY created_at DESC
  LIMIT 1;
END;
$$;

-- 2. ADD organization_id TO BOOKINGS
-- This enables org-scoped data isolation for multi-tenant.

ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES public.organizations(id);

CREATE INDEX IF NOT EXISTS idx_bookings_org
  ON public.bookings(organization_id)
  WHERE organization_id IS NOT NULL;

-- Backfill existing bookings: set organization_id from the doctor's current org
UPDATE public.bookings b
SET organization_id = d.organization_id
FROM public.doctors d
WHERE b.doctor_id = d.id
  AND d.organization_id IS NOT NULL
  AND b.organization_id IS NULL;

-- 3. ORG-SCOPED BOOKING ACCESS
-- Doctors in an org can read bookings that belong to their org.
-- This supplements existing patient/doctor-level RLS.

-- Note: We do NOT drop existing booking policies — those handle
-- patient self-access and direct doctor access. We ADD a policy
-- for org members to see org bookings (e.g. org admin viewing all
-- bookings across the practice).

CREATE POLICY "Org members can read org bookings" ON public.bookings
  FOR SELECT USING (
    organization_id IS NOT NULL
    AND organization_id IN (SELECT public.get_user_org_ids())
  );
