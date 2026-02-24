-- Fix circular RLS dependency between profiles ↔ doctors tables.
-- The profiles policies subquery doctors, and the doctors admin policy
-- subqueries profiles, causing "Database error querying schema".
-- Fix: use SECURITY DEFINER functions that bypass RLS for the subqueries.

-- Drop the problematic policies
DROP POLICY IF EXISTS "Anyone can read verified doctor profiles" ON public.profiles;
DROP POLICY IF EXISTS "Anyone can read reviewer profiles" ON public.profiles;

-- SECURITY DEFINER functions bypass RLS when called from within other policies
CREATE OR REPLACE FUNCTION public.is_verified_doctor_profile(profile_uuid UUID)
RETURNS BOOLEAN
LANGUAGE sql SECURITY DEFINER STABLE
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.doctors
    WHERE profile_id = profile_uuid
    AND verification_status = 'verified'
    AND is_active = TRUE
  );
$$;

CREATE OR REPLACE FUNCTION public.is_review_patient(profile_uuid UUID)
RETURNS BOOLEAN
LANGUAGE sql SECURITY DEFINER STABLE
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.reviews
    WHERE patient_id = profile_uuid
    AND is_visible = TRUE
  );
$$;

-- Re-create the policies using the functions (no circular reference)
CREATE POLICY "Anyone can read verified doctor profiles" ON public.profiles
  FOR SELECT USING (public.is_verified_doctor_profile(id));

CREATE POLICY "Anyone can read reviewer profiles" ON public.profiles
  FOR SELECT USING (public.is_review_patient(id));
