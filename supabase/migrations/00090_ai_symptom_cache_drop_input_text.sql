-- Migration 00090 — drop raw input text from the specialty-finder cache.
--
-- UK CQC compliance workstream 3.4 requires that the specialty finder
-- treats requests and responses as ephemeral: no raw user input is
-- stored, because storing it would turn this feature into a medical
-- record. The cache row still exists (keyed by a sha256 hash of the
-- input) so repeat queries are fast, but the plaintext input is gone.
--
-- The equivalent search cache in `ai_search_cache` keeps its
-- `input_text` column for now — that cache is for natural-language
-- *search queries*, not for symptom descriptions, so it doesn't hold
-- health data the same way.

ALTER TABLE public.ai_symptom_cache
  DROP COLUMN IF EXISTS input_text;
