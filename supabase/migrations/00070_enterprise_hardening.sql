-- ============================================================
-- Enterprise Hardening: Phase 1
-- 1. Enable RLS on unprotected tables
-- 2. Webhook idempotency tracking
-- 3. Terms/privacy acceptance tracking
-- ============================================================

-- 1. ENABLE RLS ON UNPROTECTED TABLES

-- platform_settings: admin-only read/write
ALTER TABLE public.platform_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage platform settings" ON public.platform_settings
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "Authenticated users can read platform settings" ON public.platform_settings
  FOR SELECT USING (auth.uid() IS NOT NULL);

-- ai_symptom_cache: read-only for authenticated, admin-manage
ALTER TABLE public.ai_symptom_cache ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can read ai symptom cache" ON public.ai_symptom_cache
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "Service role manages ai symptom cache" ON public.ai_symptom_cache
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- ai_search_cache: read-only for authenticated, admin-manage
ALTER TABLE public.ai_search_cache ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can read ai search cache" ON public.ai_search_cache
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "Service role manages ai search cache" ON public.ai_search_cache
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- doctor_review_summaries: public read, admin write
ALTER TABLE public.doctor_review_summaries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public can read review summaries" ON public.doctor_review_summaries
  FOR SELECT USING (true);

CREATE POLICY "Admins can manage review summaries" ON public.doctor_review_summaries
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- 2. WEBHOOK IDEMPOTENCY TABLE
-- Prevents duplicate processing of Stripe events on retry

CREATE TABLE IF NOT EXISTS public.processed_webhook_events (
  event_id TEXT PRIMARY KEY,
  event_type TEXT NOT NULL,
  processed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Auto-cleanup events older than 72 hours (Stripe retries for up to 3 days)
CREATE INDEX IF NOT EXISTS idx_processed_webhooks_processed_at
  ON public.processed_webhook_events(processed_at);

-- RLS: only service role should access this table
ALTER TABLE public.processed_webhook_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can read processed webhooks" ON public.processed_webhook_events
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- 3. TERMS / PRIVACY ACCEPTANCE TRACKING

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS terms_accepted_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS privacy_accepted_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS terms_version TEXT;
