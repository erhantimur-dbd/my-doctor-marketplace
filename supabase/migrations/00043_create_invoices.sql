-- ─── Invoices ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS invoices (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_number    TEXT NOT NULL UNIQUE,
  doctor_id         UUID NOT NULL REFERENCES doctors(id) ON DELETE CASCADE,
  patient_id        UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  items             JSONB NOT NULL DEFAULT '[]',  -- [{name, price_cents, quantity}]
  subtotal_cents    INT NOT NULL DEFAULT 0,
  discount_type     TEXT CHECK (discount_type IN ('percentage', 'fixed_amount')),
  discount_value    INT,
  discount_cents    INT NOT NULL DEFAULT 0,
  platform_fee_cents INT NOT NULL DEFAULT 0,
  total_cents       INT NOT NULL DEFAULT 0,       -- what patient pays
  currency          TEXT NOT NULL DEFAULT 'EUR',
  status            TEXT NOT NULL DEFAULT 'sent' CHECK (status IN ('draft', 'sent', 'viewed', 'paid', 'overdue', 'cancelled')),
  due_date          DATE NOT NULL,
  doctor_note       TEXT,
  paid_at           TIMESTAMPTZ,
  stripe_session_id TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_invoices_doctor ON invoices (doctor_id);
CREATE INDEX IF NOT EXISTS idx_invoices_patient ON invoices (patient_id);
CREATE INDEX IF NOT EXISTS idx_invoices_status ON invoices (status);

-- Generate invoice number sequence
CREATE SEQUENCE IF NOT EXISTS invoice_number_seq START WITH 1001;

ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;

-- Doctors can manage their own invoices
DO $$ BEGIN
  CREATE POLICY "doctor_manage_invoices"
    ON invoices
    FOR ALL
    USING (
      doctor_id IN (SELECT id FROM doctors WHERE profile_id = auth.uid())
    );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Patients can read their own invoices
DO $$ BEGIN
  CREATE POLICY "patient_read_own_invoices"
    ON invoices
    FOR SELECT
    USING (patient_id = auth.uid());
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Auto-update updated_at
CREATE OR REPLACE TRIGGER update_invoices_updated_at
  BEFORE UPDATE ON invoices
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Allow platform_fees to track invoice fees (booking_id nullable)
ALTER TABLE platform_fees ALTER COLUMN booking_id DROP NOT NULL;
ALTER TABLE platform_fees ADD COLUMN IF NOT EXISTS invoice_id UUID REFERENCES invoices(id);

-- RPC to get next invoice number from sequence
CREATE OR REPLACE FUNCTION nextval_invoice_number()
RETURNS BIGINT
LANGUAGE sql
SECURITY DEFINER
AS $$ SELECT nextval('invoice_number_seq'); $$;
