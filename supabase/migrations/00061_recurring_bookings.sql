-- =============================================
-- Migration: Recurring Bookings Support
-- =============================================

-- Add recurring booking columns to bookings table
ALTER TABLE bookings
ADD COLUMN IF NOT EXISTS recurring_group_id UUID,
ADD COLUMN IF NOT EXISTS recurrence_pattern TEXT CHECK (recurrence_pattern IN ('weekly', 'biweekly')),
ADD COLUMN IF NOT EXISTS recurrence_index INT;

-- Index for fast recurring group lookups
CREATE INDEX IF NOT EXISTS idx_bookings_recurring_group ON bookings(recurring_group_id)
WHERE recurring_group_id IS NOT NULL;

COMMENT ON COLUMN bookings.recurring_group_id IS 'Shared UUID linking all bookings in a recurring series';
COMMENT ON COLUMN bookings.recurrence_pattern IS 'Recurrence frequency: weekly or biweekly';
COMMENT ON COLUMN bookings.recurrence_index IS '0-based index of this booking within the recurring series';
