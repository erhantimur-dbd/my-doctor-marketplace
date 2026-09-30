-- Dispute flags and destination-transfer reversal observations.
-- Idempotent. Does not move money.
--
-- doctor_wallet_credit_transfers.reversed_cents stays the amount our refund
-- code already recorded. The webhook stamps reversal_reconciled_at and only
-- raises reversed_cents when Stripe's cumulative amount_reversed is ahead.

ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS stripe_dispute_id TEXT,
  ADD COLUMN IF NOT EXISTS stripe_dispute_status TEXT,
  ADD COLUMN IF NOT EXISTS stripe_dispute_amount_cents INT,
  ADD COLUMN IF NOT EXISTS stripe_dispute_reason TEXT,
  ADD COLUMN IF NOT EXISTS stripe_dispute_created_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS stripe_dispute_account_id TEXT,
  ADD COLUMN IF NOT EXISTS destination_transfer_reversed_cents INT,
  ADD COLUMN IF NOT EXISTS destination_transfer_reversed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS destination_transfer_reversal_reconciled_at TIMESTAMPTZ;

ALTER TABLE public.bookings
  DROP CONSTRAINT IF EXISTS bookings_destination_transfer_reversed_cents_chk;

ALTER TABLE public.bookings
  ADD CONSTRAINT bookings_destination_transfer_reversed_cents_chk
  CHECK (
    destination_transfer_reversed_cents IS NULL
    OR destination_transfer_reversed_cents >= 0
  );

ALTER TABLE public.bookings
  DROP CONSTRAINT IF EXISTS bookings_stripe_dispute_amount_cents_chk;

ALTER TABLE public.bookings
  ADD CONSTRAINT bookings_stripe_dispute_amount_cents_chk
  CHECK (
    stripe_dispute_amount_cents IS NULL
    OR stripe_dispute_amount_cents >= 0
  );

COMMENT ON COLUMN public.bookings.stripe_dispute_id IS
  'Stripe dispute id from charge.dispute.created. No refund is issued from the webhook.';
COMMENT ON COLUMN public.bookings.destination_transfer_reversed_cents IS
  'Cumulative cents Stripe reports reversed on stripe_destination_transfer_id.';
COMMENT ON COLUMN public.bookings.destination_transfer_reversed_at IS
  'Time of the latest destination-transfer reversal observed from Stripe.';

ALTER TABLE public.doctor_wallet_credit_transfers
  ADD COLUMN IF NOT EXISTS reversal_reconciled_at TIMESTAMPTZ;

COMMENT ON COLUMN public.doctor_wallet_credit_transfers.reversal_reconciled_at IS
  'Set when transfer.reversed was observed. reversed_cents is not incremented when it already covers Stripe amount_reversed.';

CREATE INDEX IF NOT EXISTS idx_bookings_stripe_charge_id
  ON public.bookings (stripe_charge_id)
  WHERE stripe_charge_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_bookings_stripe_destination_transfer_id
  ON public.bookings (stripe_destination_transfer_id)
  WHERE stripe_destination_transfer_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_wallet_credit_transfers_stripe_transfer_id
  ON public.doctor_wallet_credit_transfers (stripe_transfer_id)
  WHERE stripe_transfer_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.stripe_transfer_reversal_audits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  stripe_event_id TEXT NOT NULL,
  stripe_transfer_id TEXT NOT NULL,
  stripe_reversal_id TEXT,
  amount_reversed_cents INT NOT NULL CHECK (amount_reversed_cents >= 0),
  reversed_at TIMESTAMPTZ NOT NULL,
  booking_id UUID REFERENCES public.bookings(id) ON DELETE SET NULL,
  wallet_credit_transfer_id UUID REFERENCES public.doctor_wallet_credit_transfers(id) ON DELETE SET NULL,
  connected_account_id TEXT,
  match_kind TEXT NOT NULL CHECK (
    match_kind IN ('booking_destination', 'booking_reassignment', 'wallet_credit')
  ),
  already_recorded BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT stripe_transfer_reversal_audits_event_kind_uid
    UNIQUE (stripe_event_id, match_kind)
);

COMMENT ON TABLE public.stripe_transfer_reversal_audits IS
  'Webhook observation of transfer.reversed. Does not itself reverse a transfer.';

CREATE INDEX IF NOT EXISTS idx_stripe_transfer_reversal_audits_transfer
  ON public.stripe_transfer_reversal_audits (stripe_transfer_id, created_at DESC);

ALTER TABLE public.stripe_transfer_reversal_audits ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins read transfer reversal audits"
  ON public.stripe_transfer_reversal_audits;

CREATE POLICY "Admins read transfer reversal audits"
  ON public.stripe_transfer_reversal_audits
  FOR SELECT
  USING (public.rls_is_admin());
