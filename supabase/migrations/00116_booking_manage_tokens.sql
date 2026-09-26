-- One-time tokens for the public "find my booking" manage handoff.
-- The raw token is emailed. This table stores only a SHA-256 hash.
-- Redeeming the link consumes the row (used_at) and then opens the
-- existing patient manage flow. Lookup itself cannot cancel or reschedule.
--
-- Service role only. RLS is on and there are no policies for anon or
-- authenticated, so those roles cannot read or write tokens.

CREATE TABLE public.booking_manage_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id UUID NOT NULL REFERENCES public.bookings(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT booking_manage_tokens_token_hash_key UNIQUE (token_hash)
);

CREATE INDEX idx_booking_manage_tokens_booking
  ON public.booking_manage_tokens (booking_id);

ALTER TABLE public.booking_manage_tokens ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.booking_manage_tokens FROM PUBLIC;
REVOKE ALL ON TABLE public.booking_manage_tokens FROM anon;
REVOKE ALL ON TABLE public.booking_manage_tokens FROM authenticated;
GRANT ALL ON TABLE public.booking_manage_tokens TO service_role;

COMMENT ON TABLE public.booking_manage_tokens IS
  'Hashed single-use links emailed after a booking-number and email match. Service role only; no client policies.';
