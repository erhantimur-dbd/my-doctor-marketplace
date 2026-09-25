-- Stop storing plaintext natural-language search queries.
--
-- ai_search_cache was keyed by sha256(input) but also wrote the raw
-- query into input_text. Search text is often a symptom description.
-- The specialty-finder cache already dropped this column (00090).
-- Repeat lookups still use input_hash. parsed_filters stays.

ALTER TABLE public.ai_search_cache
  DROP COLUMN IF EXISTS input_text;
