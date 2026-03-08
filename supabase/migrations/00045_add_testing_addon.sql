-- Add has_testing_addon flag to doctors table
-- Allows doctors on any paid plan to also offer medical testing services as an add-on
ALTER TABLE public.doctors
  ADD COLUMN has_testing_addon BOOLEAN NOT NULL DEFAULT FALSE;

-- Partial index for quick filtering of doctors who offer testing
CREATE INDEX idx_doctors_testing_addon ON public.doctors(has_testing_addon) WHERE has_testing_addon = TRUE;
