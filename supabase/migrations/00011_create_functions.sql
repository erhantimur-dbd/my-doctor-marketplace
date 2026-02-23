-- Get available slots for a doctor on a given date
CREATE OR REPLACE FUNCTION public.get_available_slots(
  p_doctor_id UUID,
  p_date DATE,
  p_consultation_type TEXT DEFAULT 'in_person'
)
RETURNS TABLE (
  slot_start TIMESTAMPTZ,
  slot_end TIMESTAMPTZ,
  is_available BOOLEAN
)
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_day_of_week INT;
  v_timezone TEXT;
BEGIN
  v_day_of_week := EXTRACT(DOW FROM p_date);

  SELECT COALESCE(l.timezone, 'Europe/London') INTO v_timezone
  FROM public.doctors d
  LEFT JOIN public.locations l ON d.location_id = l.id
  WHERE d.id = p_doctor_id;

  -- Check if entire day is blocked
  IF EXISTS (
    SELECT 1 FROM public.availability_overrides
    WHERE doctor_id = p_doctor_id
      AND override_date = p_date
      AND is_available = FALSE
      AND start_time IS NULL
  ) THEN
    RETURN;
  END IF;

  RETURN QUERY
  WITH schedule_slots AS (
    SELECT
      (p_date + s.start_time) AT TIME ZONE v_timezone AS slot_s,
      (p_date + s.end_time) AT TIME ZONE v_timezone AS slot_e,
      s.slot_duration_minutes
    FROM public.availability_schedules s
    WHERE s.doctor_id = p_doctor_id
      AND s.day_of_week = v_day_of_week
      AND s.consultation_type = p_consultation_type
      AND s.is_active = TRUE
  ),
  expanded_slots AS (
    SELECT
      slot_s + (n * (slot_duration_minutes || ' minutes')::INTERVAL) AS s_start,
      slot_s + ((n + 1) * (slot_duration_minutes || ' minutes')::INTERVAL) AS s_end
    FROM schedule_slots,
    generate_series(0, (EXTRACT(EPOCH FROM slot_e - slot_s) / (slot_duration_minutes * 60))::INT - 1) AS n
  ),
  booked AS (
    SELECT b.start_time, b.end_time
    FROM public.bookings b
    WHERE b.doctor_id = p_doctor_id
      AND b.appointment_date = p_date
      AND b.status IN ('confirmed', 'pending_approval', 'approved', 'pending_payment')
  )
  SELECT
    es.s_start AS slot_start,
    es.s_end AS slot_end,
    NOT EXISTS (
      SELECT 1 FROM booked bk
      WHERE bk.start_time < es.s_end AND bk.end_time > es.s_start
    ) AS is_available
  FROM expanded_slots es
  WHERE es.s_start > NOW()
  ORDER BY es.s_start;
END;
$$;
