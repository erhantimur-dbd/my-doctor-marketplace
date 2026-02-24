-- Allow public reading of profiles belonging to verified active doctors
-- (needed for doctor profile pages, doctor cards, search results)
CREATE POLICY "Anyone can read verified doctor profiles" ON public.profiles
  FOR SELECT USING (
    id IN (SELECT profile_id FROM public.doctors WHERE verification_status = 'verified' AND is_active = TRUE)
  );

-- Allow public reading of patient profiles that appear in visible reviews
-- (needed for displaying reviewer names on doctor profile pages)
CREATE POLICY "Anyone can read reviewer profiles" ON public.profiles
  FOR SELECT USING (
    id IN (SELECT patient_id FROM public.reviews WHERE is_visible = TRUE)
  );

