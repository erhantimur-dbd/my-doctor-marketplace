-- RPC function: returns doctor IDs from a given set that have
-- availability in the next 1 hour. Used by doctor card "Available Now" badges.
CREATE OR REPLACE FUNCTION public.get_live_doctor_availability(
  p_doctor_ids UUID[],
  p_day_of_week INT,
  p_current_time TIME,
  p_one_hour_time TIME,
  p_today DATE
)
RETURNS TABLE(doctor_id UUID)
LANGUAGE sql STABLE
AS $$
  SELECT DISTINCT d.id AS doctor_id
  FROM availability_schedules AS avs
  JOIN doctors AS d ON d.id = avs.doctor_id
  WHERE
    d.id = ANY(p_doctor_ids)
    AND d.verification_status = 'verified'
    AND avs.day_of_week = p_day_of_week
    AND avs.is_active = TRUE
    AND avs.start_time < p_one_hour_time
    AND avs.end_time > p_current_time
    AND NOT EXISTS (
      SELECT 1
      FROM availability_overrides AS ao
      WHERE ao.doctor_id = d.id
        AND ao.override_date = p_today
        AND ao.is_available = FALSE
    );
$$;
