-- Add columns to support admin-created bookings on behalf of patients
ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS created_by_admin_id UUID REFERENCES public.profiles(id),
  ADD COLUMN IF NOT EXISTS stripe_checkout_session_id TEXT,
  ADD COLUMN IF NOT EXISTS payment_link_expires_at TIMESTAMPTZ;

-- Index for cron to quickly find admin-created pending_payment bookings
CREATE INDEX IF NOT EXISTS idx_bookings_admin_pending
  ON public.bookings(created_by_admin_id, payment_link_expires_at)
  WHERE status = 'pending_payment' AND created_by_admin_id IS NOT NULL;
