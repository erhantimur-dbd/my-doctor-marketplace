-- Function to get all doctor IDs that have at least one available slot today.
-- Operates set-based across ALL doctors in a single query (no N+1).
-- Mirrors the logic in get_available_slots() but returns just doctor IDs.
CREATE OR REPLACE FUNCTION public.get_doctor_ids_available_today()
RETURNS UUID[]
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_result UUID[];
BEGIN
  WITH doctor_timezones AS (
    -- Get each active, verified doctor's timezone
    SELECT d.id AS doctor_id,
           COALESCE(l.timezone, 'Europe/London') AS tz
    FROM public.doctors d
    LEFT JOIN public.locations l ON d.location_id = l.id
    WHERE d.is_active = TRUE
      AND d.verification_status = 'verified'
  ),
  doctor_today AS (
    -- Compute "today" and day-of-week in each doctor's local timezone
    SELECT dt.doctor_id,
           dt.tz,
           (NOW() AT TIME ZONE dt.tz)::DATE AS local_today,
           EXTRACT(DOW FROM (NOW() AT TIME ZONE dt.tz)::DATE)::INT AS local_dow
    FROM doctor_timezones dt
  ),
  has_schedule AS (
    -- Doctors who have at least one active schedule for today's day-of-week
    SELECT DISTINCT dtoday.doctor_id, dtoday.tz, dtoday.local_today
    FROM doctor_today dtoday
    JOIN public.availability_schedules sched
      ON sched.doctor_id = dtoday.doctor_id
     AND sched.day_of_week = dtoday.local_dow
     AND sched.is_active = TRUE
  ),
  not_blocked AS (
    -- Exclude doctors with a full-day block override for today
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
    -- For each non-blocked doctor, check if at least one future slot is unbooked
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
        AND s.day_of_week = EXTRACT(DOW FROM nb.local_today)::INT
        AND s.is_active = TRUE
        -- Slot start must be in the future (in UTC for comparison with NOW())
        AND (nb.local_today + s.start_time + (n * (s.slot_duration_minutes || ' minutes')::INTERVAL))
            AT TIME ZONE nb.tz > NOW()
        -- Slot must not overlap with any existing booking
        AND NOT EXISTS (
          SELECT 1 FROM public.bookings b
          WHERE b.doctor_id = nb.doctor_id
            AND b.appointment_date = nb.local_today
            AND b.status IN ('confirmed', 'pending_approval', 'approved', 'pending_payment')
            AND b.start_time < ((nb.local_today + s.start_time + ((n + 1) * (s.slot_duration_minutes || ' minutes')::INTERVAL)) AT TIME ZONE nb.tz)
            AND b.end_time > ((nb.local_today + s.start_time + (n * (s.slot_duration_minutes || ' minutes')::INTERVAL)) AT TIME ZONE nb.tz)
        )
    )
  )
  SELECT ARRAY_AGG(doctor_id) INTO v_result
  FROM with_remaining_slots;

  RETURN COALESCE(v_result, ARRAY[]::UUID[]);
END;
$$;
