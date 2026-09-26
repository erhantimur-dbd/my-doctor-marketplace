-- Prevent privilege escalation via auth.users raw_user_meta_data.role.
-- Previously COALESCE(meta->>'role','patient') accepted 'admin' from signup.

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  requested_role text;
  safe_role text;
BEGIN
  requested_role := lower(coalesce(NEW.raw_user_meta_data->>'role', 'patient'));
  -- Never allow admin via signup metadata. Doctor is allowed for email/password
  -- register-doctor; OAuth doctorIntent is gated separately in app code.
  IF requested_role = 'doctor' THEN
    safe_role := 'doctor';
  ELSE
    safe_role := 'patient';
  END IF;

  INSERT INTO public.profiles (id, role, first_name, last_name, email, avatar_url)
  VALUES (
    NEW.id,
    safe_role,
    COALESCE(NEW.raw_user_meta_data->>'first_name', ''),
    COALESCE(NEW.raw_user_meta_data->>'last_name', ''),
    NEW.email,
    NEW.raw_user_meta_data->>'avatar_url'
  );
  RETURN NEW;
END;
$$;
