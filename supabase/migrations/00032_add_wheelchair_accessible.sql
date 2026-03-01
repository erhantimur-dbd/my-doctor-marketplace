-- Add wheelchair accessibility flag for in-person clinic locations
ALTER TABLE public.doctors
  ADD COLUMN is_wheelchair_accessible BOOLEAN NOT NULL DEFAULT FALSE;

COMMENT ON COLUMN public.doctors.is_wheelchair_accessible
  IS 'Whether the clinic is wheelchair accessible for in-person appointments.';
