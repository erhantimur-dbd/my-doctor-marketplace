-- Additive only. Apply before the code that reads public_organizations and
-- the invitation RPCs. Old policies stay in place, so the current app keeps
-- working. 00130 drops those policies after that code is live.
--
-- This file does not drop policies, indexes, or grants on existing tables.
-- Mina's 00127 is untouched. rls_is_own_doctor, rls_is_admin, and
-- get_user_org_ids are called and not replaced.
--
-- Safe inside BEGIN; ... ROLLBACK; : no CREATE INDEX CONCURRENTLY, no VACUUM.
--
-- Write paths checked against the code on main:
-- * createFollowUpInvitation inserts fee columns. The fee lock is BEFORE
--   UPDATE only, so that insert is unchanged.
-- * The Stripe webhook updates status, stripe ids, paid_at, and
--   sessions_booked through the service role. It does not change the fee
--   columns. service_role is allowed if it ever does.
-- * Doctor cancel and patient expiry / sessions_booked updates change
--   status or sessions_booked only. The fee lock lets those through.
-- * stripe_customer_id writes in auth and license use the service role.
--   Organization owner updates that leave stripe_customer_id, base_currency,
--   slug, and metadata unchanged pass. The existing updated_at trigger is
--   a different trigger and still runs.
--
-- Insert-time fees are computed in createFollowUpInvitation and written by
-- the service role once that code ships. This file does not recompute them.
-- Until 00130, the old doctor INSERT policy still exists. That gap is
-- accepted.

-- ─── token lookup (public invitation pages) ──────────────────

CREATE OR REPLACE FUNCTION public.get_follow_up_invitation_by_token(p_token text)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT pg_catalog.jsonb_build_object(
    'id', i.id,
    'status', i.status,
    'expires_at', i.expires_at,
    'consultation_type', i.consultation_type,
    'discount_type', i.discount_type,
    'discount_value', i.discount_value,
    'unit_price_cents', i.unit_price_cents,
    'total_sessions', i.total_sessions,
    'discounted_total_cents', i.discounted_total_cents,
    'service_name', i.service_name,
    'duration_minutes', i.duration_minutes,
    'platform_fee_cents', i.platform_fee_cents,
    'currency', i.currency,
    'doctor_note', i.doctor_note,
    'sessions_booked', i.sessions_booked,
    'doctor', pg_catalog.jsonb_build_object(
      'id', d.id,
      'title', d.title,
      'clinic_name', d.clinic_name,
      'profile', pg_catalog.jsonb_build_object(
        'first_name', pr.first_name,
        'last_name', pr.last_name,
        'avatar_url', pr.avatar_url
      ),
      'location', CASE
        WHEN loc.id IS NULL THEN NULL
        ELSE pg_catalog.jsonb_build_object('city', loc.city)
      END
    )
  )
  FROM public.follow_up_invitations AS i
  INNER JOIN public.doctors AS d ON d.id = i.doctor_id
  LEFT JOIN public.profiles AS pr ON pr.id = d.profile_id
  LEFT JOIN public.locations AS loc ON loc.id = d.location_id
  WHERE i.token = p_token
  LIMIT 1;
$$;

-- Default privileges grant anon and authenticated ALL on new public objects.
-- REVOKE FROM PUBLIC does not remove those role grants.
REVOKE ALL ON FUNCTION public.get_follow_up_invitation_by_token(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_follow_up_invitation_by_token(text) TO anon, authenticated, service_role;

-- ─── patient status transition ───────────────────────────────
-- Patients have no dedicated write in the final policy set. This function
-- is the only patient write: pending -> accepted or cancelled, for the
-- signed-in patient, and it changes status only.

CREATE OR REPLACE FUNCTION public.patient_transition_follow_up_invitation(
  p_invitation_id uuid,
  p_status text
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_updated uuid;
BEGIN
  IF p_status IS NULL OR p_status NOT IN ('accepted', 'cancelled') THEN
    RETURN false;
  END IF;

  IF auth.uid() IS NULL THEN
    RETURN false;
  END IF;

  UPDATE public.follow_up_invitations
  SET status = p_status
  WHERE id = p_invitation_id
    AND patient_id = auth.uid()
    AND status = 'pending'
  RETURNING id INTO v_updated;

  RETURN v_updated IS NOT NULL;
END;
$$;

REVOKE ALL ON FUNCTION public.patient_transition_follow_up_invitation(uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.patient_transition_follow_up_invitation(uuid, text) TO authenticated, service_role;

-- ─── fee lock ────────────────────────────────────────────────
-- One BEFORE UPDATE trigger freezes both platform_fee_cents and
-- discounted_total_cents. There is no INSERT trigger and no recompute.

CREATE OR REPLACE FUNCTION public.enforce_follow_up_invitation_fee_lock()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF NEW.platform_fee_cents IS NOT DISTINCT FROM OLD.platform_fee_cents
     AND NEW.discounted_total_cents IS NOT DISTINCT FROM OLD.discounted_total_cents
  THEN
    RETURN NEW;
  END IF;

  -- auth.role() stays the invoker even when a definer function issued the update.
  -- A migration running as postgres has no JWT and is allowed through.
  IF coalesce(auth.role(), '') = 'service_role' THEN
    RETURN NEW;
  END IF;

  IF auth.role() IS NULL AND current_user IN ('postgres', 'supabase_admin') THEN
    RETURN NEW;
  END IF;

  RAISE EXCEPTION 'platform_fee_cents and discounted_total_cents cannot be changed after creation'
    USING ERRCODE = '42501';
END;
$$;

-- EXECUTE on a trigger function is checked when the trigger is created, not
-- when it fires. postgres creates the trigger below. Anon and authenticated
-- get no grant.
REVOKE ALL ON FUNCTION public.enforce_follow_up_invitation_fee_lock() FROM PUBLIC, anon, authenticated;

DO $create_fee_trigger$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_catalog.pg_trigger
    WHERE tgname = 'trg_follow_up_invitation_fee_lock'
      AND tgrelid = 'public.follow_up_invitations'::pg_catalog.regclass
  ) THEN
    CREATE TRIGGER trg_follow_up_invitation_fee_lock
      BEFORE UPDATE ON public.follow_up_invitations
      FOR EACH ROW
      EXECUTE FUNCTION public.enforce_follow_up_invitation_fee_lock();
  END IF;
END
$create_fee_trigger$;

-- ─── organizations ───────────────────────────────────────────

-- The nine brand_* columns already exist on organizations. Adding them
-- again takes ACCESS EXCLUSIVE. This file does not add columns.

-- Owners cannot change billing identity columns. service_role (Stripe
-- customer writes) and platform admins still can. No JWT + postgres covers
-- later migrations.
CREATE OR REPLACE FUNCTION public.enforce_organization_protected_columns()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF NEW.stripe_customer_id IS NOT DISTINCT FROM OLD.stripe_customer_id
     AND NEW.base_currency IS NOT DISTINCT FROM OLD.base_currency
     AND NEW.slug IS NOT DISTINCT FROM OLD.slug
     AND NEW.metadata IS NOT DISTINCT FROM OLD.metadata
  THEN
    RETURN NEW;
  END IF;

  IF coalesce(auth.role(), '') = 'service_role' OR public.rls_is_admin() THEN
    RETURN NEW;
  END IF;

  IF auth.role() IS NULL AND current_user IN ('postgres', 'supabase_admin') THEN
    RETURN NEW;
  END IF;

  RAISE EXCEPTION 'stripe_customer_id, base_currency, slug and metadata cannot be changed by organization owners'
    USING ERRCODE = '42501';
END;
$$;

REVOKE ALL ON FUNCTION public.enforce_organization_protected_columns() FROM PUBLIC, anon, authenticated;

DO $create_org_trigger$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_catalog.pg_trigger
    WHERE tgname = 'trg_organization_protected_columns'
      AND tgrelid = 'public.organizations'::pg_catalog.regclass
  ) THEN
    CREATE TRIGGER trg_organization_protected_columns
      BEFORE UPDATE ON public.organizations
      FOR EACH ROW
      EXECUTE FUNCTION public.enforce_organization_protected_columns();
  END IF;
END
$create_org_trigger$;

-- Public pages. security_invoker = false and owner postgres: the view does
-- not depend on RLS on public.organizations, so it keeps working after
-- 00130 removes the open SELECT policy.
-- brand_custom_css is omitted. No public page reads it, and raw CSS from
-- anon is an injection footgun. brand_support_email and brand_support_phone
-- are omitted for the same reason as email and phone: no public page reads
-- them, and they are contact details.
-- Included branding: logo_url, cover_image_url, description, website,
-- specialties, seo_title, seo_description, and the visual brand_* fields.
-- security_barrier does not stop an auto-updatable view. The INSTEAD OF
-- trigger below rejects INSERT, UPDATE and DELETE even if a later grant
-- adds write privileges. Default privileges grant anon and authenticated
-- ALL on a new relation; REVOKE FROM PUBLIC leaves those role grants.
CREATE OR REPLACE VIEW public.public_organizations
WITH (security_invoker = false, security_barrier = true) AS
SELECT
  id,
  name,
  slug,
  logo_url,
  cover_image_url,
  description,
  website,
  specialties,
  seo_title,
  seo_description,
  brand_display_name,
  brand_primary_color,
  brand_secondary_color,
  brand_accent_color,
  brand_favicon_url,
  brand_hide_platform_badge
FROM public.organizations;

REVOKE ALL ON public.public_organizations FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.public_organizations TO anon, authenticated;

ALTER VIEW public.public_organizations OWNER TO postgres;
ALTER VIEW public.public_organizations SET (security_invoker = false, security_barrier = true);

CREATE OR REPLACE FUNCTION public.reject_public_organization_write()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  RAISE EXCEPTION 'public_organizations is read-only'
    USING ERRCODE = '42501';
END;
$$;

REVOKE ALL ON FUNCTION public.reject_public_organization_write() FROM PUBLIC, anon, authenticated;

DO $create_view_write_block$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_catalog.pg_trigger
    WHERE tgname = 'trg_public_organizations_readonly'
      AND tgrelid = 'public.public_organizations'::pg_catalog.regclass
  ) THEN
    CREATE TRIGGER trg_public_organizations_readonly
      INSTEAD OF INSERT OR UPDATE OR DELETE
      ON public.public_organizations
      FOR EACH ROW
      EXECUTE FUNCTION public.reject_public_organization_write();
  END IF;
END
$create_view_write_block$;

-- Final grants, not the statement text. Fails the migration if anon or
-- authenticated can write the view, or if a new function still has their
-- default privileges.
DO $assert_new_object_grants$
DECLARE
  v_bad text;
BEGIN
  SELECT pg_catalog.string_agg(
    pg_catalog.format('%s %s', COALESCE(r.rolname, 'public'), a.privilege_type),
    ', ' ORDER BY COALESCE(r.rolname, 'public'), a.privilege_type
  )
  INTO v_bad
  FROM pg_catalog.pg_class AS c
  JOIN pg_catalog.pg_namespace AS n ON n.oid = c.relnamespace
  CROSS JOIN LATERAL pg_catalog.aclexplode(c.relacl) AS a
  LEFT JOIN pg_catalog.pg_roles AS r ON r.oid = a.grantee
  WHERE n.nspname = 'public'
    AND c.relname = 'public_organizations'
    AND (
      a.grantee = 0
      OR r.rolname IN ('anon', 'authenticated')
    )
    AND NOT (
      r.rolname IN ('anon', 'authenticated')
      AND a.privilege_type = 'SELECT'
    );

  IF v_bad IS NOT NULL THEN
    RAISE EXCEPTION 'public_organizations must be SELECT-only for anon and authenticated, got %', v_bad
      USING ERRCODE = '42501';
  END IF;

  IF (
    SELECT c.relacl IS NULL
    FROM pg_catalog.pg_class AS c
    JOIN pg_catalog.pg_namespace AS n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relname = 'public_organizations'
  ) THEN
    RAISE EXCEPTION 'public_organizations has no explicit grants'
      USING ERRCODE = '42501';
  END IF;

  IF (
    SELECT count(*)
    FROM pg_catalog.pg_class AS c
    JOIN pg_catalog.pg_namespace AS n ON n.oid = c.relnamespace
    CROSS JOIN LATERAL pg_catalog.aclexplode(c.relacl) AS a
    JOIN pg_catalog.pg_roles AS r ON r.oid = a.grantee
    WHERE n.nspname = 'public'
      AND c.relname = 'public_organizations'
      AND r.rolname IN ('anon', 'authenticated')
      AND a.privilege_type = 'SELECT'
  ) <> 2 THEN
    RAISE EXCEPTION 'public_organizations is missing SELECT for anon or authenticated'
      USING ERRCODE = '42501';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM pg_catalog.pg_class AS c
    JOIN pg_catalog.pg_namespace AS n ON n.oid = c.relnamespace
    CROSS JOIN LATERAL pg_catalog.aclexplode(c.relacl) AS a
    LEFT JOIN pg_catalog.pg_roles AS r ON r.oid = a.grantee
    WHERE n.nspname = 'public'
      AND c.relname = 'public_organizations'
      AND COALESCE(r.rolname, 'public') IN ('anon', 'authenticated', 'public')
      AND a.privilege_type IN ('INSERT', 'UPDATE', 'DELETE')
  ) THEN
    RAISE EXCEPTION 'public_organizations still has INSERT, UPDATE or DELETE for anon or authenticated'
      USING ERRCODE = '42501';
  END IF;

  SELECT pg_catalog.string_agg(
    pg_catalog.format('%s %s %s', p.proname, COALESCE(r.rolname, 'public'), a.privilege_type),
    ', ' ORDER BY p.proname, COALESCE(r.rolname, 'public'), a.privilege_type
  )
  INTO v_bad
  FROM pg_catalog.pg_proc AS p
  JOIN pg_catalog.pg_namespace AS n ON n.oid = p.pronamespace
  CROSS JOIN LATERAL pg_catalog.aclexplode(p.proacl) AS a
  LEFT JOIN pg_catalog.pg_roles AS r ON r.oid = a.grantee
  WHERE n.nspname = 'public'
    AND p.proname IN (
      'get_follow_up_invitation_by_token',
      'patient_transition_follow_up_invitation',
      'enforce_follow_up_invitation_fee_lock',
      'enforce_organization_protected_columns',
      'reject_public_organization_write'
    )
    AND (
      a.grantee = 0
      OR (
        r.rolname IN ('anon', 'authenticated')
        AND NOT (
          a.privilege_type = 'EXECUTE'
          AND (
            (p.proname = 'get_follow_up_invitation_by_token' AND r.rolname IN ('anon', 'authenticated'))
            OR (p.proname = 'patient_transition_follow_up_invitation' AND r.rolname = 'authenticated')
          )
        )
      )
    );

  IF v_bad IS NOT NULL THEN
    RAISE EXCEPTION 'new function grants are wrong: %', v_bad
      USING ERRCODE = '42501';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM pg_catalog.pg_proc AS p
    JOIN pg_catalog.pg_namespace AS n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname IN (
        'get_follow_up_invitation_by_token',
        'patient_transition_follow_up_invitation',
        'enforce_follow_up_invitation_fee_lock',
        'enforce_organization_protected_columns',
        'reject_public_organization_write'
      )
      AND p.proacl IS NULL
  ) THEN
    RAISE EXCEPTION 'a new function still has a null ACL, so default privileges apply'
      USING ERRCODE = '42501';
  END IF;

  IF (
    SELECT count(*)
    FROM pg_catalog.pg_proc AS p
    JOIN pg_catalog.pg_namespace AS n ON n.oid = p.pronamespace
    CROSS JOIN LATERAL pg_catalog.aclexplode(p.proacl) AS a
    JOIN pg_catalog.pg_roles AS r ON r.oid = a.grantee
    WHERE n.nspname = 'public'
      AND a.privilege_type = 'EXECUTE'
      AND r.rolname = 'service_role'
      AND p.proname IN (
        'get_follow_up_invitation_by_token',
        'patient_transition_follow_up_invitation'
      )
  ) <> 2 THEN
    RAISE EXCEPTION 'token lookup and patient_transition must grant EXECUTE to service_role'
      USING ERRCODE = '42501';
  END IF;
END
$assert_new_object_grants$;
