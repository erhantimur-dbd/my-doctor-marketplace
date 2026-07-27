-- Live available doctor IDs with optional specialty, consultation type, and window hours.
-- Used so "Available now" video chip count and search results stay in sync.

CREATE OR REPLACE FUNCTION public.get_live_available_doctor_ids(
  p_specialty_slug TEXT DEFAULT NULL,
  p_consultation_type TEXT DEFAULT NULL,
  p_window_hours INT DEFAULT 1
)
RETURNS UUID[]
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
AS $$
DECLARE
  v_now TIMESTAMPTZ := NOW();
  v_window INTERVAL := make_interval(hours => GREATEST(COALESCE(p_window_hours, 1), 1));
  v_result UUID[];
BEGIN
  WITH doctor_tz AS (
    SELECT d.id AS did,
           COALESCE(l.timezone, 'Europe/London') AS tz
    FROM   doctors d
    LEFT JOIN locations l ON l.id = d.location_id
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
    JOIN   availability_schedules avs ON avs.doctor_id = dt.did
    WHERE  avs.is_active = TRUE
      AND  avs.day_of_week = EXTRACT(
        ISODOW FROM ((v_now AT TIME ZONE dt.tz)::DATE + o.day_offset)
      )::INT
      AND  NOT EXISTS (
        SELECT 1 FROM availability_overrides ao
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
  'Doctor IDs with free slots in the next N hours; optional specialty + consultation type filters.';

GRANT EXECUTE ON FUNCTION public.get_live_available_doctor_ids TO anon, authenticated, service_role;
