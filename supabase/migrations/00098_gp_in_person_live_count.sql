-- Live count of in-person GP appointment slots in the next N hours
-- (default 2). Optional country or lat/lng radius for local scope.

CREATE OR REPLACE FUNCTION public.get_gp_in_person_availability(
  p_window_hours INT DEFAULT 2,
  p_country_code TEXT DEFAULT NULL,
  p_lat DOUBLE PRECISION DEFAULT NULL,
  p_lng DOUBLE PRECISION DEFAULT NULL,
  p_radius_km DOUBLE PRECISION DEFAULT NULL
)
RETURNS TABLE(
  doctor_count BIGINT,
  slot_count BIGINT
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
AS $$
DECLARE
  v_now TIMESTAMPTZ := NOW();
  v_window INTERVAL := make_interval(hours => GREATEST(COALESCE(p_window_hours, 2), 1));
  v_country TEXT := NULLIF(UPPER(TRIM(p_country_code)), '');
  v_radius DOUBLE PRECISION := COALESCE(p_radius_km, 30);
BEGIN
  RETURN QUERY
  WITH gp_doctors AS (
    SELECT
      d.id AS did,
      COALESCE(l.timezone, 'Europe/London') AS tz
    FROM public.doctors d
    JOIN public.doctor_specialties ds ON ds.doctor_id = d.id
    JOIN public.specialties sp ON sp.id = ds.specialty_id AND sp.slug = 'general-practice'
    LEFT JOIN public.locations l ON l.id = d.location_id
    WHERE d.is_active = TRUE
      AND d.verification_status = 'verified'
      AND d.consultation_types @> ARRAY['in_person']::TEXT[]
      AND (
        v_country IS NULL
        OR UPPER(COALESCE(l.country_code, '')) = v_country
      )
      AND (
        p_lat IS NULL
        OR p_lng IS NULL
        OR (
          l.latitude IS NOT NULL
          AND l.longitude IS NOT NULL
          AND (
            6371 * acos(
              LEAST(
                1.0,
                cos(radians(p_lat)) * cos(radians(l.latitude))
                  * cos(radians(l.longitude) - radians(p_lng))
                  + sin(radians(p_lat)) * sin(radians(l.latitude))
              )
            )
          ) <= v_radius
        )
      )
  ),
  -- Today and tomorrow local calendar days (window may cross midnight)
  day_offsets AS (
    SELECT 0 AS day_offset
    UNION ALL
    SELECT 1
  ),
  matching_schedules AS (
    SELECT
      gd.did,
      gd.tz,
      avs.start_time AS sched_start,
      avs.end_time AS sched_end,
      avs.slot_duration_minutes,
      ((v_now AT TIME ZONE gd.tz)::DATE + o.day_offset) AS local_today
    FROM gp_doctors gd
    CROSS JOIN day_offsets o
    JOIN public.availability_schedules avs ON avs.doctor_id = gd.did
    WHERE avs.is_active = TRUE
      AND avs.day_of_week = EXTRACT(
        ISODOW FROM ((v_now AT TIME ZONE gd.tz)::DATE + o.day_offset)
      )::INT
      AND NOT EXISTS (
        SELECT 1
        FROM public.availability_overrides ao
        WHERE ao.doctor_id = gd.did
          AND ao.override_date = ((v_now AT TIME ZONE gd.tz)::DATE + o.day_offset)
          AND ao.is_available = FALSE
          AND ao.start_time IS NULL
      )
  ),
  slots AS (
    SELECT
      ms.did,
      (ms.local_today + ms.sched_start
        + (n * (ms.slot_duration_minutes || ' minutes')::INTERVAL))
        AT TIME ZONE ms.tz AS slot_start,
      (ms.local_today + ms.sched_start
        + ((n + 1) * (ms.slot_duration_minutes || ' minutes')::INTERVAL))
        AT TIME ZONE ms.tz AS slot_end
    FROM matching_schedules ms
    CROSS JOIN LATERAL generate_series(
      0,
      GREATEST(
        (EXTRACT(EPOCH FROM ms.sched_end - ms.sched_start)
          / NULLIF(ms.slot_duration_minutes, 0) / 60)::INT - 1,
        0
      )
    ) AS n
  ),
  free_slots AS (
    SELECT s.did, s.slot_start
    FROM slots s
    WHERE s.slot_start > v_now
      AND s.slot_start < v_now + v_window
      AND NOT EXISTS (
        SELECT 1
        FROM public.bookings b
        WHERE b.doctor_id = s.did
          AND b.status IN (
            'confirmed', 'pending_approval', 'approved', 'pending_payment'
          )
          AND b.start_time < s.slot_end
          AND b.end_time > s.slot_start
      )
  )
  SELECT
    COUNT(DISTINCT fs.did)::BIGINT AS doctor_count,
    COUNT(*)::BIGINT AS slot_count
  FROM free_slots fs;
END;
$$;

COMMENT ON FUNCTION public.get_gp_in_person_availability IS
  'Count in-person GP doctors and free slots in the next N hours (default 2), optional country or lat/lng radius.';

GRANT EXECUTE ON FUNCTION public.get_gp_in_person_availability TO anon, authenticated, service_role;
