-- SECURITY DEFINER hardening.
--
-- Supabase default privileges grant EXECUTE on new public functions to anon
-- and authenticated. REVOKE ... FROM PUBLIC does not remove those role
-- grants. REVOKE is a no-op when the grant is already gone.
--
-- Section 1 is pending match with prod hotfix SQL.

-- ---------------------------------------------------------------------------
-- 1. Pending match with prod hotfix SQL.
--    Lock wallet, founding, seat, and clinic RPCs to service_role.
-- ---------------------------------------------------------------------------

REVOKE EXECUTE ON FUNCTION public.credit_wallet_atomic(uuid, text, int, text, uuid, uuid, text, timestamptz) FROM anon, authenticated, PUBLIC;
GRANT EXECUTE ON FUNCTION public.credit_wallet_atomic(uuid, text, int, text, uuid, uuid, text, timestamptz) TO service_role;

REVOKE EXECUTE ON FUNCTION public.debit_wallet_atomic(uuid, text, int, text, uuid, uuid, text) FROM anon, authenticated, PUBLIC;
GRANT EXECUTE ON FUNCTION public.debit_wallet_atomic(uuid, text, int, text, uuid, uuid, text) TO service_role;

REVOKE EXECUTE ON FUNCTION public.redeem_gift_card_atomic(text, uuid) FROM anon, authenticated, PUBLIC;
GRANT EXECUTE ON FUNCTION public.redeem_gift_card_atomic(text, uuid) TO service_role;

REVOKE EXECUTE ON FUNCTION public.claim_founding_member(uuid, timestamptz) FROM anon, authenticated, PUBLIC;
GRANT EXECUTE ON FUNCTION public.claim_founding_member(uuid, timestamptz) TO service_role;

REVOKE EXECUTE ON FUNCTION public.reserve_founding_spot(uuid, text) FROM anon, authenticated, PUBLIC;
GRANT EXECUTE ON FUNCTION public.reserve_founding_spot(uuid, text) TO service_role;

REVOKE EXECUTE ON FUNCTION public.release_founding_spot_reservation(text, uuid) FROM anon, authenticated, PUBLIC;
GRANT EXECUTE ON FUNCTION public.release_founding_spot_reservation(text, uuid) TO service_role;

REVOKE EXECUTE ON FUNCTION public.increment_used_seats(uuid) FROM anon, authenticated, PUBLIC;
GRANT EXECUTE ON FUNCTION public.increment_used_seats(uuid) TO service_role;

REVOKE EXECUTE ON FUNCTION public.increment_used_seats(uuid, text) FROM anon, authenticated, PUBLIC;
GRANT EXECUTE ON FUNCTION public.increment_used_seats(uuid, text) TO service_role;

REVOKE EXECUTE ON FUNCTION public.decrement_used_seats(uuid) FROM anon, authenticated, PUBLIC;
GRANT EXECUTE ON FUNCTION public.decrement_used_seats(uuid) TO service_role;

REVOKE EXECUTE ON FUNCTION public.decrement_used_seats(uuid, text) FROM anon, authenticated, PUBLIC;
GRANT EXECUTE ON FUNCTION public.decrement_used_seats(uuid, text) TO service_role;

REVOKE EXECUTE ON FUNCTION public.expire_clinic_invitations() FROM anon, authenticated, PUBLIC;
GRANT EXECUTE ON FUNCTION public.expire_clinic_invitations() TO service_role;

REVOKE EXECUTE ON FUNCTION public.get_clinic_location_doctors(uuid) FROM anon, authenticated, PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_clinic_location_doctors(uuid) TO service_role;

-- ---------------------------------------------------------------------------
-- 2. get_org_bookings: owner/admin of p_org_id, service_role bypass.
--    Called by the signed-in clinic client, so authenticated keeps EXECUTE.
--    Body is schema-qualified. search_path is empty.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.get_org_bookings(
  p_org_id UUID,
  p_status TEXT DEFAULT NULL,
  p_doctor_id UUID DEFAULT NULL,
  p_location_id UUID DEFAULT NULL,
  p_from_date DATE DEFAULT NULL,
  p_to_date DATE DEFAULT NULL,
  p_limit INT DEFAULT 50,
  p_offset INT DEFAULT 0
)
RETURNS TABLE(
  booking_id UUID,
  booking_number TEXT,
  appointment_date DATE,
  start_time TIMESTAMPTZ,
  end_time TIMESTAMPTZ,
  status TEXT,
  consultation_type TEXT,
  consultation_fee_cents INT,
  total_amount_cents INT,
  currency TEXT,
  payment_mode TEXT,
  reschedule_payment_status TEXT,
  doctor_id UUID,
  doctor_first_name TEXT,
  doctor_last_name TEXT,
  doctor_avatar_url TEXT,
  patient_id UUID,
  patient_first_name TEXT,
  patient_last_name TEXT,
  patient_email TEXT,
  patient_phone TEXT,
  clinic_location_id UUID,
  clinic_location_name TEXT,
  service_name TEXT,
  created_at TIMESTAMPTZ
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  #variable_conflict use_column
  IF current_user IS DISTINCT FROM 'service_role'
     AND COALESCE(auth.role(), '') IS DISTINCT FROM 'service_role'
     AND NOT EXISTS (
       SELECT 1
       FROM public.organization_members m
       WHERE m.organization_id = p_org_id
         AND m.user_id = auth.uid()
         AND m.role IN ('owner', 'admin')
         AND m.status = 'active'
     )
  THEN
    RAISE EXCEPTION 'not an owner or admin of this organization';
  END IF;

  RETURN QUERY
  SELECT
    b.id                  AS booking_id,
    b.booking_number,
    b.appointment_date,
    b.start_time,
    b.end_time,
    b.status,
    b.consultation_type,
    b.consultation_fee_cents,
    b.total_amount_cents,
    b.currency,
    b.payment_mode,
    b.reschedule_payment_status,
    d.id                  AS doctor_id,
    dp.first_name         AS doctor_first_name,
    dp.last_name          AS doctor_last_name,
    dp.avatar_url         AS doctor_avatar_url,
    b.patient_id,
    pp.first_name         AS patient_first_name,
    pp.last_name          AS patient_last_name,
    pp.email              AS patient_email,
    pp.phone              AS patient_phone,
    b.clinic_location_id,
    cl.name               AS clinic_location_name,
    b.service_name,
    b.created_at
  FROM public.bookings b
  JOIN public.doctors d ON d.id = b.doctor_id
  JOIN public.profiles dp ON dp.id = d.profile_id
  JOIN public.profiles pp ON pp.id = b.patient_id
  LEFT JOIN public.clinic_locations cl ON cl.id = b.clinic_location_id
  WHERE b.organization_id = p_org_id
    AND (p_status IS NULL OR b.status = p_status)
    AND (p_doctor_id IS NULL OR b.doctor_id = p_doctor_id)
    AND (p_location_id IS NULL OR b.clinic_location_id = p_location_id)
    AND (p_from_date IS NULL OR b.appointment_date >= p_from_date)
    AND (p_to_date IS NULL OR b.appointment_date <= p_to_date)
  ORDER BY b.start_time DESC
  LIMIT p_limit
  OFFSET p_offset;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.get_org_bookings(uuid, text, uuid, uuid, date, date, int, int) FROM anon, PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_org_bookings(uuid, text, uuid, uuid, date, date, int, int) TO authenticated;

-- ---------------------------------------------------------------------------
-- 3. nextval_invoice_number: anon loses EXECUTE, authenticated keeps it.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.nextval_invoice_number()
RETURNS BIGINT
LANGUAGE sql
SECURITY DEFINER
SET search_path = ''
AS $$ SELECT pg_catalog.nextval('public.invoice_number_seq'::regclass); $$;

REVOKE EXECUTE ON FUNCTION public.nextval_invoice_number() FROM anon, PUBLIC;
GRANT EXECUTE ON FUNCTION public.nextval_invoice_number() TO authenticated;

-- ---------------------------------------------------------------------------
-- 4. Empty search_path on definers whose bodies are already schema-qualified.
--    Availability RPCs keep anon and authenticated EXECUTE.
--    get_available_dates_in_range and the 5-arg get_available_slots overload
--    are not defined in this repo's migrations.
-- ---------------------------------------------------------------------------

ALTER FUNCTION public.get_available_slots(uuid, date, text) SET search_path = '';
ALTER FUNCTION public.get_available_slots(uuid, date, text, int) SET search_path = '';
ALTER FUNCTION public.get_doctor_ids_available_today() SET search_path = '';
ALTER FUNCTION public.get_gp_in_person_availability(int, text, double precision, double precision, double precision) SET search_path = '';
ALTER FUNCTION public.get_gp_video_today_slot_count(text) SET search_path = '';
ALTER FUNCTION public.get_next_available_slots_batch(uuid[], int, int, text) SET search_path = '';
ALTER FUNCTION public.get_multi_day_available_slots_batch(uuid[], int, int, int, text) SET search_path = '';
ALTER FUNCTION public.expire_clinic_invitations() SET search_path = '';
ALTER FUNCTION public.get_clinic_location_doctors(uuid) SET search_path = '';
ALTER FUNCTION public.update_doctor_rating() SET search_path = '';
ALTER FUNCTION public.update_ticket_updated_at() SET search_path = '';

-- Latest definitions, with public.* on every table reference.
CREATE OR REPLACE FUNCTION public.get_live_available_doctor_ids(
  p_specialty_slug TEXT DEFAULT NULL
)
RETURNS UUID[]
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_now TIMESTAMPTZ := NOW();
  v_result UUID[];
BEGIN
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
        (EXTRACT(EPOCH FROM ms.sched_end - ms.sched_start)
          / NULLIF(ms.slot_duration_minutes, 0) / 60)::INT - 1,
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
    SELECT DISTINCT asl.did
    FROM available_slots asl
    WHERE p_specialty_slug IS NULL
       OR EXISTS (
         SELECT 1
         FROM public.doctor_specialties ds
         JOIN public.specialties sp ON sp.id = ds.specialty_id
         WHERE ds.doctor_id = asl.did
           AND sp.slug = p_specialty_slug
       )
  )
  SELECT COALESCE(array_agg(did), ARRAY[]::UUID[])
  INTO v_result
  FROM available_doctors;

  RETURN v_result;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_live_available_doctor_ids(
  p_specialty_slug TEXT DEFAULT NULL,
  p_consultation_type TEXT DEFAULT NULL,
  p_window_hours INT DEFAULT 1
)
RETURNS UUID[]
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_now TIMESTAMPTZ := NOW();
  v_window INTERVAL := make_interval(hours => GREATEST(COALESCE(p_window_hours, 1), 1));
  v_result UUID[];
BEGIN
  WITH doctor_tz AS (
    SELECT d.id AS did,
           COALESCE(l.timezone, 'Europe/London') AS tz
    FROM   public.doctors d
    LEFT JOIN public.locations l ON l.id = d.location_id
    WHERE  d.verification_status = 'verified'
      AND  d.is_active = TRUE
      AND  (
        p_consultation_type IS NULL
        OR d.consultation_types @> ARRAY[p_consultation_type]::TEXT[]
      )
  ),
  day_offsets AS (
    SELECT 0 AS day_offset
    UNION ALL
    SELECT 1
  ),
  matching_schedules AS (
    SELECT dt.did,
           dt.tz,
           avs.start_time AS sched_start,
           avs.end_time AS sched_end,
           avs.slot_duration_minutes,
           ((v_now AT TIME ZONE dt.tz)::DATE + o.day_offset) AS local_today
    FROM   doctor_tz dt
    CROSS JOIN day_offsets o
    JOIN   public.availability_schedules avs ON avs.doctor_id = dt.did
    WHERE  avs.is_active = TRUE
      AND  avs.day_of_week = EXTRACT(
        ISODOW FROM ((v_now AT TIME ZONE dt.tz)::DATE + o.day_offset)
      )::INT
      AND  NOT EXISTS (
        SELECT 1 FROM public.availability_overrides ao
        WHERE ao.doctor_id = dt.did
          AND ao.override_date = ((v_now AT TIME ZONE dt.tz)::DATE + o.day_offset)
          AND ao.is_available = FALSE
          AND ao.start_time IS NULL
      )
  ),
  slots AS (
    SELECT ms.did,
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
        (EXTRACT(EPOCH FROM ms.sched_end - ms.sched_start)
          / NULLIF(ms.slot_duration_minutes, 0) / 60)::INT - 1,
        0
      )
    ) AS n
  ),
  available_slots AS (
    SELECT s.did
    FROM   slots s
    WHERE  s.slot_start > v_now
      AND  s.slot_start < v_now + v_window
      AND  NOT EXISTS (
        SELECT 1 FROM public.bookings b
        WHERE b.doctor_id = s.did
          AND b.status IN ('confirmed', 'pending_approval', 'approved', 'pending_payment')
          AND b.start_time < s.slot_end
          AND b.end_time   > s.slot_start
      )
  ),
  available_doctors AS (
    SELECT DISTINCT asl.did
    FROM available_slots asl
    WHERE p_specialty_slug IS NULL
       OR EXISTS (
         SELECT 1
         FROM public.doctor_specialties ds
         JOIN public.specialties sp ON sp.id = ds.specialty_id
         WHERE ds.doctor_id = asl.did
           AND sp.slug = p_specialty_slug
       )
  )
  SELECT COALESCE(array_agg(did), ARRAY[]::UUID[])
  INTO v_result
  FROM available_doctors;

  RETURN v_result;
END;
$$;

-- Autocomplete is called with the anon/user client. Lock the path without
-- taking EXECUTE away. pg_trgm's similarity() lives in public or extensions.
CREATE OR REPLACE FUNCTION public.search_allergies(search_query TEXT)
RETURNS TABLE(id INT, name TEXT, category TEXT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
BEGIN
  RETURN QUERY
    SELECT a.id, a.name, a.category
    FROM public.allergies a
    WHERE similarity(a.name, search_query) > 0.1
    ORDER BY similarity(a.name, search_query) DESC
    LIMIT 10;

  IF NOT FOUND THEN
    RETURN QUERY
      SELECT a.id, a.name, a.category
      FROM public.allergies a
      WHERE a.name ILIKE search_query || '%'
      ORDER BY a.name
      LIMIT 10;
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.search_chronic_conditions(search_query TEXT)
RETURNS TABLE(id INT, name TEXT, category TEXT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
BEGIN
  RETURN QUERY
    SELECT c.id, c.name, c.category
    FROM public.chronic_conditions c
    WHERE similarity(c.name, search_query) > 0.1
    ORDER BY similarity(c.name, search_query) DESC
    LIMIT 10;

  IF NOT FOUND THEN
    RETURN QUERY
      SELECT c.id, c.name, c.category
      FROM public.chronic_conditions c
      WHERE c.name ILIKE search_query || '%'
      ORDER BY c.name
      LIMIT 10;
  END IF;
END;
$$;

-- ---------------------------------------------------------------------------
-- Other definers that are not availability RPCs and are not called by anon.
-- Trigger functions keep authenticated EXECUTE so user writes still fire them.
-- Offset RPCs are service-role only (00124 granted service_role; PUBLIC is
-- not enough to remove the anon grant).
-- ---------------------------------------------------------------------------

REVOKE EXECUTE ON FUNCTION public.reserve_correction_offset(uuid, uuid, int) FROM anon, authenticated, PUBLIC;
GRANT EXECUTE ON FUNCTION public.reserve_correction_offset(uuid, uuid, int) TO service_role;

REVOKE EXECUTE ON FUNCTION public.release_reserved_offset_holds(uuid[]) FROM anon, authenticated, PUBLIC;
GRANT EXECUTE ON FUNCTION public.release_reserved_offset_holds(uuid[]) TO service_role;

REVOKE EXECUTE ON FUNCTION public.apply_reserved_offset_holds(uuid) FROM anon, authenticated, PUBLIC;
GRANT EXECUTE ON FUNCTION public.apply_reserved_offset_holds(uuid) TO service_role;

REVOKE EXECUTE ON FUNCTION public.restore_offset_for_refund(uuid, text, int, int) FROM anon, authenticated, PUBLIC;
GRANT EXECUTE ON FUNCTION public.restore_offset_for_refund(uuid, text, int, int) TO service_role;

REVOKE EXECUTE ON FUNCTION public.increment_coupon_uses(uuid) FROM anon, authenticated, PUBLIC;
GRANT EXECUTE ON FUNCTION public.increment_coupon_uses(uuid) TO service_role;

REVOKE EXECUTE ON FUNCTION public.update_doctor_rating() FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.update_ticket_updated_at() FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.prevent_doctor_privileged_column_update() FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.generate_booking_number() FROM anon, PUBLIC;
