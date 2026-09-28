-- Survey and review crons filter completed bookings by completed_at.
-- Doctor/admin status updates already write this column.
ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ;

COMMENT ON COLUMN public.bookings.completed_at IS
  'When the booking was marked completed. Used by survey and review request crons.';

CREATE INDEX IF NOT EXISTS bookings_completed_at_status_idx
  ON public.bookings (status, completed_at)
  WHERE status = 'completed' AND completed_at IS NOT NULL;
