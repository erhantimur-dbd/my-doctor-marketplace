-- RPC function: returns count of available doctors per specialty
-- for the next 1 hour. Used by the homepage live availability badges.
CREATE OR REPLACE FUNCTION public.get_live_availability_counts(
  p_day_of_week INT,
  p_current_time TIME,
  p_one_hour_time TIME,
  p_today DATE
)
RETURNS TABLE(slug TEXT, count BIGINT)
LANGUAGE sql STABLE
AS $$
  SELECT
    s.slug,
    COUNT(DISTINCT d.id) AS count
  FROM availability_schedules AS avs
  JOIN doctors AS d ON d.id = avs.doctor_id
  JOIN doctor_specialties AS ds ON ds.doctor_id = d.id
  JOIN specialties AS s ON s.id = ds.specialty_id
  WHERE
    -- Only verified doctors
    d.verification_status = 'verified'
    -- Schedule covers today's day of week
    AND avs.day_of_week = p_day_of_week
    AND avs.is_active = TRUE
    -- Schedule overlaps the next 1-hour window
    AND avs.start_time < p_one_hour_time
    AND avs.end_time > p_current_time
    -- Not overridden off today
    AND NOT EXISTS (
      SELECT 1
      FROM availability_overrides AS ao
      WHERE ao.doctor_id = d.id
        AND ao.override_date = p_today
        AND ao.is_available = FALSE
    )
  GROUP BY s.slug
  HAVING COUNT(DISTINCT d.id) > 0;
$$;
