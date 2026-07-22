-- Gift card pending→paid lifecycle + atomic wallet credit/debit/redeem
-- Fixes: unpaid gift cards redeemable; wallet double-spend races

-- ---------------------------------------------------------------------------
-- 1. Allow gift_cards.status = 'pending' (created before Stripe payment)
-- ---------------------------------------------------------------------------
ALTER TABLE public.gift_cards
  DROP CONSTRAINT IF EXISTS gift_cards_status_check;

ALTER TABLE public.gift_cards
  ADD CONSTRAINT gift_cards_status_check
    CHECK (status IN ('pending', 'active', 'redeemed', 'expired', 'cancelled'));

-- Unpaid cards that were incorrectly created as active become pending
UPDATE public.gift_cards
SET status = 'pending'
WHERE status = 'active'
  AND stripe_payment_intent_id IS NULL;

CREATE INDEX IF NOT EXISTS idx_gift_cards_status_pending
  ON public.gift_cards(status)
  WHERE status = 'pending';

-- ---------------------------------------------------------------------------
-- 2. Atomic wallet credit (upsert + ledger in one transaction)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.credit_wallet_atomic(
  p_patient_id uuid,
  p_currency text,
  p_amount_cents int,
  p_source_type text,
  p_source_booking_id uuid DEFAULT NULL,
  p_target_booking_id uuid DEFAULT NULL,
  p_description text DEFAULT NULL,
  p_expires_at timestamptz DEFAULT NULL
)
RETURNS TABLE(balance_cents int, transaction_id uuid)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_cur text := upper(p_currency);
  v_new_balance int;
  v_txn_id uuid;
BEGIN
  IF p_amount_cents IS NULL OR p_amount_cents <= 0 THEN
    RAISE EXCEPTION 'Credit amount must be positive';
  END IF;

  INSERT INTO public.patient_wallet (patient_id, currency, balance_cents, updated_at)
  VALUES (p_patient_id, v_cur, p_amount_cents, NOW())
  ON CONFLICT (patient_id, currency)
  DO UPDATE SET
    balance_cents = public.patient_wallet.balance_cents + EXCLUDED.balance_cents,
    updated_at = NOW()
  RETURNING public.patient_wallet.balance_cents INTO v_new_balance;

  INSERT INTO public.wallet_transactions (
    patient_id,
    type,
    amount_cents,
    currency,
    balance_after_cents,
    source_type,
    source_booking_id,
    target_booking_id,
    description,
    expires_at
  )
  VALUES (
    p_patient_id,
    'credit',
    p_amount_cents,
    v_cur,
    v_new_balance,
    p_source_type,
    p_source_booking_id,
    p_target_booking_id,
    p_description,
    p_expires_at
  )
  RETURNING id INTO v_txn_id;

  RETURN QUERY SELECT v_new_balance, v_txn_id;
END;
$$;

-- ---------------------------------------------------------------------------
-- 3. Atomic wallet debit (conditional balance update prevents overdraft races)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.debit_wallet_atomic(
  p_patient_id uuid,
  p_currency text,
  p_amount_cents int,
  p_source_type text,
  p_source_booking_id uuid DEFAULT NULL,
  p_target_booking_id uuid DEFAULT NULL,
  p_description text DEFAULT NULL
)
RETURNS TABLE(balance_cents int, transaction_id uuid)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_cur text := upper(p_currency);
  v_new_balance int;
  v_txn_id uuid;
BEGIN
  IF p_amount_cents IS NULL OR p_amount_cents <= 0 THEN
    RAISE EXCEPTION 'Debit amount must be positive';
  END IF;

  UPDATE public.patient_wallet
  SET
    balance_cents = public.patient_wallet.balance_cents - p_amount_cents,
    updated_at = NOW()
  WHERE patient_id = p_patient_id
    AND currency = v_cur
    AND balance_cents >= p_amount_cents
  RETURNING public.patient_wallet.balance_cents INTO v_new_balance;

  IF v_new_balance IS NULL THEN
    RAISE EXCEPTION 'Insufficient wallet balance';
  END IF;

  INSERT INTO public.wallet_transactions (
    patient_id,
    type,
    amount_cents,
    currency,
    balance_after_cents,
    source_type,
    source_booking_id,
    target_booking_id,
    description
  )
  VALUES (
    p_patient_id,
    'debit',
    p_amount_cents,
    v_cur,
    v_new_balance,
    p_source_type,
    p_source_booking_id,
    p_target_booking_id,
    p_description
  )
  RETURNING id INTO v_txn_id;

  RETURN QUERY SELECT v_new_balance, v_txn_id;
END;
$$;

-- ---------------------------------------------------------------------------
-- 4. Atomic gift-card redeem (claim row then credit wallet)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.redeem_gift_card_atomic(
  p_code text,
  p_patient_id uuid
)
RETURNS TABLE(
  amount_cents int,
  currency text,
  gift_card_code text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_gc public.gift_cards%ROWTYPE;
  v_code text := upper(trim(p_code));
BEGIN
  UPDATE public.gift_cards
  SET
    status = 'redeemed',
    redeemed_by = p_patient_id,
    redeemed_at = NOW()
  WHERE code = v_code
    AND status = 'active'
    AND (expires_at IS NULL OR expires_at > NOW())
  RETURNING * INTO v_gc;

  IF v_gc.id IS NULL THEN
    -- Distinguish expired vs invalid/already redeemed for clearer errors
    IF EXISTS (
      SELECT 1 FROM public.gift_cards g
      WHERE g.code = v_code
        AND g.status = 'active'
        AND g.expires_at IS NOT NULL
        AND g.expires_at <= NOW()
    ) THEN
      RAISE EXCEPTION 'GIFT_CARD_EXPIRED';
    END IF;
    RAISE EXCEPTION 'GIFT_CARD_INVALID';
  END IF;

  PERFORM public.credit_wallet_atomic(
    p_patient_id,
    v_gc.currency,
    v_gc.amount_cents,
    'gift_card',
    NULL,
    NULL,
    'Gift card ' || v_gc.code || ' redeemed',
    NULL
  );

  RETURN QUERY SELECT v_gc.amount_cents, v_gc.currency, v_gc.code::text;
END;
$$;

REVOKE ALL ON FUNCTION public.credit_wallet_atomic FROM PUBLIC;
REVOKE ALL ON FUNCTION public.debit_wallet_atomic FROM PUBLIC;
REVOKE ALL ON FUNCTION public.redeem_gift_card_atomic FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.credit_wallet_atomic TO service_role;
GRANT EXECUTE ON FUNCTION public.debit_wallet_atomic TO service_role;
GRANT EXECUTE ON FUNCTION public.redeem_gift_card_atomic TO service_role;
