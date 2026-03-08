-- ─── Doctor Price Book ────────────────────────────────────────────
-- Stores per-doctor default prices for predefined medical tests
CREATE TABLE IF NOT EXISTS doctor_price_book (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  doctor_id   UUID NOT NULL REFERENCES doctors(id) ON DELETE CASCADE,
  test_id     TEXT NOT NULL,          -- matches MEDICAL_TEST_GROUPS ids, e.g. "test_cbc"
  price_cents INT  NOT NULL CHECK (price_cents >= 0),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (doctor_id, test_id)
);

CREATE INDEX IF NOT EXISTS idx_price_book_doctor ON doctor_price_book (doctor_id);

ALTER TABLE doctor_price_book ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "doctor_manage_own_price_book"
    ON doctor_price_book
    FOR ALL
    USING (
      doctor_id IN (
        SELECT id FROM doctors WHERE profile_id = auth.uid()
      )
    );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Auto-update updated_at
CREATE OR REPLACE TRIGGER update_price_book_updated_at
  BEFORE UPDATE ON doctor_price_book
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ─── Add items JSONB to follow_up_invitations ───────────────────
-- Stores line items: [{name, price_cents, quantity}]
-- Nullable for backward compat with existing single-service invitations
DO $$ BEGIN
  ALTER TABLE follow_up_invitations ADD COLUMN items JSONB;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;
