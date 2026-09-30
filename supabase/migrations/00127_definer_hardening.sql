-- SECURITY DEFINER hardening.
-- Merges after the prod drift-import PR. There is no pg_cron on this project.
--
-- These prod scripts are copied byte for byte:
-- revoke_definer_service_only_grants (20260930155956),
-- revoke_get_org_bookings_anon, and guard_get_org_bookings (20260930161246).

-- revoke_definer_service_only_grants: SECURITY DEFINER functions without auth.uid() checks become service_role only.
-- nextval_invoice_number(): anon loses access (it also had a PUBLIC grant, so PUBLIC is revoked); authenticated and service_role keep it.

REVOKE EXECUTE ON FUNCTION public.claim_founding_member(uuid, timestamp with time zone) FROM anon, authenticated, PUBLIC;
GRANT EXECUTE ON FUNCTION public.claim_founding_member(uuid, timestamp with time zone) TO service_role;
REVOKE EXECUTE ON FUNCTION public.credit_wallet_atomic(uuid, text, integer, text, uuid, uuid, text, timestamp with time zone) FROM anon, authenticated, PUBLIC;
GRANT EXECUTE ON FUNCTION public.credit_wallet_atomic(uuid, text, integer, text, uuid, uuid, text, timestamp with time zone) TO service_role;
REVOKE EXECUTE ON FUNCTION public.debit_wallet_atomic(uuid, text, integer, text, uuid, uuid, text) FROM anon, authenticated, PUBLIC;
GRANT EXECUTE ON FUNCTION public.debit_wallet_atomic(uuid, text, integer, text, uuid, uuid, text) TO service_role;
REVOKE EXECUTE ON FUNCTION public.decrement_used_seats(uuid) FROM anon, authenticated, PUBLIC;
GRANT EXECUTE ON FUNCTION public.decrement_used_seats(uuid) TO service_role;
REVOKE EXECUTE ON FUNCTION public.decrement_used_seats(uuid, text) FROM anon, authenticated, PUBLIC;
GRANT EXECUTE ON FUNCTION public.decrement_used_seats(uuid, text) TO service_role;
REVOKE EXECUTE ON FUNCTION public.expire_clinic_invitations() FROM anon, authenticated, PUBLIC;
GRANT EXECUTE ON FUNCTION public.expire_clinic_invitations() TO service_role;
REVOKE EXECUTE ON FUNCTION public.get_clinic_location_doctors(uuid) FROM anon, authenticated, PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_clinic_location_doctors(uuid) TO service_role;
REVOKE EXECUTE ON FUNCTION public.increment_used_seats(uuid) FROM anon, authenticated, PUBLIC;
GRANT EXECUTE ON FUNCTION public.increment_used_seats(uuid) TO service_role;
REVOKE EXECUTE ON FUNCTION public.increment_used_seats(uuid, text) FROM anon, authenticated, PUBLIC;
GRANT EXECUTE ON FUNCTION public.increment_used_seats(uuid, text) TO service_role;
REVOKE EXECUTE ON FUNCTION public.redeem_gift_card_atomic(text, uuid) FROM anon, authenticated, PUBLIC;
GRANT EXECUTE ON FUNCTION public.redeem_gift_card_atomic(text, uuid) TO service_role;
REVOKE EXECUTE ON FUNCTION public.release_founding_spot_reservation(text, uuid) FROM anon, authenticated, PUBLIC;
GRANT EXECUTE ON FUNCTION public.release_founding_spot_reservation(text, uuid) TO service_role;
REVOKE EXECUTE ON FUNCTION public.reserve_founding_spot(uuid, text) FROM anon, authenticated, PUBLIC;
GRANT EXECUTE ON FUNCTION public.reserve_founding_spot(uuid, text) TO service_role;

REVOKE EXECUTE ON FUNCTION public.nextval_invoice_number() FROM anon;
REVOKE EXECUTE ON FUNCTION public.nextval_invoice_number() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.nextval_invoice_number() TO authenticated, service_role;

-- Hotfix 2026-09-30: get_org_bookings is SECURITY DEFINER and returned any org's bookings to anon.
-- App calls it only from the signed-in user client (requireOrgMember).
REVOKE EXECUTE ON FUNCTION public.get_org_bookings(uuid, text, uuid, uuid, date, date, integer, integer) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.get_org_bookings(uuid, text, uuid, uuid, date, date, integer, integer) FROM anon;
GRANT EXECUTE ON FUNCTION public.get_org_bookings(uuid, text, uuid, uuid, date, date, integer, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_org_bookings(uuid, text, uuid, uuid, date, date, integer, integer) TO service_role;

-- verbatim from prod migration 20260930161246 guard_get_org_bookings
-- C1 hotfix: guard public.get_org_bookings (owner/admin active members or service_role only),
-- pin search_path = '' and convert LANGUAGE sql -> plpgsql (RETURN QUERY), same signature/columns.
CREATE OR REPLACE FUNCTION public.get_org_bookings(p_org_id uuid, p_status text DEFAULT NULL::text, p_doctor_id uuid DEFAULT NULL::uuid, p_location_id uuid DEFAULT NULL::uuid, p_from_date date DEFAULT NULL::date, p_to_date date DEFAULT NULL::date, p_limit integer DEFAULT 50, p_offset integer DEFAULT 0)
 RETURNS TABLE(booking_id uuid, booking_number text, appointment_date date, start_time timestamp with time zone, end_time timestamp with time zone, status text, consultation_type text, consultation_fee_cents integer, total_amount_cents integer, currency text, payment_mode text, reschedule_payment_status text, doctor_id uuid, doctor_first_name text, doctor_last_name text, doctor_avatar_url text, patient_id uuid, patient_first_name text, patient_last_name text, patient_email text, patient_phone text, clinic_location_id uuid, clinic_location_name text, service_name text, created_at timestamp with time zone)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path = ''
AS $function$
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role' AND NOT EXISTS (
    SELECT 1
    FROM public.organization_members om
    WHERE om.organization_id = p_org_id
      AND om.user_id = auth.uid()
      AND om.role IN ('owner', 'admin')
      AND om.status = 'active'
  ) THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  SELECT
    b.id,
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
    d.id,
    dp.first_name,
    dp.last_name,
    dp.avatar_url,
    b.patient_id,
    pp.first_name,
    pp.last_name,
    pp.email,
    pp.phone,
    b.clinic_location_id,
    cl.name,
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
$function$;

REVOKE ALL ON FUNCTION public.get_org_bookings(uuid, text, uuid, uuid, date, date, integer, integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_org_bookings(uuid, text, uuid, uuid, date, date, integer, integer) FROM anon;
GRANT EXECUTE ON FUNCTION public.get_org_bookings(uuid, text, uuid, uuid, date, date, integer, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_org_bookings(uuid, text, uuid, uuid, date, date, integer, integer) TO service_role;

CREATE OR REPLACE FUNCTION public.nextval_invoice_number()
RETURNS BIGINT
LANGUAGE sql
SECURITY DEFINER
SET search_path = ''
AS $$ SELECT pg_catalog.nextval('public.invoice_number_seq'::regclass); $$;

-- ---------------------------------------------------------------------------
-- search_path on every in-repo SECURITY DEFINER function that did not set one.
-- Availability RPCs keep anon and authenticated EXECUTE.
-- get_available_dates_in_range and the 5-arg get_available_slots overload
-- are not in this repo (they are part of the prod drift import).
-- nextval_invoice_number grants are in the prod script above; this only pins search_path.
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

-- Autocomplete runs as the caller. The tables are public-read reference data,
-- so definer rights are unnecessary. Keep anon and authenticated EXECUTE.
-- pg_trgm similarity() lives in public or extensions.
ALTER FUNCTION public.search_allergies(text) SECURITY INVOKER SET search_path = public, extensions;
ALTER FUNCTION public.search_chronic_conditions(text) SECURITY INVOKER SET search_path = public, extensions;

-- Trigger functions do not consult the caller's EXECUTE privilege.
-- Revoke anon and PUBLIC. Do not revoke rls_* or get_user_org_ids: policies
-- call those as the invoker.
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.update_doctor_rating() FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.update_ticket_updated_at() FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.generate_booking_number() FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.prevent_doctor_privileged_column_update() FROM anon, PUBLIC;

-- Offset RPCs are service-role only. 00124 granted service_role; PUBLIC does
-- not remove the anon grant from Supabase default privileges.
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
