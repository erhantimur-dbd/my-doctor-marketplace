-- Track how much of each consult payment part has already been returned.
-- Wallet-destination card refunds claw the Connect transfer and credit the
-- wallet without Stripe-refunding the PaymentIntent; without these counters
-- a later bank refund would pay the card again.
ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS card_refunded_to_card_cents INT NOT NULL DEFAULT 0
    CHECK (card_refunded_to_card_cents >= 0),
  ADD COLUMN IF NOT EXISTS card_credited_to_wallet_cents INT NOT NULL DEFAULT 0
    CHECK (card_credited_to_wallet_cents >= 0),
  ADD COLUMN IF NOT EXISTS credit_refunded_cents INT NOT NULL DEFAULT 0
    CHECK (credit_refunded_cents >= 0);

COMMENT ON COLUMN public.bookings.card_refunded_to_card_cents IS
  'Card cents already Stripe-refunded to the patient card.';
COMMENT ON COLUMN public.bookings.card_credited_to_wallet_cents IS
  'Card cents credited to the patient wallet (destination clawback). Not Stripe-refundable.';
COMMENT ON COLUMN public.bookings.credit_refunded_cents IS
  'MyDoctors360 credit cents already returned to the patient wallet.';
