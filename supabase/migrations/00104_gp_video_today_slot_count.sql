-- Count free *video* GP appointment slots remaining today (country-wide).
-- Used on the "See a GP today" chip to show total open appointments, not doctor count.

CREATE OR REPLACE FUNCTION public.get_gp_video_today_slot_count(
  p_country_code TEXT DEFAULT NULL
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
  v_country TEXT := NULLIF(UPPER(TRIM(p_country_code)), '');
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
      AND d.consultation_types @> ARRAY['video']::TEXT[]
      AND (
        v_country IS NULL
        OR UPPER(COALESCE(l.country_code, '')) = v_country
      )
  ),
  matching_schedules AS (
    SELECT
      gd.did,
      gd.tz,
      avs.start_time AS sched_start,
      avs.end_time AS sched_end,
      avs.slot_duration_minutes,
      (v_now AT TIME ZONE gd.tz)::DATE AS local_today
    FROM gp_doctors gd
    JOIN public.availability_schedules avs ON avs.doctor_id = gd.did
    WHERE avs.is_active = TRUE
      AND avs.day_of_week = EXTRACT(ISODOW FROM (v_now AT TIME ZONE gd.tz))::INT
      AND NOT EXISTS (
        SELECT 1
        FROM public.availability_overrides ao
        WHERE ao.doctor_id = gd.did
          AND ao.override_date = (v_now AT TIME ZONE gd.tz)::DATE
          AND ao.is_available = FALSE
          AND ao.start_time IS NULL
      )
  ),
  slots AS (
    SELECT
      ms.did,
      ms.tz,
      ms.local_today,
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
      -- End of doctor's local calendar day
      AND s.slot_start < ((s.local_today + 1) AT TIME ZONE s.tz)
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

COMMENT ON FUNCTION public.get_gp_video_today_slot_count IS
  'Free video GP appointment slots remaining today (optional country filter).';

GRANT EXECUTE ON FUNCTION public.get_gp_video_today_slot_count TO anon, authenticated, service_role;
