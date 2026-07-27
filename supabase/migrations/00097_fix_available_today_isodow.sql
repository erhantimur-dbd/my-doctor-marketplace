-- Align get_doctor_ids_available_today with schedule day_of_week convention.
-- Schedules + live availability use ISODOW (1=Mon .. 7=Sun).
-- This function previously used EXTRACT(DOW) (0=Sun .. 6=Sat), so Sunday
-- never matched, and it could disagree with live "available now" badges.

CREATE OR REPLACE FUNCTION public.get_doctor_ids_available_today()
RETURNS UUID[]
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_result UUID[];
BEGIN
  WITH doctor_timezones AS (
    SELECT d.id AS doctor_id,
           COALESCE(l.timezone, 'Europe/London') AS tz
    FROM public.doctors d
    LEFT JOIN public.locations l ON d.location_id = l.id
    WHERE d.is_active = TRUE
      AND d.verification_status = 'verified'
  ),
  doctor_today AS (
    SELECT dt.doctor_id,
           dt.tz,
           (NOW() AT TIME ZONE dt.tz)::DATE AS local_today,
           -- ISODOW: 1=Mon .. 7=Sun (matches availability_schedules.day_of_week)
           EXTRACT(ISODOW FROM (NOW() AT TIME ZONE dt.tz)::DATE)::INT AS local_dow
    FROM doctor_timezones dt
  ),
  has_schedule AS (
    SELECT DISTINCT dtoday.doctor_id, dtoday.tz, dtoday.local_today
    FROM doctor_today dtoday
    JOIN public.availability_schedules sched
      ON sched.doctor_id = dtoday.doctor_id
     AND sched.day_of_week = dtoday.local_dow
     AND sched.is_active = TRUE
  ),
  not_blocked AS (
    SELECT hs.doctor_id, hs.tz, hs.local_today
    FROM has_schedule hs
    WHERE NOT EXISTS (
      SELECT 1 FROM public.availability_overrides ao
      WHERE ao.doctor_id = hs.doctor_id
        AND ao.override_date = hs.local_today
        AND ao.is_available = FALSE
        AND ao.start_time IS NULL
    )
  ),
  with_remaining_slots AS (
    SELECT nb.doctor_id
    FROM not_blocked nb
    WHERE EXISTS (
      SELECT 1
      FROM public.availability_schedules s
      CROSS JOIN LATERAL generate_series(
        0,
        (EXTRACT(EPOCH FROM s.end_time - s.start_time) / (s.slot_duration_minutes * 60))::INT - 1
      ) AS n
      WHERE s.doctor_id = nb.doctor_id
        AND s.day_of_week = EXTRACT(ISODOW FROM nb.local_today)::INT
        AND s.is_active = TRUE
        AND (nb.local_today + s.start_time + (n * (s.slot_duration_minutes || ' minutes')::INTERVAL))
            > (NOW() AT TIME ZONE nb.tz)
        AND NOT EXISTS (
          SELECT 1 FROM public.bookings b
          WHERE b.doctor_id = nb.doctor_id
            AND b.status IN ('confirmed', 'pending_approval', 'approved', 'pending_payment')
            AND b.start_time < ((nb.local_today + s.start_time + ((n + 1) * (s.slot_duration_minutes || ' minutes')::INTERVAL)) AT TIME ZONE nb.tz)
            AND b.end_time > ((nb.local_today + s.start_time + (n * (s.slot_duration_minutes || ' minutes')::INTERVAL)) AT TIME ZONE nb.tz)
        )
    )
  )
  SELECT COALESCE(array_agg(DISTINCT doctor_id), ARRAY[]::UUID[])
  INTO v_result
  FROM with_remaining_slots;

  RETURN v_result;
END;
$$;

-- Live badges should only count active doctors (search already filters is_active).
CREATE OR REPLACE FUNCTION public.get_live_availability_counts(
  p_day_of_week INT DEFAULT NULL,
  p_current_time TIME DEFAULT NULL,
  p_one_hour_time TIME DEFAULT NULL,
  p_today DATE DEFAULT NULL
)
RETURNS TABLE(slug TEXT, count BIGINT)
LANGUAGE plpgsql STABLE
AS $$
DECLARE
  v_now TIMESTAMPTZ := NOW();
BEGIN
  RETURN QUERY
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
        SELECT 1 FROM bookings b
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
  JOIN   doctor_specialties ds ON ds.doctor_id = ad.did
  JOIN   specialties sp ON sp.id = ds.specialty_id
  GROUP BY sp.slug
  HAVING COUNT(DISTINCT ad.did) > 0;
END;
$$;
