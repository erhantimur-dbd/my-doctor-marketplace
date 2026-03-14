-- Cookie consent tracking for GDPR compliance
CREATE TABLE IF NOT EXISTS public.cookie_consents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  anonymous_id TEXT,                       -- fingerprint for non-logged-in visitors
  analytics BOOLEAN NOT NULL DEFAULT FALSE,
  marketing BOOLEAN NOT NULL DEFAULT FALSE,
  consent_given_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id)
);

-- Index for fast anonymous-id lookups
CREATE INDEX IF NOT EXISTS idx_cookie_consents_anonymous
  ON public.cookie_consents(anonymous_id)
  WHERE anonymous_id IS NOT NULL;

ALTER TABLE public.cookie_consents ENABLE ROW LEVEL SECURITY;

-- Authenticated users manage their own consent row
CREATE POLICY "Users manage own cookie consent"
  ON public.cookie_consents FOR ALL
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Anonymous consent rows: anyone can insert (checked server-side)
CREATE POLICY "Anonymous consent insert"
  ON public.cookie_consents FOR INSERT
  WITH CHECK (user_id IS NULL);

-- Service-role full access (for admin/cron cleanup)
CREATE POLICY "Service role full access on cookie_consents"
  ON public.cookie_consents FOR ALL
  USING (auth.jwt() ->> 'role' = 'service_role');
