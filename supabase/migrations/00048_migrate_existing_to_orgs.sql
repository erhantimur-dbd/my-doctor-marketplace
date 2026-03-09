-- ============================================================
-- DATA MIGRATION: Auto-create orgs for existing doctors
-- ============================================================

-- Step 1: Create an organization for each existing doctor
INSERT INTO public.organizations (id, name, slug, base_currency, email, created_at)
SELECT
  gen_random_uuid(),
  COALESCE(
    d.clinic_name,
    'Dr. ' || p.first_name || ' ' || p.last_name || ' Practice'
  ),
  d.slug || '-org',
  d.base_currency,
  p.email,
  d.created_at
FROM public.doctors d
JOIN public.profiles p ON p.id = d.profile_id;

-- Step 2: Link doctors to their new organizations
UPDATE public.doctors d
SET organization_id = o.id
FROM public.organizations o
WHERE o.slug = d.slug || '-org';

-- Step 3: Create owner membership records
INSERT INTO public.organization_members (organization_id, user_id, role, status, accepted_at, created_at)
SELECT
  d.organization_id,
  d.profile_id,
  'owner',
  'active',
  NOW(),
  d.created_at
FROM public.doctors d
WHERE d.organization_id IS NOT NULL;

-- Step 4: Migrate doctor_subscriptions to licenses
INSERT INTO public.licenses (
  organization_id,
  tier,
  status,
  max_seats,
  used_seats,
  stripe_subscription_id,
  stripe_customer_id,
  current_period_start,
  current_period_end,
  cancel_at_period_end,
  created_at
)
SELECT
  d.organization_id,
  CASE ds.plan_id
    WHEN 'professional' THEN 'starter'
    WHEN 'premium' THEN 'professional'
    WHEN 'clinic' THEN 'clinic'
    WHEN 'testing_standalone' THEN 'starter'
    ELSE 'starter'
  END,
  CASE ds.status
    WHEN 'active' THEN 'active'
    WHEN 'trialing' THEN 'trialing'
    WHEN 'past_due' THEN 'past_due'
    ELSE 'cancelled'
  END,
  CASE ds.plan_id
    WHEN 'clinic' THEN 5
    ELSE 1
  END,
  1,
  ds.stripe_subscription_id,
  ds.stripe_customer_id,
  ds.current_period_start,
  ds.current_period_end,
  ds.cancel_at_period_end,
  ds.created_at
FROM public.doctor_subscriptions ds
JOIN public.doctors d ON d.id = ds.doctor_id
WHERE d.organization_id IS NOT NULL;

-- Step 5: Migrate testing add-ons to license_modules
INSERT INTO public.license_modules (license_id, module_key, is_active, activated_at)
SELECT
  l.id,
  'medical_testing',
  TRUE,
  NOW()
FROM public.licenses l
JOIN public.organizations o ON o.id = l.organization_id
JOIN public.doctors d ON d.organization_id = o.id
WHERE d.has_testing_addon = TRUE;

-- NOTE: Do NOT drop doctor_subscriptions.
-- It remains for backward compatibility until Phase 5 cleanup.
