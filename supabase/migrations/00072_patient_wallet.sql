-- Patient wallet for instant refund credits and cancel-rebook flows
-- Eliminates 3-5 day bank refund delay by crediting patient accounts

-- Wallet balance per patient per currency
CREATE TABLE public.patient_wallet (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  currency TEXT NOT NULL,
  balance_cents INT NOT NULL DEFAULT 0 CHECK (balance_cents >= 0),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(patient_id, currency)
);

-- Transaction ledger (immutable audit trail)
CREATE TABLE public.wallet_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID NOT NULL REFERENCES public.profiles(id),
  type TEXT NOT NULL CHECK (type IN ('credit', 'debit')),
  amount_cents INT NOT NULL CHECK (amount_cents > 0),
  currency TEXT NOT NULL,
  balance_after_cents INT NOT NULL,
  source_type TEXT NOT NULL CHECK (source_type IN (
    'refund', 'cancel_rebook', 'referral', 'promotion', 'admin_manual'
  )),
  source_booking_id UUID REFERENCES public.bookings(id),
  target_booking_id UUID REFERENCES public.bookings(id),
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Add wallet credit tracking to bookings
ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS wallet_credit_applied_cents INT DEFAULT 0;

-- RLS
ALTER TABLE public.patient_wallet ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wallet_transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Patients read own wallet" ON public.patient_wallet
  FOR SELECT USING (patient_id = auth.uid());
CREATE POLICY "Admin manage wallets" ON public.patient_wallet
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "Patients read own transactions" ON public.wallet_transactions
  FOR SELECT USING (patient_id = auth.uid());
CREATE POLICY "Admin manage transactions" ON public.wallet_transactions
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- Indexes
CREATE INDEX idx_wallet_patient ON public.patient_wallet(patient_id);
CREATE INDEX idx_wallet_txn_patient ON public.wallet_transactions(patient_id, created_at DESC);
CREATE INDEX idx_wallet_txn_source ON public.wallet_transactions(source_booking_id);
CREATE INDEX idx_wallet_txn_target ON public.wallet_transactions(target_booking_id);
