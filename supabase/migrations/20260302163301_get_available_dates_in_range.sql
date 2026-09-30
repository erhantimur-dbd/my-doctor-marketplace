-- MD360 prod migration export (supabase_migrations.schema_migrations, project zlixmfcppzvbayyjymrv)
-- version: 20260302163301
-- name: get_available_dates_in_range
-- statements joined with ';\n' in stored order; body below is verbatim (md5 5caa8d9c7731b9167e259fd9803926a6)

-- Returns which dates in a range have available slots (and how many)
-- for a single doctor. Powers the calendar month view by highlighting
-- available dates without returning full slot details.

CREATE OR REPLACE FUNCTION public.get_available_dates_in_range(
  p_doctor_id         UUID,
  p_start_date        DATE,
  p_end_date          DATE,
  p_consultation_type TEXT DEFAULT 'in_person'
)
RETURNS TABLE (
  available_date DATE,
  slot_count     INT
)
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_timezone TEXT;
BEGIN
  -- Resolve doctor timezone
  SELECT COALESCE(l.timezone, 'Europe/London') INTO v_timezone
  FROM   public.doctors d
  LEFT JOIN public.locations l ON d.location_id = l.id
  WHERE  d.id = p_doctor_id;

  IF v_timezone IS NULL THEN
    v_timezone := 'Europe/London';
  END IF;

  RETURN QUERY
  WITH
  -- 1. Generate candidate dates in the requested range
  candidate_dates AS (
    SELECT
      (p_start_date + d_offset) AS cdate,
      EXTRACT(DOW FROM (p_start_date + d_offset))::INT AS cdow
    FROM generate_series(0, (p_end_date - p_start_date)::INT) AS d_offset
  ),

  -- 2. Remove full-day blocked dates
  unblocked AS (
    SELECT cd.*
    FROM   candidate_dates cd
    WHERE  NOT EXISTS (
      SELECT 1
      FROM   public.availability_overrides ao
      WHERE  ao.doctor_id    = p_doctor_id
        AND  ao.override_date = cd.cdate
        AND  ao.is_available  = FALSE
        AND  ao.start_time    IS NULL
    )
  ),

  -- 3. Expand schedules into individual slots
  all_slots AS (
    SELECT ub.cdate,
           (ub.cdate + s.start_time + (n * (s.slot_duration_minutes || ' minutes')::INTERVAL))
             AT TIME ZONE v_timezone AS s_start,
           (ub.cdate + s.start_time + ((n + 1) * (s.slot_duration_minutes || ' minutes')::INTERVAL))
             AT TIME ZONE v_timezone AS s_end
    FROM   unblocked ub
    JOIN   public.availability_schedules s
      ON   s.doctor_id         = p_doctor_id
     AND   s.day_of_week       = ub.cdow
     AND   s.consultation_type = p_consultation_type
     AND   s.is_active         = TRUE
    CROSS JOIN LATERAL generate_series(
      0,
      (EXTRACT(EPOCH FROM s.end_time - s.start_time) / (s.slot_duration_minutes * 60))::INT - 1
    ) AS n
  ),

  -- 4. Keep only future, un-booked slots
  available AS (
    SELECT asl.cdate, asl.s_start
    FROM   all_slots asl
    WHERE  asl.s_start > NOW()
      AND  NOT EXISTS (
        SELECT 1
        FROM   public.bookings b
        WHERE  b.doctor_id        = p_doctor_id
          AND  b.appointment_date = asl.cdate
          AND  b.status IN ('confirmed', 'pending_approval', 'approved', 'pending_payment')
          AND  b.start_time < asl.s_end
          AND  b.end_time   > asl.s_start
      )
  )

  -- 5. Group by date and count available slots
  SELECT a.cdate AS available_date,
         COUNT(*)::INT AS slot_count
  FROM   available a
  GROUP BY a.cdate
  ORDER BY a.cdate;
END;
$$;
