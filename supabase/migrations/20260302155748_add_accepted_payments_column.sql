-- MD360 prod migration export (supabase_migrations.schema_migrations, project zlixmfcppzvbayyjymrv)
-- version: 20260302155748
-- name: add_accepted_payments_column
-- statements joined with ';\n' in stored order; body below is verbatim (md5 3d2adb71f9a9667eae4236e1b846f658)

ALTER TABLE public.doctors
  ADD COLUMN accepted_payments TEXT[] NOT NULL DEFAULT '{}';
