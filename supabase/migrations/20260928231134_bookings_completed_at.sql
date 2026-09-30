-- MD360 prod migration export (supabase_migrations.schema_migrations, project zlixmfcppzvbayyjymrv)
-- version: 20260928231134
-- name: bookings_completed_at
-- statements joined with ';\n' in stored order; body below is verbatim (md5 b046626515252cde1fc01cb3c9a12283)

-- Survey and review crons filter completed bookings by completed_at.
-- Doctor/admin status updates already write this column.
ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ;

COMMENT ON COLUMN public.bookings.completed_at IS
  'When the booking was marked completed. Used by survey and review request crons.';

CREATE INDEX IF NOT EXISTS bookings_completed_at_status_idx
  ON public.bookings (status, completed_at)
  WHERE status = 'completed' AND completed_at IS NOT NULL;
