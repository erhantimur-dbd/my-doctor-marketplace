-- ============================================================================
-- Migration 00017: Fix ALL circular RLS dependencies
-- ============================================================================
-- Problem: Many policies across multiple tables create circular chains:
--   profiles → doctors (via is_verified_doctor_profile)  [FIXED in 00016]
--   doctors  → profiles (via admin policy)               [NOT FIXED]
--   doctor_specialties → doctors → profiles              [NOT FIXED]
--   doctor_photos → doctors → profiles                   [NOT FIXED]
--   doctor_documents → doctors → profiles                [NOT FIXED]
--   availability_schedules → doctors → profiles          [NOT FIXED]
--   availability_overrides → doctors → profiles          [NOT FIXED]
--   bookings → doctors → profiles                        [NOT FIXED]
--   reviews → doctors → profiles                         [NOT FIXED]
--   doctor_subscriptions → doctors → profiles            [NOT FIXED]
--   doctor_calendar_connections → doctors → profiles     [NOT FIXED]
--   doctor_reminder_preferences → doctors → profiles     [NOT FIXED]
--   platform_fees → profiles (admin)                     [NOT FIXED]
--   audit_log → profiles (admin)                         [NOT FIXED]
--
-- Fix: Create SECURITY DEFINER helper functions that bypass RLS,
-- then replace all problematic policies to use them.
-- ============================================================================

-- ============================================================================
-- 1. SECURITY DEFINER helper functions
-- ============================================================================

-- Check if current user is an admin
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE sql SECURITY DEFINER STABLE
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid()
    AND role = 'admin'
  );
$$;

-- Get the doctor row id for the currently authenticated user (NULL if not a doctor)
CREATE OR REPLACE FUNCTION public.get_own_doctor_id()
RETURNS UUID
LANGUAGE sql SECURITY DEFINER STABLE
SET search_path = ''
AS $$
  SELECT id FROM public.doctors
  WHERE profile_id = auth.uid()
  LIMIT 1;
$$;

-- Check if a given doctor_id belongs to the current user
CREATE OR REPLACE FUNCTION public.is_own_doctor(p_doctor_id UUID)
RETURNS BOOLEAN
LANGUAGE sql SECURITY DEFINER STABLE
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.doctors
    WHERE id = p_doctor_id
    AND profile_id = auth.uid()
  );
$$;

-- ============================================================================
-- 2. Fix PROFILES policies
-- ============================================================================

-- Drop the self-referential admin policy on profiles
DROP POLICY IF EXISTS "Admins can read all profiles" ON public.profiles;
CREATE POLICY "Admins can read all profiles" ON public.profiles
  FOR SELECT USING (public.is_admin());

-- ============================================================================
-- 3. Fix DOCTORS policies
-- ============================================================================

-- Drop and recreate the admin policy (was subquerying profiles)
DROP POLICY IF EXISTS "Admins can manage all doctors" ON public.doctors;
CREATE POLICY "Admins can manage all doctors" ON public.doctors
  FOR ALL USING (public.is_admin());

-- ============================================================================
-- 4. Fix DOCTOR_SPECIALTIES policies
-- ============================================================================

DROP POLICY IF EXISTS "Doctors can manage own specialties" ON public.doctor_specialties;
CREATE POLICY "Doctors can manage own specialties" ON public.doctor_specialties
  FOR ALL USING (public.is_own_doctor(doctor_id));

-- ============================================================================
-- 5. Fix DOCTOR_PHOTOS policies
-- ============================================================================

DROP POLICY IF EXISTS "Doctors can manage own photos" ON public.doctor_photos;
CREATE POLICY "Doctors can manage own photos" ON public.doctor_photos
  FOR ALL USING (public.is_own_doctor(doctor_id));

-- ============================================================================
-- 6. Fix DOCTOR_DOCUMENTS policies
-- ============================================================================

DROP POLICY IF EXISTS "Doctors can manage own documents" ON public.doctor_documents;
CREATE POLICY "Doctors can manage own documents" ON public.doctor_documents
  FOR ALL USING (public.is_own_doctor(doctor_id));

DROP POLICY IF EXISTS "Admins can read all documents" ON public.doctor_documents;
CREATE POLICY "Admins can read all documents" ON public.doctor_documents
  FOR SELECT USING (public.is_admin());

-- ============================================================================
-- 7. Fix AVAILABILITY_SCHEDULES policies
-- ============================================================================

DROP POLICY IF EXISTS "Doctors can manage own availability" ON public.availability_schedules;
CREATE POLICY "Doctors can manage own availability" ON public.availability_schedules
  FOR ALL USING (public.is_own_doctor(doctor_id));

-- ============================================================================
-- 8. Fix AVAILABILITY_OVERRIDES policies
-- ============================================================================

DROP POLICY IF EXISTS "Doctors can manage own overrides" ON public.availability_overrides;
CREATE POLICY "Doctors can manage own overrides" ON public.availability_overrides
  FOR ALL USING (public.is_own_doctor(doctor_id));

-- ============================================================================
-- 9. Fix BOOKINGS policies
-- ============================================================================

DROP POLICY IF EXISTS "Doctors can read their bookings" ON public.bookings;
CREATE POLICY "Doctors can read their bookings" ON public.bookings
  FOR SELECT USING (doctor_id = public.get_own_doctor_id());

DROP POLICY IF EXISTS "Admins can read all bookings" ON public.bookings;
CREATE POLICY "Admins can read all bookings" ON public.bookings
  FOR SELECT USING (public.is_admin());

-- ============================================================================
-- 10. Fix REVIEWS policies
-- ============================================================================

DROP POLICY IF EXISTS "Doctors can respond to reviews" ON public.reviews;
CREATE POLICY "Doctors can respond to reviews" ON public.reviews
  FOR UPDATE USING (public.is_own_doctor(doctor_id));

DROP POLICY IF EXISTS "Admins can manage reviews" ON public.reviews;
CREATE POLICY "Admins can manage reviews" ON public.reviews
  FOR ALL USING (public.is_admin());

-- ============================================================================
-- 11. Fix DOCTOR_SUBSCRIPTIONS policies
-- ============================================================================

DROP POLICY IF EXISTS "Doctors can read own subscription" ON public.doctor_subscriptions;
CREATE POLICY "Doctors can read own subscription" ON public.doctor_subscriptions
  FOR SELECT USING (public.is_own_doctor(doctor_id));

-- ============================================================================
-- 12. Fix PLATFORM_FEES policies
-- ============================================================================

DROP POLICY IF EXISTS "Admins can read all fees" ON public.platform_fees;
CREATE POLICY "Admins can read all fees" ON public.platform_fees
  FOR SELECT USING (public.is_admin());

-- ============================================================================
-- 13. Fix AUDIT_LOG policies
-- ============================================================================

DROP POLICY IF EXISTS "Admins can read audit log" ON public.audit_log;
CREATE POLICY "Admins can read audit log" ON public.audit_log
  FOR SELECT USING (public.is_admin());

-- ============================================================================
-- 14. Fix DOCTOR_CALENDAR_CONNECTIONS policies (from migration 00013)
-- ============================================================================

DROP POLICY IF EXISTS "Doctors can view own calendar connections" ON public.doctor_calendar_connections;
CREATE POLICY "Doctors can view own calendar connections" ON public.doctor_calendar_connections
  FOR SELECT USING (public.is_own_doctor(doctor_id));

DROP POLICY IF EXISTS "Doctors can insert own calendar connections" ON public.doctor_calendar_connections;
CREATE POLICY "Doctors can insert own calendar connections" ON public.doctor_calendar_connections
  FOR INSERT WITH CHECK (public.is_own_doctor(doctor_id));

DROP POLICY IF EXISTS "Doctors can update own calendar connections" ON public.doctor_calendar_connections;
CREATE POLICY "Doctors can update own calendar connections" ON public.doctor_calendar_connections
  FOR UPDATE USING (public.is_own_doctor(doctor_id));

DROP POLICY IF EXISTS "Doctors can delete own calendar connections" ON public.doctor_calendar_connections;
CREATE POLICY "Doctors can delete own calendar connections" ON public.doctor_calendar_connections
  FOR DELETE USING (public.is_own_doctor(doctor_id));

-- ============================================================================
-- 15. Fix DOCTOR_REMINDER_PREFERENCES policies (from migration 00014)
-- ============================================================================

DROP POLICY IF EXISTS "Doctors can view own reminder prefs" ON public.doctor_reminder_preferences;
CREATE POLICY "Doctors can view own reminder prefs" ON public.doctor_reminder_preferences
  FOR SELECT USING (public.is_own_doctor(doctor_id));

DROP POLICY IF EXISTS "Doctors can insert own reminder prefs" ON public.doctor_reminder_preferences;
CREATE POLICY "Doctors can insert own reminder prefs" ON public.doctor_reminder_preferences
  FOR INSERT WITH CHECK (public.is_own_doctor(doctor_id));

DROP POLICY IF EXISTS "Doctors can update own reminder prefs" ON public.doctor_reminder_preferences;
CREATE POLICY "Doctors can update own reminder prefs" ON public.doctor_reminder_preferences
  FOR UPDATE USING (public.is_own_doctor(doctor_id));

DROP POLICY IF EXISTS "Doctors can delete own reminder prefs" ON public.doctor_reminder_preferences;
CREATE POLICY "Doctors can delete own reminder prefs" ON public.doctor_reminder_preferences
  FOR DELETE USING (public.is_own_doctor(doctor_id));
