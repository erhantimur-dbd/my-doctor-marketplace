-- Doctor share of a consult paid with MyDoctors360 wallet or gift-card credit.
--
-- The card portion is a destination charge. This row is the separate
-- platform-balance Transfer for (credit amount − 15% commission).
--
-- amount_cents is what the doctor was transferred.
-- credit_amount_cents is the wallet credit the patient spent.
-- commission_cents is the platform's 15% of that credit only
-- (amount_cents + commission_cents = credit_amount_cents).
-- The whole-booking commission (card 15% + credit 15%) stays on
-- bookings.commission_cents.
--
-- Activity statements read statement_line:
-- 'Paid with MyDoctors360 credit'.

CREATE TABLE public.doctor_wallet_credit_transfers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id UUID NOT NULL UNIQUE REFERENCES public.bookings(id) ON DELETE CASCADE,
  doctor_id UUID NOT NULL REFERENCES public.doctors(id),
  amount_cents INT NOT NULL CHECK (amount_cents > 0),
  credit_amount_cents INT NOT NULL CHECK (credit_amount_cents > 0),
  commission_cents INT NOT NULL CHECK (commission_cents >= 0),
  stripe_transfer_id TEXT,
  -- pending: claimed before any Stripe transfer. A failed transfer stays
  -- pending so wallet-credit-share-{bookingId} can be retried. We do not
  -- use a separate failed status.
  status TEXT NOT NULL CHECK (
    status IN ('pending', 'paid', 'reversed', 'partially_reversed')
  ),
  statement_line TEXT NOT NULL DEFAULT 'Paid with MyDoctors360 credit',
  currency TEXT NOT NULL,
  reversed_cents INT NOT NULL DEFAULT 0 CHECK (reversed_cents >= 0),
  kind TEXT NOT NULL DEFAULT 'wallet_credit_share',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT doctor_wallet_credit_transfers_split_chk
    CHECK (amount_cents + commission_cents = credit_amount_cents),
  CONSTRAINT doctor_wallet_credit_transfers_reversed_chk
    CHECK (reversed_cents <= amount_cents)
);

COMMENT ON TABLE public.doctor_wallet_credit_transfers IS
  'Doctor share of consult credit (wallet or gift card). Activity statements read statement_line ''Paid with MyDoctors360 credit''.';

COMMENT ON COLUMN public.doctor_wallet_credit_transfers.amount_cents IS
  'Cents transferred to the doctor: credit_amount_cents minus commission_cents.';
COMMENT ON COLUMN public.doctor_wallet_credit_transfers.credit_amount_cents IS
  'MyDoctors360 wallet or gift-card credit applied to the consult.';
COMMENT ON COLUMN public.doctor_wallet_credit_transfers.commission_cents IS
  'Platform commission on the credit portion only, not the card portion.';
COMMENT ON COLUMN public.doctor_wallet_credit_transfers.statement_line IS
  'Paid with MyDoctors360 credit';
COMMENT ON COLUMN public.doctor_wallet_credit_transfers.status IS
  'pending until Stripe accepts the transfer, then paid. A failed create leaves pending for a same-key retry. reversed and partially_reversed are refunds.';

CREATE INDEX doctor_wallet_credit_transfers_doctor_created
  ON public.doctor_wallet_credit_transfers (doctor_id, created_at DESC);

ALTER TABLE public.doctor_wallet_credit_transfers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Doctors read own wallet credit transfers"
  ON public.doctor_wallet_credit_transfers
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM public.doctors d
      WHERE d.id = doctor_wallet_credit_transfers.doctor_id
        AND d.profile_id = auth.uid()
    )
  );

CREATE POLICY "Admins read wallet credit transfers"
  ON public.doctor_wallet_credit_transfers
  FOR SELECT
  USING (public.rls_is_admin());
