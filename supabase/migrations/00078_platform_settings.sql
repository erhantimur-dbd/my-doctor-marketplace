-- Platform settings table for admin-configurable values
-- Used by review keyword filter, and extensible for future settings.

CREATE TABLE IF NOT EXISTS public.platform_settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  description TEXT,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Seed the default review blocked keywords
INSERT INTO public.platform_settings (key, value, description)
VALUES (
  'review_blocked_keywords',
  '["scam","fraud","fake","quack","incompetent","malpractice","negligent","disgusting","horrible","worst","useless","awful","terrible","rubbish","pathetic","sue","lawyer","lawsuit","solicitor","court","police","report you","buy now","click here","free trial","discount code","promo code","http://","https://","www."]',
  'JSON array of keywords that flag a review for manual moderation instead of auto-approval'
)
ON CONFLICT (key) DO NOTHING;

-- RLS: only service_role can read/write (admin actions use service role client)
ALTER TABLE public.platform_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access" ON public.platform_settings
  FOR ALL USING (auth.role() = 'service_role');
