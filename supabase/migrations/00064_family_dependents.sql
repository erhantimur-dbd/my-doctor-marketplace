-- =============================================
-- Migration: Family/Group Accounts (Dependents)
-- =============================================

CREATE TABLE IF NOT EXISTS dependents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  parent_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  date_of_birth DATE,
  relationship TEXT NOT NULL CHECK (relationship IN ('child', 'spouse', 'parent', 'sibling', 'other')),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_dependents_parent ON dependents(parent_id);

-- Add dependent reference to bookings
ALTER TABLE bookings
ADD COLUMN IF NOT EXISTS dependent_id UUID REFERENCES dependents(id);

-- RLS
ALTER TABLE dependents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "dependents_own" ON dependents
  FOR ALL USING (parent_id = auth.uid());
