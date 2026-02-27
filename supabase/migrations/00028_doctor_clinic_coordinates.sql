-- Add clinic-level coordinates to doctors for precise map pin placement.
-- Falls back to the city-level coordinates in the locations table when NULL.
ALTER TABLE public.doctors
  ADD COLUMN IF NOT EXISTS clinic_latitude DECIMAL(10, 8),
  ADD COLUMN IF NOT EXISTS clinic_longitude DECIMAL(11, 8);

CREATE INDEX IF NOT EXISTS idx_doctors_clinic_coords
  ON public.doctors(clinic_latitude, clinic_longitude)
  WHERE clinic_latitude IS NOT NULL;
