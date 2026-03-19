-- Wallet expansion: top-up, gift cards, loyalty, promo expiry, new source types

-- 1. Expand wallet transaction source types
ALTER TABLE public.wallet_transactions
  DROP CONSTRAINT IF EXISTS wallet_transactions_source_type_check;
ALTER TABLE public.wallet_transactions
  ADD CONSTRAINT wallet_transactions_source_type_check
    CHECK (source_type IN (
      'refund', 'cancel_rebook', 'referral', 'promotion',
      'admin_manual', 'top_up', 'gift_card', 'loyalty'
    ));

-- 2. Add expiry support for promotional credits
ALTER TABLE public.wallet_transactions
  ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ;

-- 3. Gift cards table
CREATE TABLE public.gift_cards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code VARCHAR(16) NOT NULL UNIQUE,
  amount_cents INT NOT NULL CHECK (amount_cents > 0),
  currency TEXT NOT NULL,
  purchased_by UUID REFERENCES public.profiles(id),
  purchased_email TEXT,
  recipient_email TEXT,
  recipient_name TEXT,
  message TEXT,
  redeemed_by UUID REFERENCES public.profiles(id),
  redeemed_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'redeemed', 'expired', 'cancelled')),
  expires_at TIMESTAMPTZ,
  stripe_payment_intent_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.gift_cards ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Patients read own gift cards" ON public.gift_cards
  FOR SELECT USING (
    purchased_by = auth.uid() OR redeemed_by = auth.uid()
  );
CREATE POLICY "Admin manage gift cards" ON public.gift_cards
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );

CREATE INDEX idx_gift_cards_code ON public.gift_cards(code);
CREATE INDEX idx_gift_cards_status ON public.gift_cards(status) WHERE status = 'active';
CREATE INDEX idx_gift_cards_purchaser ON public.gift_cards(purchased_by);
