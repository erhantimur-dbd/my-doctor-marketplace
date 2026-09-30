-- New doctor rows default to GBP. Idempotent.
-- No data backfill. A doctor's stored charge currency stays as it is.
-- Consult checkout keeps using that amount and currency.

ALTER TABLE public.doctors
  ALTER COLUMN base_currency SET DEFAULT 'GBP';
