-- Patient account holders must be 18 or over (Legal).
--
-- profiles.adult_confirmed_at is stamped by the service role at patient
-- signup (email/password, OAuth terms acceptance, guest checkout). It is
-- nullable so existing rows and doctor accounts stay unset.
--
-- 00142, 00143, and 00145 are reserved by open draft PRs. 00144 is PR #113.
-- This file is 00146.
--
-- Column lock follows 00108_lock_doctor_privileged_columns.sql:
--   * SECURITY DEFINER, search_path '', schema-qualified auth.* calls
--   * EXECUTE revoked from PUBLIC, anon, and authenticated
--   * EXECUTE granted to service_role only
--
-- Locked set on public.profiles: adult_confirmed_at.
--
-- Who may change it:
--   * service_role — signup server actions use the service key.
--   * no JWT (auth.uid() and auth.role() empty) — migrations and SQL editor.
-- Authenticated and anon clients cannot write it, including the profile
-- owner and a platform admin using a user JWT. Table-level UPDATE grants
-- still let those roles edit other profile columns. A column-level REVOKE
-- does not override a table-level UPDATE grant (PostgreSQL unions them);
-- the trigger is the lock. The REVOKE records the column in the locked set
-- for any later column-privilege grant list.
--
-- RLS "Users can update own profile" / "Admins can update any profile"
-- still apply to the row. They do not grant this column.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS adult_confirmed_at TIMESTAMPTZ;

COMMENT ON COLUMN public.profiles.adult_confirmed_at IS
  'Set by the service role when a patient confirms they are 18 or over at account creation. Null means not confirmed (held for review). Clients cannot write this column.';

CREATE OR REPLACE FUNCTION public.prevent_profile_privileged_column_update()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF TG_OP = 'UPDATE'
     AND NEW.adult_confirmed_at IS NOT DISTINCT FROM OLD.adult_confirmed_at THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' AND NEW.adult_confirmed_at IS NULL THEN
    RETURN NEW;
  END IF;

  IF (SELECT auth.role()) = 'service_role' THEN
    RETURN NEW;
  END IF;

  -- Migrations and the SQL editor have no PostgREST JWT. Anon and
  -- authenticated JWTs often have a null sub; those must still be blocked.
  IF (SELECT auth.uid()) IS NULL
     AND coalesce((SELECT auth.role()), '') NOT IN ('anon', 'authenticated') THEN
    RETURN NEW;
  END IF;

  RAISE EXCEPTION
    'Cannot modify privileged profile columns (adult_confirmed_at)'
    USING ERRCODE = '42501';
END;
$$;

REVOKE ALL ON FUNCTION public.prevent_profile_privileged_column_update() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.prevent_profile_privileged_column_update() FROM anon, authenticated, PUBLIC;
GRANT EXECUTE ON FUNCTION public.prevent_profile_privileged_column_update() TO service_role;

DROP TRIGGER IF EXISTS trg_lock_profile_adult_confirmed ON public.profiles;
CREATE TRIGGER trg_lock_profile_adult_confirmed
  BEFORE INSERT OR UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_profile_privileged_column_update();

REVOKE UPDATE (adult_confirmed_at) ON TABLE public.profiles FROM PUBLIC, anon, authenticated;
GRANT UPDATE (adult_confirmed_at) ON TABLE public.profiles TO service_role;
