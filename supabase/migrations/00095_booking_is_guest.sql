-- Progressive guest checkout analytics flag
ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS is_guest BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_bookings_is_guest
  ON public.bookings (is_guest)
  WHERE is_guest = true;
