-- MD360 prod migration export (supabase_migrations.schema_migrations, project zlixmfcppzvbayyjymrv)
-- version: 20260304123012
-- name: enable_rls_on_unprotected_tables
-- statements joined with ';\n' in stored order; body below is verbatim (md5 8c51a41711e6df0b256840762ec48d8b)


-- ============================================================
-- Enable RLS on 4 unprotected public tables
-- ============================================================

-- 1. platform_settings — admin config (key/value pairs)
--    Read: anyone (needed by server actions via anon key)
--    Write: service_role only (no public INSERT/UPDATE/DELETE)
ALTER TABLE public.platform_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read access"
  ON public.platform_settings
  FOR SELECT
  USING (true);

-- 2. doctor_review_summaries — AI-generated review summaries shown on doctor profiles
--    Read: anyone (public-facing data)
--    Write: service_role only
ALTER TABLE public.doctor_review_summaries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read access"
  ON public.doctor_review_summaries
  FOR SELECT
  USING (true);

-- 3. ai_symptom_cache — internal cache for AI symptom parsing
--    Read/Write: service_role only (server actions use service_role client)
ALTER TABLE public.ai_symptom_cache ENABLE ROW LEVEL SECURITY;

-- No policies = fully locked to service_role only

-- 4. ai_search_cache — internal cache for AI search parsing
--    Read/Write: service_role only
ALTER TABLE public.ai_search_cache ENABLE ROW LEVEL SECURITY;

-- No policies = fully locked to service_role only
