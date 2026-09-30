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

REVOKE ALL ON FUNCTION public.get_follow_up_invitation_by_token(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_follow_up_invitation_by_token(text) TO anon, authenticated;

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

REVOKE ALL ON FUNCTION public.patient_transition_follow_up_invitation(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.patient_transition_follow_up_invitation(uuid, text) TO authenticated;

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

-- Branding columns exist on Production and were never committed.
-- ADD IF NOT EXISTS converges a repo-only database without touching
-- Production values. brand_custom_css stays on the table and off the view.
ALTER TABLE public.organizations
  ADD COLUMN IF NOT EXISTS brand_display_name TEXT,
  ADD COLUMN IF NOT EXISTS brand_primary_color TEXT DEFAULT '#0ea5e9',
  ADD COLUMN IF NOT EXISTS brand_secondary_color TEXT DEFAULT '#0f172a',
  ADD COLUMN IF NOT EXISTS brand_accent_color TEXT DEFAULT '#22c55e',
  ADD COLUMN IF NOT EXISTS brand_favicon_url TEXT,
  ADD COLUMN IF NOT EXISTS brand_custom_css TEXT,
  ADD COLUMN IF NOT EXISTS brand_hide_platform_badge BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS brand_support_email TEXT,
  ADD COLUMN IF NOT EXISTS brand_support_phone TEXT;

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
CREATE OR REPLACE VIEW public.public_organizations
WITH (security_invoker = false) AS
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

ALTER VIEW public.public_organizations OWNER TO postgres;
ALTER VIEW public.public_organizations SET (security_invoker = false);

REVOKE ALL ON TABLE public.public_organizations FROM PUBLIC;
GRANT SELECT ON TABLE public.public_organizations TO anon, authenticated;
