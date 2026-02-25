-- Sort doctors by distance from user coordinates using Haversine formula.
-- Returns doctor IDs ordered by distance (ascending).
CREATE OR REPLACE FUNCTION public.sort_doctors_by_distance(
  p_lat DOUBLE PRECISION,
  p_lng DOUBLE PRECISION
)
RETURNS TABLE (doctor_id UUID, distance_km DOUBLE PRECISION)
LANGUAGE sql STABLE AS $$
  SELECT
    d.id AS doctor_id,
    (6371 * acos(
      LEAST(1.0,
        cos(radians(p_lat)) * cos(radians(l.latitude)) *
        cos(radians(l.longitude) - radians(p_lng)) +
        sin(radians(p_lat)) * sin(radians(l.latitude))
      )
    )) AS distance_km
  FROM public.doctors d
  JOIN public.locations l ON d.location_id = l.id
  WHERE d.is_active = TRUE
    AND d.verification_status = 'verified'
    AND l.latitude IS NOT NULL
    AND l.longitude IS NOT NULL
  ORDER BY distance_km ASC;
$$;
