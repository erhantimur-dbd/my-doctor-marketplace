-- Soft-launch P0: prevent doctors from self-elevating privileged columns.
-- Doctors can update their own row (RLS), but verification_status and
-- is_featured are admin-controlled. is_active is intentionally NOT locked
-- because doctors legitimately toggle it in settings.
-- Service role (auth.uid() IS NULL) and admins may still update these columns.

CREATE OR REPLACE FUNCTION public.prevent_doctor_privileged_column_update()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Service role / background jobs: no JWT → allow
  IF auth.uid() IS NULL THEN
    RETURN NEW;
  END IF;

  -- Platform admins may change privileged columns
  IF EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'admin'
  ) THEN
    RETURN NEW;
  END IF;

  -- Doctor updating their own row: reject privileged column changes
  IF auth.uid() = OLD.profile_id THEN
    IF NEW.verification_status IS DISTINCT FROM OLD.verification_status
       OR NEW.is_featured IS DISTINCT FROM OLD.is_featured THEN
      RAISE EXCEPTION
        'Cannot modify privileged doctor columns (verification_status, is_featured)';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_lock_doctor_privileged_columns ON public.doctors;
CREATE TRIGGER trg_lock_doctor_privileged_columns
  BEFORE UPDATE ON public.doctors
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_doctor_privileged_column_update();
