-- Fix: live availability RPCs now resolve each doctor's timezone from their
-- location instead of accepting a single server-computed day/time.
-- This prevents false positives when the server (UTC) disagrees with the
-- doctor's local timezone about what day/time it is.
--
-- DB convention: day_of_week uses ISODOW (1=Mon .. 7=Sun).
-- Old params (p_day_of_week, p_current_time, etc.) kept with DEFAULT NULL
-- for backwards compat but are now ignored — timezone is computed per-doctor.

-- 1) Specialty-level counts (homepage badges)
CREATE OR REPLACE FUNCTION public.get_live_availability_counts(
  p_day_of_week INT DEFAULT NULL,
  p_current_time TIME DEFAULT NULL,
  p_one_hour_time TIME DEFAULT NULL,
  p_today DATE DEFAULT NULL
)
RETURNS TABLE(slug TEXT, count BIGINT)
LANGUAGE sql STABLE
AS $$
  SELECT
    sp.slug,
    COUNT(DISTINCT d.id) AS count
  FROM availability_schedules AS avs
  JOIN doctors AS d ON d.id = avs.doctor_id
  JOIN doctor_specialties AS ds ON ds.doctor_id = d.id
  JOIN specialties AS sp ON sp.id = ds.specialty_id
  LEFT JOIN locations AS l ON l.id = d.location_id
  WHERE
    d.verification_status = 'verified'
    AND avs.is_active = TRUE
    -- Compare in doctor's local timezone (ISODOW: 1=Mon..7=Sun matches DB)
    AND avs.day_of_week = EXTRACT(
      ISODOW FROM (NOW() AT TIME ZONE COALESCE(l.timezone, 'Europe/London'))
    )::INT
    AND avs.start_time < (NOW() AT TIME ZONE COALESCE(l.timezone, 'Europe/London'))::TIME + INTERVAL '1 hour'
    AND avs.end_time   > (NOW() AT TIME ZONE COALESCE(l.timezone, 'Europe/London'))::TIME
    -- Not overridden off today
    AND NOT EXISTS (
      SELECT 1
      FROM availability_overrides AS ao
      WHERE ao.doctor_id = d.id
        AND ao.override_date = (NOW() AT TIME ZONE COALESCE(l.timezone, 'Europe/London'))::DATE
        AND ao.is_available = FALSE
    )
  GROUP BY sp.slug
  HAVING COUNT(DISTINCT d.id) > 0;
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
LANGUAGE sql STABLE
AS $$
  SELECT DISTINCT d.id AS doctor_id
  FROM availability_schedules AS avs
  JOIN doctors AS d ON d.id = avs.doctor_id
  LEFT JOIN locations AS l ON l.id = d.location_id
  WHERE
    d.id = ANY(p_doctor_ids)
    AND d.verification_status = 'verified'
    AND avs.is_active = TRUE
    -- Compare in doctor's local timezone (ISODOW: 1=Mon..7=Sun matches DB)
    AND avs.day_of_week = EXTRACT(
      ISODOW FROM (NOW() AT TIME ZONE COALESCE(l.timezone, 'Europe/London'))
    )::INT
    AND avs.start_time < (NOW() AT TIME ZONE COALESCE(l.timezone, 'Europe/London'))::TIME + INTERVAL '1 hour'
    AND avs.end_time   > (NOW() AT TIME ZONE COALESCE(l.timezone, 'Europe/London'))::TIME
    AND NOT EXISTS (
      SELECT 1
      FROM availability_overrides AS ao
      WHERE ao.doctor_id = d.id
        AND ao.override_date = (NOW() AT TIME ZONE COALESCE(l.timezone, 'Europe/London'))::DATE
        AND ao.is_available = FALSE
    );
$$;
