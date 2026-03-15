-- Fix infinite recursion in organization_members RLS policies.
--
-- Problem: The SELECT policy on organization_members references itself
-- in a subquery, which causes PostgreSQL error 42P17 when any other
-- table's policy (e.g. licenses, organizations) also subqueries
-- organization_members. This broke license checks for non-admin users.
--
-- Solution: Create a SECURITY DEFINER helper function that reads
-- organization_members without RLS, then rewrite all affected policies
-- to call the helper instead of self-referencing subqueries.

-- 1. Create helper function (SECURITY DEFINER bypasses RLS)
CREATE OR REPLACE FUNCTION public.get_user_org_ids()
RETURNS SETOF uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT organization_id
  FROM public.organization_members
  WHERE user_id = auth.uid()
    AND status = 'active';
$$;

-- 2. Fix organization_members SELECT policy (was self-referencing)
DROP POLICY IF EXISTS "Members can read org members" ON public.organization_members;
CREATE POLICY "Members can read org members" ON public.organization_members
  FOR SELECT USING (
    organization_id IN (SELECT public.get_user_org_ids())
  );

-- 3. Fix organization_members INSERT policy
DROP POLICY IF EXISTS "Owners and admins can insert members" ON public.organization_members;
CREATE POLICY "Owners and admins can insert members" ON public.organization_members
  FOR INSERT WITH CHECK (
    organization_id IN (
      SELECT om.organization_id FROM public.organization_members om
      WHERE om.user_id = auth.uid() AND om.status = 'active' AND om.role IN ('owner', 'admin')
    )
  );

-- 4. Fix organization_members UPDATE policy
DROP POLICY IF EXISTS "Owners and admins can update members" ON public.organization_members;
CREATE POLICY "Owners and admins can update members" ON public.organization_members
  FOR UPDATE USING (
    organization_id IN (
      SELECT om.organization_id FROM public.organization_members om
      WHERE om.user_id = auth.uid() AND om.status = 'active' AND om.role IN ('owner', 'admin')
    )
  );

-- 5. Fix organization_members DELETE policy
DROP POLICY IF EXISTS "Owners can delete members" ON public.organization_members;
CREATE POLICY "Owners can delete members" ON public.organization_members
  FOR DELETE USING (
    organization_id IN (
      SELECT om.organization_id FROM public.organization_members om
      WHERE om.user_id = auth.uid() AND om.status = 'active' AND om.role = 'owner'
    )
  );

-- 6. Fix organizations SELECT policy (also references organization_members)
DROP POLICY IF EXISTS "Members can read own organization" ON public.organizations;
CREATE POLICY "Members can read own organization" ON public.organizations
  FOR SELECT USING (
    id IN (SELECT public.get_user_org_ids())
  );
-- Keep the public read policy as-is (uses USING(true))

-- 7. Fix organizations UPDATE policy
DROP POLICY IF EXISTS "Owners can update own organization" ON public.organizations;
CREATE POLICY "Owners can update own organization" ON public.organizations
  FOR UPDATE USING (
    id IN (
      SELECT om.organization_id FROM public.organization_members om
      WHERE om.user_id = auth.uid() AND om.status = 'active' AND om.role IN ('owner', 'admin')
    )
  );

-- 8. Fix licenses SELECT policy (the one that triggered the bug)
DROP POLICY IF EXISTS "Members can read org license" ON public.licenses;
CREATE POLICY "Members can read org license" ON public.licenses
  FOR SELECT USING (
    organization_id IN (SELECT public.get_user_org_ids())
  );

-- 9. Fix license_modules SELECT policy
DROP POLICY IF EXISTS "Members can read license modules" ON public.license_modules;
CREATE POLICY "Members can read license modules" ON public.license_modules
  FOR SELECT USING (
    license_id IN (
      SELECT id FROM public.licenses
      WHERE organization_id IN (SELECT public.get_user_org_ids())
    )
  );
