-- ============================================================================
-- Admin Security Hardening
-- ============================================================================

-- 1. Allow admins to INSERT into audit_log (they can already SELECT)
CREATE POLICY "Admins can insert audit log"
  ON public.audit_log
  FOR INSERT
  WITH CHECK (public.rls_is_admin());

-- 2. Prevent users from self-promoting to admin role
-- Drop the existing update policy and replace with one that blocks role changes
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
CREATE POLICY "Users can update own profile (no role change)"
  ON public.profiles
  FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (
    auth.uid() = id
    AND (
      -- If the role column is being changed, the new role must equal the old role
      -- This effectively prevents any user from changing their own role
      role = (SELECT p.role FROM public.profiles p WHERE p.id = auth.uid())
    )
  );

-- 3. Only admins can change roles
CREATE POLICY "Admins can update any profile"
  ON public.profiles
  FOR UPDATE
  USING (public.rls_is_admin());

NOTIFY pgrst, 'reload schema';
