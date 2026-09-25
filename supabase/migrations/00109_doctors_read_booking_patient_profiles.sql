-- Doctor dashboard embeds
-- patient:profiles!bookings_patient_id_fkey(first_name, last_name, email)
-- from the browser session. Profiles SELECT policies (00018) allow only
-- the owner, admins, public verified-doctor profiles, and review authors.
-- The booking row is visible to the doctor; the embedded profile is not,
-- so PostgREST returns patient: null and the bookings page throws on
-- first_name.
--
-- Any doctor may read the profile of a patient who has a booking with
-- them. The helper is SECURITY DEFINER so the check does not re-enter
-- bookings or profiles RLS.

CREATE OR REPLACE FUNCTION public.rls_is_booking_patient_of_doctor(p_profile_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.bookings b
    INNER JOIN public.doctors d ON d.id = b.doctor_id
    WHERE b.patient_id = p_profile_id
      AND d.profile_id = auth.uid()
  );
$$;

GRANT EXECUTE ON FUNCTION public.rls_is_booking_patient_of_doctor(UUID)
  TO anon, authenticated, service_role;

DROP POLICY IF EXISTS "Doctors can read profiles of their booking patients"
  ON public.profiles;

CREATE POLICY "Doctors can read profiles of their booking patients"
  ON public.profiles
  FOR SELECT
  USING (public.rls_is_booking_patient_of_doctor(id));

NOTIFY pgrst, 'reload schema';
