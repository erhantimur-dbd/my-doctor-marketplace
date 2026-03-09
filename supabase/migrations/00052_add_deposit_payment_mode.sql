-- Add deposit payment mode for in-person appointments
-- Doctors can choose between full payment or 30% deposit for in-person bookings.
-- Video consultations always require full payment.

-- Per-doctor preference: full (default) or deposit
ALTER TABLE public.doctors
  ADD COLUMN in_person_payment_mode TEXT NOT NULL DEFAULT 'full'
    CHECK (in_person_payment_mode IN ('full', 'deposit'));

COMMENT ON COLUMN public.doctors.in_person_payment_mode IS
  'full = patient pays entire fee upfront; deposit = patient pays 30% deposit + booking fee, remainder in person';

-- Per-booking snapshot of payment mode + deposit tracking + commission
ALTER TABLE public.bookings
  ADD COLUMN payment_mode TEXT NOT NULL DEFAULT 'full'
    CHECK (payment_mode IN ('full', 'deposit')),
  ADD COLUMN deposit_amount_cents INT,
  ADD COLUMN remainder_due_cents INT,
  ADD COLUMN commission_cents INT NOT NULL DEFAULT 0;

COMMENT ON COLUMN public.bookings.payment_mode IS
  'Whether this booking was charged full or deposit. Video bookings are always full.';
COMMENT ON COLUMN public.bookings.deposit_amount_cents IS
  '30% of consultation_fee_cents when payment_mode=deposit; NULL for full-payment bookings.';
COMMENT ON COLUMN public.bookings.remainder_due_cents IS
  'Remainder due on the day (70%) when payment_mode=deposit; NULL for full-payment bookings.';
COMMENT ON COLUMN public.bookings.commission_cents IS
  '15% platform commission on the consultation fee, deducted from the doctor share via Stripe application_fee.';
