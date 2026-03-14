-- Add visit summary fields to bookings table
ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS visit_summary TEXT,
  ADD COLUMN IF NOT EXISTS visit_summary_at TIMESTAMPTZ;
