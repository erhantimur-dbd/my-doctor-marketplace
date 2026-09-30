-- UK launch currency. Idempotent.
--
-- organizations.country is free text (the org form validates a 2-letter code)
-- but doctor sign-up does not write it, so production rows have country null.
-- UK is stored on doctors.practising_country = 'GB'. Match that, and also
-- organizations.country = 'GB' when it is set.
--
-- Confirm the row count before applying:
--   SELECT count(*)
--   FROM public.organizations o
--   WHERE o.base_currency = 'EUR'
--     AND (
--       upper(btrim(o.country)) = 'GB'
--       OR EXISTS (
--         SELECT 1
--         FROM public.doctors d
--         WHERE d.organization_id = o.id
--           AND upper(btrim(d.practising_country)) = 'GB'
--       )
--     );
-- Audited on production (mydoctor-marketplace) on 30 Sep 2026: 1 row.
-- organizations.country = 'GB' alone matched 0, because every org country was null.

UPDATE public.organizations AS o
SET
  base_currency = 'GBP',
  updated_at = now()
WHERE o.base_currency = 'EUR'
  AND (
    upper(btrim(o.country)) = 'GB'
    OR EXISTS (
      SELECT 1
      FROM public.doctors AS d
      WHERE d.organization_id = o.id
        AND upper(btrim(d.practising_country)) = 'GB'
    )
  );

ALTER TABLE public.organizations
  ALTER COLUMN base_currency SET DEFAULT 'GBP';
