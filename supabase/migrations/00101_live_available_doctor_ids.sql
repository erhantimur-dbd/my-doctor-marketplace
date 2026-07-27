-- Return doctor IDs that match the live "available now" (next 1 hour) badge,
-- optionally filtered by specialty slug. Used so search results match the count.

CREATE OR REPLACE FUNCTION public.get_live_available_doctor_ids(
  p_specialty_slug TEXT DEFAULT NULL
)
RETURNS UUID[]
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
AS $$
DECLARE
  v_now TIMESTAMPTZ := NOW();
  v_result UUID[];
BEGIN
  WITH doctor_tz AS (
    SELECT d.id AS did,
           COALESCE(l.timezone, 'Europe/London') AS tz
    FROM   doctors d
    LEFT JOIN locations l ON l.id = d.location_id
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
    JOIN   availability_schedules avs ON avs.doctor_id = dt.did
    WHERE  avs.is_active = TRUE
      AND  avs.day_of_week = EXTRACT(ISODOW FROM (v_now AT TIME ZONE dt.tz))::INT
      AND  avs.start_time < (v_now AT TIME ZONE dt.tz)::TIME + INTERVAL '1 hour'
      AND  avs.end_time   > (v_now AT TIME ZONE dt.tz)::TIME
      AND  NOT EXISTS (
        SELECT 1 FROM availability_overrides ao
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
        SELECT 1 FROM bookings b
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
         FROM doctor_specialties ds
         JOIN specialties sp ON sp.id = ds.specialty_id
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

COMMENT ON FUNCTION public.get_live_available_doctor_ids IS
  'Doctor IDs with free slots in the next hour (same logic as live badges), optional specialty filter.';

GRANT EXECUTE ON FUNCTION public.get_live_available_doctor_ids TO anon, authenticated, service_role;
