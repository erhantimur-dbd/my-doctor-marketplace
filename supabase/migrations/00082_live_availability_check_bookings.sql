-- Fix: live availability RPCs now also check existing bookings.
-- A doctor is only "available now" if they have at least one unbookable
-- slot in the next hour that doesn't overlap with an existing booking.
-- Previously only checked schedule + overrides, causing false positives
-- when all slots were booked.

-- 1) Specialty-level counts (homepage badges)
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
  ),
  -- Find schedules that cover the next hour in the doctor's local timezone
  matching_schedules AS (
    SELECT dt.did,
           dt.tz,
           avs.start_time AS sched_start,
           avs.end_time AS sched_end,
           avs.slot_duration_minutes,
           (v_now AT TIME ZONE dt.tz)::DATE AS local_today,
           (v_now AT TIME ZONE dt.tz)::TIME AS local_now,
           ((v_now AT TIME ZONE dt.tz)::TIME + INTERVAL '1 hour') AS local_one_hour
    FROM   doctor_tz dt
    JOIN   availability_schedules avs ON avs.doctor_id = dt.did
    WHERE  avs.is_active = TRUE
      AND  avs.day_of_week = EXTRACT(ISODOW FROM (v_now AT TIME ZONE dt.tz))::INT
      AND  avs.start_time < (v_now AT TIME ZONE dt.tz)::TIME + INTERVAL '1 hour'
      AND  avs.end_time   > (v_now AT TIME ZONE dt.tz)::TIME
      -- Not overridden off today
      AND  NOT EXISTS (
        SELECT 1 FROM availability_overrides ao
        WHERE ao.doctor_id = dt.did
          AND ao.override_date = (v_now AT TIME ZONE dt.tz)::DATE
          AND ao.is_available = FALSE
      )
  ),
  -- Generate individual slots within the next-hour window
  slots AS (
    SELECT ms.did,
           ms.tz,
           ms.local_today,
           -- Slot start = max(schedule_start, local_now) aligned to slot boundaries
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
  -- Keep only future slots within the next hour that are not booked
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

-- 2) Doctor-level availability (doctor card badges)
CREATE OR REPLACE FUNCTION public.get_live_doctor_availability(
  p_doctor_ids UUID[],
  p_day_of_week INT DEFAULT NULL,
  p_current_time TIME DEFAULT NULL,
  p_one_hour_time TIME DEFAULT NULL,
  p_today DATE DEFAULT NULL
)
RETURNS TABLE(doctor_id UUID)
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
      (EXTRACT(EPOCH FROM ms.sched_end - ms.sched_start) / (ms.slot_duration_minutes * 60))::INT - 1
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
  )
  SELECT DISTINCT did AS doctor_id FROM available_slots;
END;
$$;
