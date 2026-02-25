-- ============================================================================
-- Migration 00018: NUCLEAR RLS FIX — Drop and recreate ALL policies cleanly
-- ============================================================================
-- Previous incremental fixes (00015, 00016, 00017) left orphan / rogue
-- policies. This migration drops EVERY policy on every table and recreates
-- them from scratch using SECURITY DEFINER helpers so there are zero
-- circular references.
-- ============================================================================

-- ============================================================================
-- STEP 0: Drop ALL existing policies on ALL tables
-- ============================================================================

-- PROFILES
DO $$ BEGIN
  EXECUTE (
    SELECT string_agg('DROP POLICY IF EXISTS ' || quote_ident(policyname) || ' ON public.profiles;', E'\n')
    FROM pg_policies WHERE schemaname = 'public' AND tablename = 'profiles'
  );
END $$;

-- DOCTORS
DO $$ BEGIN
  EXECUTE (
    SELECT string_agg('DROP POLICY IF EXISTS ' || quote_ident(policyname) || ' ON public.doctors;', E'\n')
    FROM pg_policies WHERE schemaname = 'public' AND tablename = 'doctors'
  );
END $$;

-- DOCTOR_SPECIALTIES
DO $$ BEGIN
  EXECUTE (
    SELECT string_agg('DROP POLICY IF EXISTS ' || quote_ident(policyname) || ' ON public.doctor_specialties;', E'\n')
    FROM pg_policies WHERE schemaname = 'public' AND tablename = 'doctor_specialties'
  );
END $$;

-- DOCTOR_PHOTOS
DO $$ BEGIN
  EXECUTE (
    SELECT string_agg('DROP POLICY IF EXISTS ' || quote_ident(policyname) || ' ON public.doctor_photos;', E'\n')
    FROM pg_policies WHERE schemaname = 'public' AND tablename = 'doctor_photos'
  );
END $$;

-- DOCTOR_DOCUMENTS
DO $$ BEGIN
  EXECUTE (
    SELECT string_agg('DROP POLICY IF EXISTS ' || quote_ident(policyname) || ' ON public.doctor_documents;', E'\n')
    FROM pg_policies WHERE schemaname = 'public' AND tablename = 'doctor_documents'
  );
END $$;

-- SPECIALTIES
DO $$ BEGIN
  EXECUTE (
    SELECT string_agg('DROP POLICY IF EXISTS ' || quote_ident(policyname) || ' ON public.specialties;', E'\n')
    FROM pg_policies WHERE schemaname = 'public' AND tablename = 'specialties'
  );
END $$;

-- LOCATIONS
DO $$ BEGIN
  EXECUTE (
    SELECT string_agg('DROP POLICY IF EXISTS ' || quote_ident(policyname) || ' ON public.locations;', E'\n')
    FROM pg_policies WHERE schemaname = 'public' AND tablename = 'locations'
  );
END $$;

-- AVAILABILITY_SCHEDULES
DO $$ BEGIN
  EXECUTE (
    SELECT string_agg('DROP POLICY IF EXISTS ' || quote_ident(policyname) || ' ON public.availability_schedules;', E'\n')
    FROM pg_policies WHERE schemaname = 'public' AND tablename = 'availability_schedules'
  );
END $$;

-- AVAILABILITY_OVERRIDES
DO $$ BEGIN
  EXECUTE (
    SELECT string_agg('DROP POLICY IF EXISTS ' || quote_ident(policyname) || ' ON public.availability_overrides;', E'\n')
    FROM pg_policies WHERE schemaname = 'public' AND tablename = 'availability_overrides'
  );
END $$;

-- BOOKINGS
DO $$ BEGIN
  EXECUTE (
    SELECT string_agg('DROP POLICY IF EXISTS ' || quote_ident(policyname) || ' ON public.bookings;', E'\n')
    FROM pg_policies WHERE schemaname = 'public' AND tablename = 'bookings'
  );
END $$;

-- REVIEWS
DO $$ BEGIN
  EXECUTE (
    SELECT string_agg('DROP POLICY IF EXISTS ' || quote_ident(policyname) || ' ON public.reviews;', E'\n')
    FROM pg_policies WHERE schemaname = 'public' AND tablename = 'reviews'
  );
END $$;

-- DOCTOR_SUBSCRIPTIONS
DO $$ BEGIN
  EXECUTE (
    SELECT string_agg('DROP POLICY IF EXISTS ' || quote_ident(policyname) || ' ON public.doctor_subscriptions;', E'\n')
    FROM pg_policies WHERE schemaname = 'public' AND tablename = 'doctor_subscriptions'
  );
END $$;

-- PLATFORM_FEES
DO $$ BEGIN
  EXECUTE (
    SELECT string_agg('DROP POLICY IF EXISTS ' || quote_ident(policyname) || ' ON public.platform_fees;', E'\n')
    FROM pg_policies WHERE schemaname = 'public' AND tablename = 'platform_fees'
  );
END $$;

-- FAVORITES
DO $$ BEGIN
  EXECUTE (
    SELECT string_agg('DROP POLICY IF EXISTS ' || quote_ident(policyname) || ' ON public.favorites;', E'\n')
    FROM pg_policies WHERE schemaname = 'public' AND tablename = 'favorites'
  );
END $$;

-- NOTIFICATIONS
DO $$ BEGIN
  EXECUTE (
    SELECT string_agg('DROP POLICY IF EXISTS ' || quote_ident(policyname) || ' ON public.notifications;', E'\n')
    FROM pg_policies WHERE schemaname = 'public' AND tablename = 'notifications'
  );
END $$;

-- AUDIT_LOG
DO $$ BEGIN
  EXECUTE (
    SELECT string_agg('DROP POLICY IF EXISTS ' || quote_ident(policyname) || ' ON public.audit_log;', E'\n')
    FROM pg_policies WHERE schemaname = 'public' AND tablename = 'audit_log'
  );
END $$;

-- DOCTOR_CALENDAR_CONNECTIONS
DO $$ BEGIN
  EXECUTE (
    SELECT string_agg('DROP POLICY IF EXISTS ' || quote_ident(policyname) || ' ON public.doctor_calendar_connections;', E'\n')
    FROM pg_policies WHERE schemaname = 'public' AND tablename = 'doctor_calendar_connections'
  );
END $$;

-- DOCTOR_REMINDER_PREFERENCES
DO $$ BEGIN
  EXECUTE (
    SELECT string_agg('DROP POLICY IF EXISTS ' || quote_ident(policyname) || ' ON public.doctor_reminder_preferences;', E'\n')
    FROM pg_policies WHERE schemaname = 'public' AND tablename = 'doctor_reminder_preferences'
  );
END $$;

-- BOOKING_REMINDERS_SENT
DO $$ BEGIN
  EXECUTE (
    SELECT string_agg('DROP POLICY IF EXISTS ' || quote_ident(policyname) || ' ON public.booking_reminders_sent;', E'\n')
    FROM pg_policies WHERE schemaname = 'public' AND tablename = 'booking_reminders_sent'
  );
END $$;


-- ============================================================================
-- STEP 1: Create / replace SECURITY DEFINER helper functions
-- ============================================================================

-- Check if current user is admin (bypasses profiles RLS)
CREATE OR REPLACE FUNCTION public.rls_is_admin()
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

-- Check if a doctor_id belongs to the current user (bypasses doctors RLS)
CREATE OR REPLACE FUNCTION public.rls_is_own_doctor(p_doctor_id UUID)
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

-- Get the doctor.id for the current user (bypasses doctors RLS)
CREATE OR REPLACE FUNCTION public.rls_get_doctor_id()
RETURNS UUID
LANGUAGE sql SECURITY DEFINER STABLE
SET search_path = ''
AS $$
  SELECT id FROM public.doctors
  WHERE profile_id = auth.uid()
  LIMIT 1;
$$;

-- Check if a profile belongs to a verified doctor (bypasses doctors RLS)
CREATE OR REPLACE FUNCTION public.rls_is_verified_doctor_profile(p_profile_id UUID)
RETURNS BOOLEAN
LANGUAGE sql SECURITY DEFINER STABLE
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.doctors
    WHERE profile_id = p_profile_id
    AND verification_status = 'verified'
    AND is_active = TRUE
  );
$$;

-- Check if a profile belongs to a review author (bypasses reviews RLS)
CREATE OR REPLACE FUNCTION public.rls_is_review_patient(p_profile_id UUID)
RETURNS BOOLEAN
LANGUAGE sql SECURITY DEFINER STABLE
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.reviews
    WHERE patient_id = p_profile_id
    AND is_visible = TRUE
  );
$$;


-- ============================================================================
-- STEP 2: Recreate ALL policies using safe helpers
-- ============================================================================

-- ---- PROFILES ----
CREATE POLICY "Users can read own profile" ON public.profiles
  FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users can update own profile" ON public.profiles
  FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Admins can read all profiles" ON public.profiles
  FOR SELECT USING (public.rls_is_admin());
CREATE POLICY "Verified doctor profiles are public" ON public.profiles
  FOR SELECT USING (public.rls_is_verified_doctor_profile(id));
CREATE POLICY "Review patient profiles are public" ON public.profiles
  FOR SELECT USING (public.rls_is_review_patient(id));

-- ---- DOCTORS ----
CREATE POLICY "Anyone can read verified doctors" ON public.doctors
  FOR SELECT USING (verification_status = 'verified' AND is_active = TRUE);
CREATE POLICY "Doctors can read own record" ON public.doctors
  FOR SELECT USING (profile_id = auth.uid());
CREATE POLICY "Doctors can update own record" ON public.doctors
  FOR UPDATE USING (profile_id = auth.uid());
CREATE POLICY "Doctors can insert own record" ON public.doctors
  FOR INSERT WITH CHECK (profile_id = auth.uid());
CREATE POLICY "Admins can manage all doctors" ON public.doctors
  FOR ALL USING (public.rls_is_admin());

-- ---- DOCTOR_SPECIALTIES ----
CREATE POLICY "Anyone can read doctor specialties" ON public.doctor_specialties
  FOR SELECT USING (TRUE);
CREATE POLICY "Doctors can manage own specialties" ON public.doctor_specialties
  FOR ALL USING (public.rls_is_own_doctor(doctor_id));

-- ---- DOCTOR_PHOTOS ----
CREATE POLICY "Anyone can read doctor photos" ON public.doctor_photos
  FOR SELECT USING (TRUE);
CREATE POLICY "Doctors can manage own photos" ON public.doctor_photos
  FOR ALL USING (public.rls_is_own_doctor(doctor_id));

-- ---- DOCTOR_DOCUMENTS ----
CREATE POLICY "Doctors can manage own documents" ON public.doctor_documents
  FOR ALL USING (public.rls_is_own_doctor(doctor_id));
CREATE POLICY "Admins can read all documents" ON public.doctor_documents
  FOR SELECT USING (public.rls_is_admin());

-- ---- SPECIALTIES & LOCATIONS (public read) ----
CREATE POLICY "Anyone can read specialties" ON public.specialties
  FOR SELECT USING (TRUE);
CREATE POLICY "Anyone can read locations" ON public.locations
  FOR SELECT USING (TRUE);

-- ---- AVAILABILITY_SCHEDULES ----
CREATE POLICY "Anyone can read availability" ON public.availability_schedules
  FOR SELECT USING (TRUE);
CREATE POLICY "Doctors can manage own availability" ON public.availability_schedules
  FOR ALL USING (public.rls_is_own_doctor(doctor_id));

-- ---- AVAILABILITY_OVERRIDES ----
CREATE POLICY "Anyone can read overrides" ON public.availability_overrides
  FOR SELECT USING (TRUE);
CREATE POLICY "Doctors can manage own overrides" ON public.availability_overrides
  FOR ALL USING (public.rls_is_own_doctor(doctor_id));

-- ---- BOOKINGS ----
CREATE POLICY "Patients can read own bookings" ON public.bookings
  FOR SELECT USING (patient_id = auth.uid());
CREATE POLICY "Doctors can read their bookings" ON public.bookings
  FOR SELECT USING (doctor_id = public.rls_get_doctor_id());
CREATE POLICY "Patients can create bookings" ON public.bookings
  FOR INSERT WITH CHECK (patient_id = auth.uid());
CREATE POLICY "Admins can read all bookings" ON public.bookings
  FOR SELECT USING (public.rls_is_admin());

-- ---- REVIEWS ----
CREATE POLICY "Anyone can read visible reviews" ON public.reviews
  FOR SELECT USING (is_visible = TRUE);
CREATE POLICY "Patients can create reviews" ON public.reviews
  FOR INSERT WITH CHECK (patient_id = auth.uid());
CREATE POLICY "Doctors can respond to reviews" ON public.reviews
  FOR UPDATE USING (public.rls_is_own_doctor(doctor_id));
CREATE POLICY "Admins can manage reviews" ON public.reviews
  FOR ALL USING (public.rls_is_admin());

-- ---- DOCTOR_SUBSCRIPTIONS ----
CREATE POLICY "Doctors can read own subscription" ON public.doctor_subscriptions
  FOR SELECT USING (public.rls_is_own_doctor(doctor_id));

-- ---- PLATFORM_FEES ----
CREATE POLICY "Admins can read all fees" ON public.platform_fees
  FOR SELECT USING (public.rls_is_admin());

-- ---- FAVORITES ----
CREATE POLICY "Users manage own favorites" ON public.favorites
  FOR ALL USING (patient_id = auth.uid());

-- ---- NOTIFICATIONS ----
CREATE POLICY "Users read own notifications" ON public.notifications
  FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "Users update own notifications" ON public.notifications
  FOR UPDATE USING (user_id = auth.uid());

-- ---- AUDIT_LOG ----
CREATE POLICY "Admins can read audit log" ON public.audit_log
  FOR SELECT USING (public.rls_is_admin());

-- ---- DOCTOR_CALENDAR_CONNECTIONS ----
CREATE POLICY "Doctors can view own calendar connections" ON public.doctor_calendar_connections
  FOR SELECT USING (public.rls_is_own_doctor(doctor_id));
CREATE POLICY "Doctors can insert own calendar connections" ON public.doctor_calendar_connections
  FOR INSERT WITH CHECK (public.rls_is_own_doctor(doctor_id));
CREATE POLICY "Doctors can update own calendar connections" ON public.doctor_calendar_connections
  FOR UPDATE USING (public.rls_is_own_doctor(doctor_id));
CREATE POLICY "Doctors can delete own calendar connections" ON public.doctor_calendar_connections
  FOR DELETE USING (public.rls_is_own_doctor(doctor_id));
CREATE POLICY "Service role can manage all calendar connections" ON public.doctor_calendar_connections
  FOR ALL USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- ---- DOCTOR_REMINDER_PREFERENCES ----
CREATE POLICY "Doctors can view own reminder prefs" ON public.doctor_reminder_preferences
  FOR SELECT USING (public.rls_is_own_doctor(doctor_id));
CREATE POLICY "Doctors can insert own reminder prefs" ON public.doctor_reminder_preferences
  FOR INSERT WITH CHECK (public.rls_is_own_doctor(doctor_id));
CREATE POLICY "Doctors can update own reminder prefs" ON public.doctor_reminder_preferences
  FOR UPDATE USING (public.rls_is_own_doctor(doctor_id));
CREATE POLICY "Doctors can delete own reminder prefs" ON public.doctor_reminder_preferences
  FOR DELETE USING (public.rls_is_own_doctor(doctor_id));
CREATE POLICY "Service role full access to reminder prefs" ON public.doctor_reminder_preferences
  FOR ALL USING (auth.role() = 'service_role');

-- ---- BOOKING_REMINDERS_SENT ----
CREATE POLICY "Service role full access to reminders sent" ON public.booking_reminders_sent
  FOR ALL USING (auth.role() = 'service_role');


-- ============================================================================
-- STEP 3: Clean up old helper functions from previous migrations
-- ============================================================================
DROP FUNCTION IF EXISTS public.is_admin();
DROP FUNCTION IF EXISTS public.get_own_doctor_id();
DROP FUNCTION IF EXISTS public.is_own_doctor(UUID);
DROP FUNCTION IF EXISTS public.is_verified_doctor_profile(UUID);
DROP FUNCTION IF EXISTS public.is_review_patient(UUID);


-- ============================================================================
-- STEP 4: Reload PostgREST schema cache
-- ============================================================================
NOTIFY pgrst, 'reload schema';
