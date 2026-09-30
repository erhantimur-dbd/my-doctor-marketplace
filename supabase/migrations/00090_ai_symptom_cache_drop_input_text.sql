-- Migration 00090 — drop raw input text from the specialty-finder cache.
--
-- UK CQC compliance workstream 3.4 requires that the specialty finder
-- treats requests and responses as ephemeral: no raw user input is
-- stored, because storing it would turn this feature into a medical
-- record. The cache row still exists (keyed by a sha256 hash of the
-- input) so repeat queries are fast, but the plaintext input is gone.
--
-- Prod still has ai_symptom_cache.input_text (about 56 rows). The imported
-- prod migrations enable RLS on this table and do not drop the column.
-- 00034 creates input_text, so a fresh replay still has it when this file
-- runs. DROP COLUMN IF EXISTS covers both.
--
-- This file does not copy the plaintext into another table or a backup
-- column. Before the drop it:
--   * nulls free-text jsonb keys (urgencyReason and the other names below)
--   * nulls any jsonb string equal to input_text, containing it, or longer
--     than 80 characters (specialty slugs and enums are shorter)
--   * drops input_text and leftover rename/backup column names
-- ai_search_cache.input_text is a different cache. 00120 drops that column.
-- This file does not read or write ai_search_cache.
--
-- The helper below is dropped in this same migration.

DROP FUNCTION IF EXISTS public._md360_scrub_symptom_json(jsonb, text);

CREATE FUNCTION public._md360_scrub_symptom_json(payload jsonb, raw text)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SET search_path = ''
AS $fn$
DECLARE
  key text;
  val jsonb;
  scrubbed jsonb;
  out jsonb;
  raw_text text;
  string_value text;
  denylist text[] := ARRAY[
    'urgencyreason',
    'urgency_reason',
    'input',
    'input_text',
    'inputtext',
    'raw',
    'raw_input',
    'query',
    'prompt',
    'description',
    'text',
    'user_input',
    'userinput',
    'symptom',
    'symptoms',
    'patient_input',
    'message'
  ];
BEGIN
  IF payload IS NULL THEN
    RETURN NULL;
  END IF;

  raw_text := btrim(coalesce(raw, ''));

  IF jsonb_typeof(payload) = 'object' THEN
    out := '{}'::jsonb;
    FOR key, val IN
      SELECT entry.key, entry.value
      FROM jsonb_each(payload) AS entry(key, value)
    LOOP
      IF lower(key) = ANY (denylist) THEN
        scrubbed := 'null'::jsonb;
      ELSE
        scrubbed := public._md360_scrub_symptom_json(val, raw);
      END IF;
      out := jsonb_set(out, ARRAY[key], coalesce(scrubbed, 'null'::jsonb), true);
    END LOOP;
    RETURN out;
  END IF;

  IF jsonb_typeof(payload) = 'array' THEN
    SELECT coalesce(
      jsonb_agg(public._md360_scrub_symptom_json(elem, raw)),
      '[]'::jsonb
    )
    INTO out
    FROM jsonb_array_elements(payload) AS elem;
    RETURN out;
  END IF;

  IF jsonb_typeof(payload) = 'string' THEN
    string_value := payload #>> '{}';
    IF raw_text <> '' AND (
      string_value = raw_text
      OR (
        char_length(raw_text) >= 8
        AND position(raw_text IN string_value) > 0
      )
    ) THEN
      RETURN 'null'::jsonb;
    END IF;
    IF char_length(string_value) > 80 THEN
      RETURN 'null'::jsonb;
    END IF;
    RETURN payload;
  END IF;

  RETURN payload;
END;
$fn$;

DO $purge$
DECLARE
  source_col text;
  jsonb_col text;
  candidate text;
  leftover bigint;
BEGIN
  source_col := NULL;
  FOREACH candidate IN ARRAY ARRAY[
    'input_text',
    'input_text_backup',
    'input_text_old',
    'raw_input',
    'symptom_text'
  ]
  LOOP
    IF EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'ai_symptom_cache'
        AND column_name = candidate
    ) THEN
      source_col := candidate;
      EXIT;
    END IF;
  END LOOP;

  FOR jsonb_col IN
    SELECT column_name
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'ai_symptom_cache'
      AND udt_name = 'jsonb'
  LOOP
    IF source_col IS NOT NULL THEN
      EXECUTE format(
        'UPDATE public.ai_symptom_cache SET %1$I = public._md360_scrub_symptom_json(%1$I, %2$I)',
        jsonb_col,
        source_col
      );
      EXECUTE format(
        'SELECT count(*) FROM public.ai_symptom_cache WHERE char_length(btrim(%1$I)) >= 8 AND strpos(%2$I::text, to_jsonb(%1$I)::text) > 0',
        source_col,
        jsonb_col
      ) INTO leftover;
      IF leftover > 0 THEN
        RAISE EXCEPTION
          'ai_symptom_cache.% still contains raw symptom text after scrub (% rows)',
          jsonb_col, leftover;
      END IF;
    ELSE
      EXECUTE format(
        'UPDATE public.ai_symptom_cache SET %1$I = public._md360_scrub_symptom_json(%1$I, NULL::text)',
        jsonb_col
      );
    END IF;
  END LOOP;
END
$purge$;

ALTER TABLE public.ai_symptom_cache DROP COLUMN IF EXISTS input_text;
ALTER TABLE public.ai_symptom_cache DROP COLUMN IF EXISTS input_text_backup;
ALTER TABLE public.ai_symptom_cache DROP COLUMN IF EXISTS input_text_old;
ALTER TABLE public.ai_symptom_cache DROP COLUMN IF EXISTS raw_input;
ALTER TABLE public.ai_symptom_cache DROP COLUMN IF EXISTS symptom_text;

DROP FUNCTION IF EXISTS public._md360_scrub_symptom_json(jsonb, text);
