-- Add dependent_name to bookings for display purposes.
-- dependent_id FK already exists from migration 00064.
ALTER TABLE bookings
ADD COLUMN IF NOT EXISTS dependent_name TEXT;
