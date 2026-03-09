-- Evolve deposit from fixed 30% binary toggle to doctor-configurable deposits.
-- Doctors can now choose: None (full payment), Percentage (recommended 30%), or Flat Fee.
-- Each service can optionally override the doctor-level default.
-- Video consultations remain full payment only.

-- ============================================================
-- 1. Doctor-level configurable deposit settings
-- ============================================================

-- Add new flexible deposit columns
ALTER TABLE public.doctors
  ADD COLUMN in_person_deposit_type TEXT NOT NULL DEFAULT 'none'
    CHECK (in_person_deposit_type IN ('none', 'percentage', 'flat')),
  ADD COLUMN in_person_deposit_value INT;

-- Migrate existing data from the binary column
UPDATE public.doctors
  SET in_person_deposit_type = 'percentage',
      in_person_deposit_value = 30
  WHERE in_person_payment_mode = 'deposit';

-- Drop the old binary column
ALTER TABLE public.doctors
  DROP COLUMN in_person_payment_mode;

-- Ensure deposit_value is set correctly
ALTER TABLE public.doctors
  ADD CONSTRAINT chk_doctor_deposit_value
    CHECK (
      (in_person_deposit_type = 'none' AND in_person_deposit_value IS NULL)
      OR (in_person_deposit_type != 'none' AND in_person_deposit_value IS NOT NULL AND in_person_deposit_value > 0)
    );

COMMENT ON COLUMN public.doctors.in_person_deposit_type IS
  'none = full payment upfront; percentage = X% deposit; flat = fixed amount deposit. Only for in-person.';
COMMENT ON COLUMN public.doctors.in_person_deposit_value IS
  'When percentage: the percent (e.g. 30 for 30%). When flat: amount in cents (e.g. 5000 for £50). NULL when none.';

-- ============================================================
-- 2. Per-service deposit override (NULL = inherit doctor default)
-- ============================================================

ALTER TABLE public.doctor_services
  ADD COLUMN deposit_type TEXT CHECK (deposit_type IN ('none', 'percentage', 'flat')),
  ADD COLUMN deposit_value INT;

COMMENT ON COLUMN public.doctor_services.deposit_type IS
  'Override doctor default for this service. NULL = inherit doctor setting. none/percentage/flat.';
COMMENT ON COLUMN public.doctor_services.deposit_value IS
  'Override value. When percentage: the percent. When flat: cents. NULL = inherit.';

-- ============================================================
-- 3. Booking snapshot: what deposit config produced the amounts
-- ============================================================

ALTER TABLE public.bookings
  ADD COLUMN deposit_type TEXT CHECK (deposit_type IN ('percentage', 'flat')),
  ADD COLUMN deposit_value INT;

COMMENT ON COLUMN public.bookings.deposit_type IS
  'Snapshot of the deposit type used at booking time (percentage or flat). NULL for full-payment.';
COMMENT ON COLUMN public.bookings.deposit_value IS
  'Snapshot of the deposit value used (percent or cents). NULL for full-payment.';
