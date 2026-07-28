-- Ensure featured / seed doctors are searchable.
--
-- Search filters with get_licensed_doctor_ids() which only returns doctors
-- whose organization has an active/trialing/past_due license. UK seed doctors
-- (e.g. Dr. William Hughes, featured) often had orgs but no license after
-- 00066 removed the legacy doctor_subscriptions fallback — so they never
-- appeared in results even with is_featured = true.
--
-- Also set featured_until for active featured rows missing a window.

-- 1) Orgs for verified active doctors still missing organization_id
INSERT INTO public.organizations (id, name, slug, base_currency, email, created_at)
SELECT
  gen_random_uuid(),
  COALESCE(d.clinic_name, 'Dr. ' || p.first_name || ' ' || p.last_name || ' Practice'),
  d.slug || '-org',
  COALESCE(d.base_currency, 'GBP'),
  p.email,
  d.created_at
FROM public.doctors d
JOIN public.profiles p ON p.id = d.profile_id
WHERE d.organization_id IS NULL
  AND d.is_active = TRUE
  AND d.verification_status = 'verified'
  AND NOT EXISTS (SELECT 1 FROM public.organizations o WHERE o.slug = d.slug || '-org');

UPDATE public.doctors d
SET organization_id = o.id
FROM public.organizations o
WHERE o.slug = d.slug || '-org'
  AND d.organization_id IS NULL
  AND d.is_active = TRUE
  AND d.verification_status = 'verified';

-- 2) Owner memberships where missing
INSERT INTO public.organization_members (organization_id, user_id, role, status, accepted_at, created_at)
SELECT d.organization_id, d.profile_id, 'owner', 'active', NOW(), COALESCE(d.created_at, NOW())
FROM public.doctors d
WHERE d.organization_id IS NOT NULL
  AND d.profile_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM public.organization_members m
    WHERE m.organization_id = d.organization_id AND m.user_id = d.profile_id
  );

-- 3) Active starter license for any org that has a doctor but no searchable license
INSERT INTO public.licenses (
  organization_id,
  tier,
  status,
  max_seats,
  used_seats,
  stripe_subscription_id,
  current_period_start,
  current_period_end,
  created_at
)
SELECT DISTINCT
  d.organization_id,
  'starter',
  'active',
  1,
  1,
  'license_backfill_' || d.organization_id::text,
  NOW() - INTERVAL '1 day',
  NOW() + INTERVAL '1 year',
  NOW()
FROM public.doctors d
WHERE d.organization_id IS NOT NULL
  AND d.is_active = TRUE
  AND d.verification_status = 'verified'
  AND NOT EXISTS (
    SELECT 1 FROM public.licenses l
    WHERE l.organization_id = d.organization_id
      AND l.status IN ('active', 'trialing', 'past_due')
  );

-- 4) Featured boost window for rows flagged featured without expiry
UPDATE public.doctors
SET featured_until = NOW() + INTERVAL '30 days'
WHERE is_featured = TRUE
  AND featured_until IS NULL;
