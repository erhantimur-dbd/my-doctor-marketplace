-- Drop public.public_organizations.
--
-- 00128 created this security-definer view (security_invoker = false),
-- granted SELECT to anon and authenticated, and attached
-- trg_public_organizations_readonly to reject_public_organization_write().
-- After the app reads organizations with the service role, nothing selects
-- the view. Drop it instead of leaving a definer view that bypasses RLS.
--
-- Apply only after that code is live. This file does not change
-- public.organizations or any policy.
--
-- Safe to run twice. Drop the trigger while the view still exists, then
-- the view (which also removes the trigger), then the function. A missing
-- view skips the trigger drop so DROP TRIGGER does not fail on a missing
-- relation.

DO $drop_public_organizations_trigger$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_catalog.pg_class AS c
    JOIN pg_catalog.pg_namespace AS n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relname = 'public_organizations'
  ) THEN
    DROP TRIGGER IF EXISTS trg_public_organizations_readonly
      ON public.public_organizations;
  END IF;
END
$drop_public_organizations_trigger$;

DROP VIEW IF EXISTS public.public_organizations;

DROP FUNCTION IF EXISTS public.reject_public_organization_write();
