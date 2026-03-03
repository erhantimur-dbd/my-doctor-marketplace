-- AI Features: cache tables, review summaries, and sentiment data
-- =============================================================

-- 1. AI Symptom Cache (30-day TTL)
CREATE TABLE IF NOT EXISTS public.ai_symptom_cache (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  input_hash TEXT NOT NULL UNIQUE,
  input_text TEXT NOT NULL,
  locale TEXT NOT NULL DEFAULT 'en',
  result JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT NOW() + INTERVAL '30 days'
);

CREATE INDEX IF NOT EXISTS idx_ai_symptom_cache_hash
  ON public.ai_symptom_cache(input_hash);
CREATE INDEX IF NOT EXISTS idx_ai_symptom_cache_expires
  ON public.ai_symptom_cache(expires_at);

-- 2. AI Search Cache (1-hour TTL)
CREATE TABLE IF NOT EXISTS public.ai_search_cache (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  input_hash TEXT NOT NULL UNIQUE,
  input_text TEXT NOT NULL,
  locale TEXT NOT NULL DEFAULT 'en',
  parsed_filters JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT NOW() + INTERVAL '1 hour'
);

CREATE INDEX IF NOT EXISTS idx_ai_search_cache_hash
  ON public.ai_search_cache(input_hash);

-- 3. Doctor Review Summaries (AI-generated)
CREATE TABLE IF NOT EXISTS public.doctor_review_summaries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  doctor_id UUID NOT NULL UNIQUE REFERENCES public.doctors(id) ON DELETE CASCADE,
  summary_text TEXT NOT NULL,
  sentiment_tags TEXT[] DEFAULT '{}',
  overall_sentiment TEXT DEFAULT 'positive',
  review_count_at_generation INT NOT NULL DEFAULT 0,
  generated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_review_summaries_doctor
  ON public.doctor_review_summaries(doctor_id);

-- 4. Add sentiment tags column to doctors table for Smart Match scoring
ALTER TABLE public.doctors
  ADD COLUMN IF NOT EXISTS ai_sentiment_tags TEXT[] DEFAULT '{}';
