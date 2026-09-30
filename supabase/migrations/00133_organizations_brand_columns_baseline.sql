-- Baseline for the nine brand_* columns already on public.organizations in
-- Production (Supabase project zlixmfcppzvbayyjymrv). They were added outside
-- the migration history, after 20260320185018 organizations_clinic_fields.
-- None of the history rows, and no earlier file in this directory, creates
-- them.
--
-- This must not change their types or defaults. ADD COLUMN IF NOT EXISTS
-- leaves an existing column untouched, so on Production the statement is a
-- no-op apart from the brief lock (the table has 14 rows). No constraints,
-- indexes, foreign keys, or comments.

ALTER TABLE public.organizations
  ADD COLUMN IF NOT EXISTS brand_display_name text NULL,
  ADD COLUMN IF NOT EXISTS brand_primary_color text DEFAULT '#0ea5e9',
  ADD COLUMN IF NOT EXISTS brand_secondary_color text DEFAULT '#0f172a',
  ADD COLUMN IF NOT EXISTS brand_accent_color text DEFAULT '#22c55e',
  ADD COLUMN IF NOT EXISTS brand_favicon_url text NULL,
  ADD COLUMN IF NOT EXISTS brand_custom_css text NULL,
  ADD COLUMN IF NOT EXISTS brand_hide_platform_badge boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS brand_support_email text NULL,
  ADD COLUMN IF NOT EXISTS brand_support_phone text NULL;
