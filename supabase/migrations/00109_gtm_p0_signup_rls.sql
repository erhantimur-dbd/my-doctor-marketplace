-- GTM P0: signup metadata cannot create admin profiles.
-- Public token pages use the service role; drop world-readable SELECT.

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  INSERT INTO public.profiles (id, role, first_name, last_name, email, avatar_url)
  VALUES (
    NEW.id,
    CASE
      WHEN NEW.raw_user_meta_data->>'role' = 'doctor' THEN 'doctor'
      ELSE 'patient'
    END,
    COALESCE(NEW.raw_user_meta_data->>'first_name', ''),
    COALESCE(NEW.raw_user_meta_data->>'last_name', ''),
    NEW.email,
    NEW.raw_user_meta_data->>'avatar_url'
  );
  RETURN NEW;
END;
$$;

DROP POLICY IF EXISTS "Anyone can read by token" ON public.treatment_plans;
DROP POLICY IF EXISTS "read_invitations" ON public.follow_up_invitations;
