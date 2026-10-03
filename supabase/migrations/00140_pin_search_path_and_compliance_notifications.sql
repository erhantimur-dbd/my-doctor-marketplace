-- Pin search_path on the eight public functions the security advisor flags as
-- function_search_path_mutable, and close compliance_notifications_sent.
--
-- search_path is '' on every function below. pg_catalog is still searched
-- when the path is empty, so now(), generate_series(), extract(), and the
-- haversine math functions stay unqualified. Objects that are not in
-- pg_catalog are schema-qualified in the body (public.table, public.similarity).
-- pg_trgm is installed in public on this project, so public.similarity is the
-- same function search_medications already calls. None of these eight
-- functions is SECURITY DEFINER. This file does not GRANT or REVOKE EXECUTE.
--
-- The four functions whose bodies already only touch NEW/now() or already
-- qualify their tables are pinned with ALTER FUNCTION. The other four are
-- replaced with the same signature, volatility, and SQL, plus public. prefixes.
--
-- compliance_notifications_sent is the dedup table for the credentials cron
-- and the pending doctor-credit alert. Both paths use createAdminClient
-- (service role). RLS is already enabled and had no policy. Anon and
-- authenticated hold every table privilege, including TRUNCATE, which RLS
-- does not block. Deny those two roles with a restrictive policy, allow
-- service_role explicitly, and revoke their table privileges.
--
-- Safe to run twice.

ALTER FUNCTION public.update_updated_at() SET search_path = '';

ALTER FUNCTION public.update_treatment_plans_updated_at() SET search_path = '';

ALTER FUNCTION public.reject_payment_correction_audit_mutation() SET search_path = '';

-- Body already reads public.doctors and public.locations only.
ALTER FUNCTION public.sort_doctors_by_distance(double precision, double precision)
  SET search_path = '';

CREATE OR REPLACE FUNCTION public.get_licensed_doctor_ids()
RETURNS SETOF uuid
LANGUAGE sql
STABLE
SET search_path = ''
AS $$
  SELECT d.id
  FROM public.doctors d
  JOIN public.licenses l ON d.organization_id = l.organization_id
  WHERE l.status IN ('active', 'trialing', 'past_due');
$$;

-- Same body as 00097 / the live function. Tables are schema-qualified so
-- search_path '' cannot see a same-named relation in another schema.
CREATE OR REPLACE FUNCTION public.get_live_availability_counts(
  p_day_of_week INT DEFAULT NULL,
  p_current_time TIME DEFAULT NULL,
  p_one_hour_time TIME DEFAULT NULL,
  p_today DATE DEFAULT NULL
)
RETURNS TABLE(slug TEXT, count BIGINT)
LANGUAGE plpgsql
STABLE
SET search_path = ''
AS $$
DECLARE
  v_now TIMESTAMPTZ := NOW();
BEGIN
  RETURN QUERY
  WITH doctor_tz AS (
    SELECT d.id AS did,
           COALESCE(l.timezone, 'Europe/London') AS tz
    FROM   public.doctors d
    LEFT JOIN public.locations l ON l.id = d.location_id
    WHERE  d.verification_status = 'verified'
      AND  d.is_active = TRUE
  ),
  matching_schedules AS (
    SELECT dt.did,
           dt.tz,
           avs.start_time AS sched_start,
           avs.end_time AS sched_end,
           avs.slot_duration_minutes,
           (v_now AT TIME ZONE dt.tz)::DATE AS local_today
    FROM   doctor_tz dt
    JOIN   public.availability_schedules avs ON avs.doctor_id = dt.did
    WHERE  avs.is_active = TRUE
      AND  avs.day_of_week = EXTRACT(ISODOW FROM (v_now AT TIME ZONE dt.tz))::INT
      AND  avs.start_time < (v_now AT TIME ZONE dt.tz)::TIME + INTERVAL '1 hour'
      AND  avs.end_time   > (v_now AT TIME ZONE dt.tz)::TIME
      AND  NOT EXISTS (
        SELECT 1 FROM public.availability_overrides ao
        WHERE ao.doctor_id = dt.did
          AND ao.override_date = (v_now AT TIME ZONE dt.tz)::DATE
          AND ao.is_available = FALSE
      )
  ),
  slots AS (
    SELECT ms.did,
           ms.tz,
           ms.local_today,
           (ms.local_today + ms.sched_start
            + (n * (ms.slot_duration_minutes || ' minutes')::INTERVAL))
            AT TIME ZONE ms.tz AS slot_start,
           (ms.local_today + ms.sched_start
            + ((n + 1) * (ms.slot_duration_minutes || ' minutes')::INTERVAL))
            AT TIME ZONE ms.tz AS slot_end
    FROM   matching_schedules ms
    CROSS JOIN LATERAL generate_series(
      0,
      GREATEST(
        (EXTRACT(EPOCH FROM ms.sched_end - ms.sched_start) / (ms.slot_duration_minutes * 60))::INT - 1,
        0
      )
    ) AS n
  ),
  available_slots AS (
    SELECT s.did
    FROM   slots s
    WHERE  s.slot_start > v_now
      AND  s.slot_start < v_now + INTERVAL '1 hour'
      AND  NOT EXISTS (
        SELECT 1 FROM public.bookings b
        WHERE b.doctor_id = s.did
          AND b.status IN ('confirmed', 'pending_approval', 'approved', 'pending_payment')
          AND b.start_time < s.slot_end
          AND b.end_time   > s.slot_start
      )
  ),
  available_doctors AS (
    SELECT DISTINCT did FROM available_slots
  )
  SELECT sp.slug,
         COUNT(DISTINCT ad.did) AS count
  FROM   available_doctors ad
  JOIN   public.doctor_specialties ds ON ds.doctor_id = ad.did
  JOIN   public.specialties sp ON sp.id = ds.specialty_id
  GROUP BY sp.slug
  HAVING COUNT(DISTINCT ad.did) > 0;
END;
$$;

-- Same body as 00082 / the live function, including the generate_series
-- bound without GREATEST and without the is_active filter the counts
-- function has.
CREATE OR REPLACE FUNCTION public.get_live_doctor_availability(
  p_doctor_ids UUID[],
  p_day_of_week INT DEFAULT NULL,
  p_current_time TIME DEFAULT NULL,
  p_one_hour_time TIME DEFAULT NULL,
  p_today DATE DEFAULT NULL
)
RETURNS TABLE(doctor_id UUID)
LANGUAGE plpgsql
STABLE
SET search_path = ''
AS $$
DECLARE
  v_now TIMESTAMPTZ := NOW();
BEGIN
  RETURN QUERY
  WITH doctor_tz AS (
    SELECT d.id AS did,
           COALESCE(l.timezone, 'Europe/London') AS tz
    FROM   public.doctors d
    LEFT JOIN public.locations l ON l.id = d.location_id
    WHERE  d.id = ANY(p_doctor_ids)
      AND  d.verification_status = 'verified'
  ),
  matching_schedules AS (
    SELECT dt.did,
           dt.tz,
           avs.start_time AS sched_start,
           avs.end_time AS sched_end,
           avs.slot_duration_minutes,
           (v_now AT TIME ZONE dt.tz)::DATE AS local_today
    FROM   doctor_tz dt
    JOIN   public.availability_schedules avs ON avs.doctor_id = dt.did
    WHERE  avs.is_active = TRUE
      AND  avs.day_of_week = EXTRACT(ISODOW FROM (v_now AT TIME ZONE dt.tz))::INT
      AND  avs.start_time < (v_now AT TIME ZONE dt.tz)::TIME + INTERVAL '1 hour'
      AND  avs.end_time   > (v_now AT TIME ZONE dt.tz)::TIME
      AND  NOT EXISTS (
        SELECT 1 FROM public.availability_overrides ao
        WHERE ao.doctor_id = dt.did
          AND ao.override_date = (v_now AT TIME ZONE dt.tz)::DATE
          AND ao.is_available = FALSE
      )
  ),
  slots AS (
    SELECT ms.did,
           ms.tz,
           ms.local_today,
           (ms.local_today + ms.sched_start
            + (n * (ms.slot_duration_minutes || ' minutes')::INTERVAL))
            AT TIME ZONE ms.tz AS slot_start,
           (ms.local_today + ms.sched_start
            + ((n + 1) * (ms.slot_duration_minutes || ' minutes')::INTERVAL))
            AT TIME ZONE ms.tz AS slot_end
    FROM   matching_schedules ms
    CROSS JOIN LATERAL generate_series(
      0,
      (EXTRACT(EPOCH FROM ms.sched_end - ms.sched_start) / (ms.slot_duration_minutes * 60))::INT - 1
    ) AS n
  ),
  available_slots AS (
    SELECT s.did
    FROM   slots s
    WHERE  s.slot_start > v_now
      AND  s.slot_start < v_now + INTERVAL '1 hour'
      AND  NOT EXISTS (
        SELECT 1 FROM public.bookings b
        WHERE b.doctor_id = s.did
          AND b.status IN ('confirmed', 'pending_approval', 'approved', 'pending_payment')
          AND b.start_time < s.slot_end
          AND b.end_time   > s.slot_start
      )
  )
  SELECT DISTINCT did AS doctor_id FROM available_slots;
END;
$$;

-- similarity() is pg_trgm, installed in public. Qualifying it lets
-- search_path stay '' instead of 'public, extensions'.
CREATE OR REPLACE FUNCTION public.search_medications(search_query TEXT, max_results INT DEFAULT 10)
RETURNS TABLE (
  id INT,
  name TEXT,
  generic_name TEXT,
  category TEXT,
  form TEXT
)
LANGUAGE plpgsql
STABLE
SET search_path = ''
AS $$
DECLARE
  result_count INT;
BEGIN
  RETURN QUERY
    SELECT m.id, m.name, m.generic_name, m.category, m.form
    FROM public.medications m
    WHERE public.similarity(m.name, search_query) > 0.1
       OR public.similarity(COALESCE(m.generic_name, ''), search_query) > 0.1
    ORDER BY GREATEST(
      public.similarity(m.name, search_query),
      public.similarity(COALESCE(m.generic_name, ''), search_query)
    ) DESC
    LIMIT max_results;

  GET DIAGNOSTICS result_count = ROW_COUNT;

  IF result_count = 0 THEN
    RETURN QUERY
      SELECT m.id, m.name, m.generic_name, m.category, m.form
      FROM public.medications m
      WHERE m.name ILIKE search_query || '%'
         OR m.generic_name ILIKE search_query || '%'
      ORDER BY
        CASE WHEN m.name ILIKE search_query || '%' THEN 0 ELSE 1 END,
        m.name
      LIMIT max_results;
  END IF;
END;
$$;

-- service_role is the only client role that should see rows. The permissive
-- policy is what allows it when the role does not bypass RLS. The restrictive
-- policy denies anon and authenticated even if a later permissive policy is
-- added for them. REVOKE removes TRUNCATE, which RLS does not cover.
DROP POLICY IF EXISTS "Service role manages compliance notifications"
  ON public.compliance_notifications_sent;
DROP POLICY IF EXISTS "Deny client access to compliance notifications"
  ON public.compliance_notifications_sent;

CREATE POLICY "Service role manages compliance notifications"
  ON public.compliance_notifications_sent
  AS PERMISSIVE
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Deny client access to compliance notifications"
  ON public.compliance_notifications_sent
  AS RESTRICTIVE
  FOR ALL
  TO anon, authenticated
  USING (false)
  WITH CHECK (false);

REVOKE ALL ON TABLE public.compliance_notifications_sent FROM PUBLIC, anon, authenticated;

DO $assert_00140$
DECLARE
  v_missing text;
  v_grants int;
  v_policies int;
BEGIN
  SELECT string_agg(
    p.proname || '(' || pg_catalog.pg_get_function_identity_arguments(p.oid) || ')',
    ', ' ORDER BY p.proname
  )
  INTO v_missing
  FROM pg_catalog.pg_proc AS p
  JOIN pg_catalog.pg_namespace AS n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public'
    AND p.proname IN (
      'update_updated_at',
      'sort_doctors_by_distance',
      'update_treatment_plans_updated_at',
      'get_licensed_doctor_ids',
      'get_live_availability_counts',
      'get_live_doctor_availability',
      'search_medications',
      'reject_payment_correction_audit_mutation'
    )
    AND NOT EXISTS (
      SELECT 1
      FROM pg_catalog.unnest(p.proconfig) AS cfg
      WHERE cfg LIKE 'search_path=%'
    );

  IF v_missing IS NOT NULL THEN
    RAISE EXCEPTION 'search_path still unset: %', v_missing;
  END IF;

  SELECT count(*)
  INTO v_grants
  FROM information_schema.role_table_grants
  WHERE table_schema = 'public'
    AND table_name = 'compliance_notifications_sent'
    AND grantee IN ('anon', 'authenticated', 'PUBLIC');

  IF v_grants <> 0 THEN
    RAISE EXCEPTION 'anon or authenticated still has privileges on compliance_notifications_sent';
  END IF;

  SELECT count(*)
  INTO v_policies
  FROM pg_catalog.pg_policy AS pol
  JOIN pg_catalog.pg_class AS cls ON cls.oid = pol.polrelid
  JOIN pg_catalog.pg_namespace AS nsp ON nsp.oid = cls.relnamespace
  WHERE nsp.nspname = 'public'
    AND cls.relname = 'compliance_notifications_sent';

  IF v_policies < 2 THEN
    RAISE EXCEPTION 'compliance_notifications_sent is missing its deny or service_role policy';
  END IF;
END
$assert_00140$;
