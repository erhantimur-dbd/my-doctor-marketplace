-- Restrictive. Apply only after the code that uses public_organizations,
-- get_follow_up_invitation_by_token, and the service-role invitation insert
-- is live. Until then the old policies stay, including doctor INSERT.
-- That gap is accepted.
--
-- Idempotent on a repo rebuild and on Production. Production never had
-- "read_invitations". It has the names from 20260308011124:
--   Participants read invitations
--   Service role manages invitations
--   doctor_manage_own_invitations (ALL, no WITH CHECK)
--   patient_update_own_invitations (UPDATE, no WITH CHECK)
-- DROP IF EXISTS covers those names and the repo-only names.
--
-- Final follow_up_invitations policies:
--   participant SELECT
--   doctor UPDATE (not INSERT, not ALL)
--   service_role ALL
-- There is no patient UPDATE. Patients change status only through
-- patient_transition_follow_up_invitation, added in 00128.
--
-- A doctor session has no INSERT policy, so a direct insert through the
-- user client is rejected. createFollowUpInvitation writes with the
-- service role. Safe inside BEGIN; ... ROLLBACK;.

-- ─── follow_up_invitations ───────────────────────────────────

DROP POLICY IF EXISTS "read_invitations" ON public.follow_up_invitations;
DROP POLICY IF EXISTS "Participants read invitations" ON public.follow_up_invitations;
DROP POLICY IF EXISTS "Service role manages invitations" ON public.follow_up_invitations;
DROP POLICY IF EXISTS "doctor_manage_own_invitations" ON public.follow_up_invitations;
DROP POLICY IF EXISTS "doctor_update_own_invitations" ON public.follow_up_invitations;
DROP POLICY IF EXISTS "patient_update_own_invitations" ON public.follow_up_invitations;
DROP POLICY IF EXISTS "patient_read_own_invitations" ON public.follow_up_invitations;
DROP POLICY IF EXISTS "doctor_read_own_invitations" ON public.follow_up_invitations;

CREATE POLICY "Participants read invitations" ON public.follow_up_invitations
  FOR SELECT
  USING (
    patient_id = (SELECT auth.uid())
    OR public.rls_is_own_doctor(doctor_id)
  );

CREATE POLICY "doctor_update_own_invitations" ON public.follow_up_invitations
  FOR UPDATE
  USING (public.rls_is_own_doctor(doctor_id))
  WITH CHECK (public.rls_is_own_doctor(doctor_id));

-- service_role also has BYPASSRLS. The policy documents the webhook path
-- and the service-role insert. WITH CHECK is required on writes.
CREATE POLICY "Service role manages invitations" ON public.follow_up_invitations
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- A doctor user-client INSERT must fail. The only INSERT path left is
-- service_role (FOR ALL). An INSERT policy, or FOR ALL for any other role,
-- would let the doctor session write its own fees.
DO $assert_no_user_insert$
DECLARE
  v_service oid := (SELECT oid FROM pg_catalog.pg_roles WHERE rolname = 'service_role');
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_catalog.pg_policy AS pol
    JOIN pg_catalog.pg_class AS cls ON cls.oid = pol.polrelid
    JOIN pg_catalog.pg_namespace AS nsp ON nsp.oid = cls.relnamespace
    WHERE nsp.nspname = 'public'
      AND cls.relname = 'follow_up_invitations'
      AND pol.polcmd IN ('a', '*')
      AND NOT (
        pol.polcmd = '*'
        AND pol.polroles = ARRAY[v_service]::oid[]
      )
  ) THEN
    RAISE EXCEPTION 'follow_up_invitations rejects a doctor user-client INSERT; only service_role may insert'
      USING ERRCODE = '42501';
  END IF;
END
$assert_no_user_insert$;

-- ─── organizations ───────────────────────────────────────────

DROP POLICY IF EXISTS "Public can read org basics" ON public.organizations;

DROP POLICY IF EXISTS "Members can read own organization" ON public.organizations;
CREATE POLICY "Members can read own organization" ON public.organizations
  FOR SELECT
  USING (id IN (SELECT public.get_user_org_ids()));

-- get_user_org_ids() ignores role, so the owner policy keeps its own
-- owner/admin predicate. WITH CHECK stops an owner moving the row to
-- another organization.
DROP POLICY IF EXISTS "Owners can update own organization" ON public.organizations;
CREATE POLICY "Owners can update own organization" ON public.organizations
  FOR UPDATE
  USING (
    id IN (
      SELECT om.organization_id
      FROM public.organization_members om
      WHERE om.user_id = (SELECT auth.uid())
        AND om.status = 'active'
        AND om.role IN ('owner', 'admin')
    )
  )
  WITH CHECK (
    id IN (
      SELECT om.organization_id
      FROM public.organization_members om
      WHERE om.user_id = (SELECT auth.uid())
        AND om.status = 'active'
        AND om.role IN ('owner', 'admin')
    )
  );

DROP POLICY IF EXISTS "Admins can manage all organizations" ON public.organizations;
CREATE POLICY "Admins can manage all organizations" ON public.organizations
  FOR ALL
  USING (public.rls_is_admin())
  WITH CHECK (public.rls_is_admin());

-- slug is already unique via organizations_slug_key.
DROP INDEX IF EXISTS public.idx_organizations_slug;
