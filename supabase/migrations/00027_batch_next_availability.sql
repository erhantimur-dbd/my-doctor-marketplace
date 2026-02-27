-- Batch function: for each doctor in the input array, find the next available
-- day (up to p_max_days ahead) and return up to p_max_slots slots for that day.
-- Returns flat rows (doctor_id, available_date, slot_start, slot_end).
-- Mirrors the slot-expansion logic in get_available_slots (00011) and the
-- batch-processing pattern of get_doctor_ids_available_today (00012).

CREATE OR REPLACE FUNCTION public.get_next_available_slots_batch(
  p_doctor_ids UUID[],
  p_max_days  INT  DEFAULT 14,
  p_max_slots INT  DEFAULT 4,
  p_consultation_type TEXT DEFAULT 'in_person'
)
RETURNS TABLE (
  doctor_id      UUID,
  available_date DATE,
  slot_start     TIMESTAMPTZ,
  slot_end       TIMESTAMPTZ
)
LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  RETURN QUERY
  WITH
  -- 1. Resolve each doctor's timezone
  doctor_tz AS (
    SELECT d.id AS did,
           COALESCE(l.timezone, 'Europe/London') AS tz
    FROM   unnest(p_doctor_ids) AS req(id)
    JOIN   public.doctors d  ON d.id = req.id
    LEFT JOIN public.locations l ON d.location_id = l.id
    WHERE  d.is_active = TRUE
      AND  d.verification_status = 'verified'
  ),

  -- 2. Generate candidate dates (today .. today + p_max_days) per doctor
  candidate_dates AS (
    SELECT dt.did,
           dt.tz,
           ((NOW() AT TIME ZONE dt.tz)::DATE + d_offset) AS cdate,
           EXTRACT(DOW FROM (NOW() AT TIME ZONE dt.tz)::DATE + d_offset)::INT AS cdow
    FROM   doctor_tz dt
    CROSS JOIN generate_series(0, p_max_days - 1) AS d_offset
  ),

  -- 3. Remove full-day blocked dates
  unblocked AS (
    SELECT cd.*
    FROM   candidate_dates cd
    WHERE  NOT EXISTS (
      SELECT 1
      FROM   public.availability_overrides ao
      WHERE  ao.doctor_id    = cd.did
        AND  ao.override_date = cd.cdate
        AND  ao.is_available  = FALSE
        AND  ao.start_time    IS NULL
    )
  ),

  -- 4. Expand schedules into individual slots
  all_slots AS (
    SELECT ub.did,
           ub.tz,
           ub.cdate,
           (ub.cdate + s.start_time + (n * (s.slot_duration_minutes || ' minutes')::INTERVAL))
             AT TIME ZONE ub.tz                  AS s_start,
           (ub.cdate + s.start_time + ((n + 1) * (s.slot_duration_minutes || ' minutes')::INTERVAL))
             AT TIME ZONE ub.tz                  AS s_end
    FROM   unblocked ub
    JOIN   public.availability_schedules s
      ON   s.doctor_id         = ub.did
     AND   s.day_of_week       = ub.cdow
     AND   s.consultation_type = p_consultation_type
     AND   s.is_active         = TRUE
    CROSS JOIN LATERAL generate_series(
      0,
      (EXTRACT(EPOCH FROM s.end_time - s.start_time) / (s.slot_duration_minutes * 60))::INT - 1
    ) AS n
  ),

  -- 5. Keep only future, un-booked slots
  available AS (
    SELECT asl.did,
           asl.cdate,
           asl.s_start,
           asl.s_end
    FROM   all_slots asl
    WHERE  asl.s_start > NOW()
      AND  NOT EXISTS (
        SELECT 1
        FROM   public.bookings b
        WHERE  b.doctor_id        = asl.did
          AND  b.appointment_date = asl.cdate
          AND  b.status IN ('confirmed', 'pending_approval', 'approved', 'pending_payment')
          AND  b.start_time < asl.s_end
          AND  b.end_time   > asl.s_start
      )
  ),

  -- 6. Rank: per doctor, order by date then time, pick first day's first N slots
  ranked AS (
    SELECT a.did,
           a.cdate,
           a.s_start,
           a.s_end,
           -- first_value to identify the earliest available date per doctor
           FIRST_VALUE(a.cdate) OVER (PARTITION BY a.did ORDER BY a.cdate, a.s_start) AS first_date,
           ROW_NUMBER()         OVER (PARTITION BY a.did ORDER BY a.cdate, a.s_start) AS rn
    FROM   available a
  )

  SELECT r.did      AS doctor_id,
         r.cdate    AS available_date,
         r.s_start  AS slot_start,
         r.s_end    AS slot_end
  FROM   ranked r
  WHERE  r.cdate = r.first_date   -- only the first available day
    AND  r.rn   <= p_max_slots     -- limit slots per doctor
  ORDER BY r.did, r.s_start;
END;
$$;
