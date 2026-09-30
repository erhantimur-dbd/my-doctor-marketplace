-- Soft-launch P0: prevent doctors from self-elevating privileged columns.
-- Doctors can update their own row (RLS), but verification_status and
-- is_featured are admin-controlled. is_active is intentionally NOT locked
-- because doctors legitimately toggle it in settings.
--
-- Prod never ran this file (00127 only revokes EXECUTE when the function
-- already exists, so that revoke was a no-op). The REVOKEs below have to
-- live in this file. CREATE OR REPLACE and DROP TRIGGER IF EXISTS make a
-- second apply a no-op.
--
-- Privileged columns: verification_status, is_featured.
--
-- Who may change them:
--   * service_role — JWT role claim service_role, or no auth.uid() (service
--     key without sub, SQL editor, migrations).
--   * platform admin — public.profiles.role = 'admin' for auth.uid().
--     Same predicate as public.rls_is_admin() and the profile check in
--     requireAdmin() / requireAdminPage(). ADMIN_EMAILS is app-only.
--   * the doctor who owns the row — blocked when either privileged column changes.
--
-- search_path is empty. auth.* and public.profiles are schema-qualified.

CREATE OR REPLACE FUNCTION public.prevent_doctor_privileged_column_update()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF (SELECT auth.role()) = 'service_role'
     OR (SELECT auth.uid()) IS NULL THEN
    RETURN NEW;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE id = (SELECT auth.uid())
      AND role = 'admin'
  ) THEN
    RETURN NEW;
  END IF;

  IF (SELECT auth.uid()) = OLD.profile_id THEN
    IF NEW.verification_status IS DISTINCT FROM OLD.verification_status
       OR NEW.is_featured IS DISTINCT FROM OLD.is_featured THEN
      RAISE EXCEPTION
        'Cannot modify privileged doctor columns (verification_status, is_featured)';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

-- Trigger functions do not consult EXECUTE when they fire. These revokes
-- stop a direct RPC call. 00127's guarded revoke does not see this function
-- on prod, because this migration runs after 00127 there.
REVOKE ALL ON FUNCTION public.prevent_doctor_privileged_column_update() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.prevent_doctor_privileged_column_update() FROM anon, authenticated, PUBLIC;
GRANT EXECUTE ON FUNCTION public.prevent_doctor_privileged_column_update() TO service_role;

DROP TRIGGER IF EXISTS trg_lock_doctor_privileged_columns ON public.doctors;
CREATE TRIGGER trg_lock_doctor_privileged_columns
  BEFORE UPDATE ON public.doctors
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_doctor_privileged_column_update();
