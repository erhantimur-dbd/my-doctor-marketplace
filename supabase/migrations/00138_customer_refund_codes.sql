-- Customer-facing refund codes (RF-TT9EJN) stored with the full Stripe refund id.
-- The email shows the short code. Reconciliation uses stripe_refund_id.

ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS customer_refund_codes JSONB NOT NULL DEFAULT '[]'::jsonb;

COMMENT ON COLUMN public.bookings.customer_refund_codes IS
  'Array of {code, stripe_refund_id, amount_cents, recorded_at}. code is the customer refund reference (RF- plus the booking ref). stripe_refund_id is the full Stripe refund id and is not shown in email.';

CREATE INDEX IF NOT EXISTS bookings_customer_refund_codes_gin
  ON public.bookings USING gin (customer_refund_codes);
