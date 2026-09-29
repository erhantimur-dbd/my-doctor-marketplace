-- Booking completion timestamp used by admin/doctor mark-complete and
-- post-visit review/survey crons. Writers already set this column.
ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_bookings_completed_at
  ON public.bookings (completed_at)
  WHERE completed_at IS NOT NULL;

-- Tighten treatment_plans SELECT: the previous "Anyone can read by token"
-- policy used USING (true), which exposed every care plan row to anon/authenticated
-- clients. Public token pages use the service-role admin client instead.
DROP POLICY IF EXISTS "Anyone can read by token" ON public.treatment_plans;
