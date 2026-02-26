-- ============================================================================
-- Migration 00022: Review Moderation
-- ============================================================================
-- Change reviews.is_visible default from TRUE to FALSE so new reviews
-- require admin approval before appearing on doctor profiles.
-- Existing visible reviews are NOT affected.
-- ============================================================================

ALTER TABLE public.reviews ALTER COLUMN is_visible SET DEFAULT FALSE;

NOTIFY pgrst, 'reload schema';
