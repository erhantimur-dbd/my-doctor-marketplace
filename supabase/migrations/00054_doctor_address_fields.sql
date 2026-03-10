-- Add structured address fields to doctors table for city and postal code.
-- The doctors table already has: address TEXT (street), clinic_name TEXT.
-- Country is derived from the locations table via location_id.

ALTER TABLE public.doctors
  ADD COLUMN IF NOT EXISTS city TEXT,
  ADD COLUMN IF NOT EXISTS postal_code TEXT;

COMMENT ON COLUMN public.doctors.city IS 'City where the clinic is located';
COMMENT ON COLUMN public.doctors.postal_code IS 'Postal/ZIP code of the clinic';
