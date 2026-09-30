-- Migration 00090 — drop raw input text from the specialty-finder cache.
--
-- UK CQC compliance workstream 3.4 requires that the specialty finder
-- treats requests and responses as ephemeral: no raw user input is
-- stored, because storing it would turn this feature into a medical
-- record. The cache is regenerable (keyed by a sha256 hash of the
-- input), so this file deletes every row and then drops the plaintext
-- columns so a later write cannot store raw text again.
--
-- Prod still has ai_symptom_cache.input_text. The imported prod
-- migrations enable RLS on this table and do not drop the column.
-- 00034 creates input_text, so a fresh replay still has it when this
-- file runs. DROP COLUMN IF EXISTS covers both. A second apply deletes
-- zero rows and the column drops are no-ops.
--
-- This file does not scrub jsonb and does not create a helper function.
-- Any earlier copy of public._md360_scrub_symptom_json is dropped and
-- not replaced. ai_search_cache.input_text is a different cache. 00120
-- drops that column. This file does not read or write ai_search_cache.
--
-- Access is service_role only. 00070 grants authenticated a SELECT
-- policy, and prod's 20260308011124 adds a service_role policy under a
-- different name. Every policy is dropped here, then one service_role
-- policy is created. anon and authenticated lose table privileges.
-- On a fresh replay, 20260308011124 runs after the numbered files and
-- adds "Service role manages ai_symptom_cache" again. That policy is
-- also FOR ALL TO service_role. It does not grant anon or authenticated.

DROP FUNCTION IF EXISTS public._md360_scrub_symptom_json(jsonb, text);

DO $purge$
DECLARE
  v_before bigint;
  v_after bigint;
BEGIN
  IF to_regclass('public.ai_symptom_cache') IS NULL THEN
    RAISE EXCEPTION 'public.ai_symptom_cache does not exist';
  END IF;

  SELECT count(*) INTO v_before FROM public.ai_symptom_cache;
  RAISE NOTICE 'ai_symptom_cache row count before delete: %', v_before;

  DELETE FROM public.ai_symptom_cache;

  SELECT count(*) INTO v_after FROM public.ai_symptom_cache;
  RAISE NOTICE 'ai_symptom_cache row count after delete: %', v_after;

  IF v_after <> 0 THEN
    RAISE EXCEPTION
      'ai_symptom_cache still has % rows after delete', v_after;
  END IF;
END
$purge$;

ALTER TABLE public.ai_symptom_cache DROP COLUMN IF EXISTS input_text;
ALTER TABLE public.ai_symptom_cache DROP COLUMN IF EXISTS input_text_backup;
ALTER TABLE public.ai_symptom_cache DROP COLUMN IF EXISTS input_text_old;
ALTER TABLE public.ai_symptom_cache DROP COLUMN IF EXISTS raw_input;
ALTER TABLE public.ai_symptom_cache DROP COLUMN IF EXISTS symptom_text;

-- ===================== service_role only =====================
ALTER TABLE public.ai_symptom_cache ENABLE ROW LEVEL SECURITY;

DO $policies$
DECLARE
  pol record;
BEGIN
  FOR pol IN
    SELECT policyname
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'ai_symptom_cache'
  LOOP
    EXECUTE format(
      'DROP POLICY IF EXISTS %I ON public.ai_symptom_cache',
      pol.policyname
    );
  END LOOP;
END
$policies$;

DROP POLICY IF EXISTS ai_symptom_cache_service_role ON public.ai_symptom_cache;
CREATE POLICY ai_symptom_cache_service_role
  ON public.ai_symptom_cache
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

REVOKE ALL ON TABLE public.ai_symptom_cache FROM PUBLIC, anon, authenticated;
GRANT ALL ON TABLE public.ai_symptom_cache TO service_role;
