-- Label test bookings. Existing rows stay false. No policy change:
-- bookings grants are row-level (select/insert), and this column is not
-- referenced by refund or checkout logic.
ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS is_test BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN public.bookings.is_test IS
  'True when this booking is a labelled test booking.';
