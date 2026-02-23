-- Fix infinite recursion in profiles RLS policy
-- The "Admins can read all profiles" policy queries profiles within profiles, causing recursion

-- 1. Create a SECURITY DEFINER function to safely check admin role (bypasses RLS)
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE sql SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'
  );
$$;

-- 2. Drop the recursive admin policy
DROP POLICY IF EXISTS "Admins can read all profiles" ON public.profiles;

-- 3. Recreate it using the SECURITY DEFINER function (no recursion)
CREATE POLICY "Admins can read all profiles" ON public.profiles
  FOR SELECT USING (public.is_admin());

-- 4. Allow anyone to read profiles of verified doctors (for public search/doctor pages)
CREATE POLICY "Anyone can read doctor profiles" ON public.profiles
  FOR SELECT USING (
    id IN (SELECT profile_id FROM public.doctors WHERE verification_status = 'verified' AND is_active = TRUE)
  );

-- 5. Fix similar recursion in other admin policies that reference profiles
-- (bookings, doctors admin policies all use the same pattern)
DROP POLICY IF EXISTS "Admins can read all bookings" ON public.bookings;
CREATE POLICY "Admins can read all bookings" ON public.bookings
  FOR SELECT USING (public.is_admin());

DROP POLICY IF EXISTS "Admins can manage all doctors" ON public.doctors;
CREATE POLICY "Admins can manage all doctors" ON public.doctors
  FOR ALL USING (public.is_admin());

DROP POLICY IF EXISTS "Admins can read all documents" ON public.doctor_documents;
CREATE POLICY "Admins can read all documents" ON public.doctor_documents
  FOR SELECT USING (public.is_admin());

DROP POLICY IF EXISTS "Admins can manage reviews" ON public.reviews;
CREATE POLICY "Admins can manage reviews" ON public.reviews
  FOR ALL USING (public.is_admin());

DROP POLICY IF EXISTS "Admins can read all fees" ON public.platform_fees;
CREATE POLICY "Admins can read all fees" ON public.platform_fees
  FOR SELECT USING (public.is_admin());

DROP POLICY IF EXISTS "Admins can read audit log" ON public.audit_log;
CREATE POLICY "Admins can read audit log" ON public.audit_log
  FOR SELECT USING (public.is_admin());
