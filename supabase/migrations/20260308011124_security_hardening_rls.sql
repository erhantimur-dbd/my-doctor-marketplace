-- MD360 prod migration export (supabase_migrations.schema_migrations, project zlixmfcppzvbayyjymrv)
-- version: 20260308011124
-- name: security_hardening_rls
-- statements joined with ';\n' in stored order; body below is verbatim (md5 9a3cd203f27a3d7f3ea4d52dffaa3929)

-- 1. Enable RLS on AI cache tables (restrict to service_role only)
ALTER TABLE IF EXISTS public.ai_symptom_cache ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.ai_search_cache ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.doctor_review_summaries ENABLE ROW LEVEL SECURITY;

-- AI caches: only service_role can read/write
DO $$ BEGIN
  CREATE POLICY "Service role manages ai_symptom_cache" ON public.ai_symptom_cache
    FOR ALL TO service_role USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "Service role manages ai_search_cache" ON public.ai_search_cache
    FOR ALL TO service_role USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Review summaries: anyone can read (public data), only service_role can write
DO $$ BEGIN
  CREATE POLICY "Anyone can read review summaries" ON public.doctor_review_summaries
    FOR SELECT USING (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "Service role manages review summaries" ON public.doctor_review_summaries
    FOR ALL TO service_role USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- 2. Enable RLS on platform_settings (admin-only)
ALTER TABLE IF EXISTS public.platform_settings ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "Admins manage platform_settings" ON public.platform_settings
    FOR ALL USING (public.rls_is_admin());
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "Anyone can read platform_settings" ON public.platform_settings
    FOR SELECT USING (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- 3. Tighten treatment_plans: replace "Anyone can read by token" with token-scoped read
DROP POLICY IF EXISTS "Anyone can read by token" ON public.treatment_plans;

DO $$ BEGIN
  CREATE POLICY "Doctors read own treatment plans" ON public.treatment_plans
    FOR SELECT USING (
      doctor_id IN (SELECT id FROM public.doctors WHERE profile_id = auth.uid())
      OR patient_id = auth.uid()
    );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Service role can read by token (for public invitation pages)
DO $$ BEGIN
  CREATE POLICY "Service role reads treatment plans" ON public.treatment_plans
    FOR ALL TO service_role USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- 4. Tighten follow_up_invitations: replace open read with scoped read
DROP POLICY IF EXISTS "read_invitations" ON public.follow_up_invitations;

DO $$ BEGIN
  CREATE POLICY "Participants read invitations" ON public.follow_up_invitations
    FOR SELECT USING (
      patient_id = auth.uid()
      OR doctor_id IN (SELECT id FROM public.doctors WHERE profile_id = auth.uid())
    );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "Service role manages invitations" ON public.follow_up_invitations
    FOR ALL TO service_role USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
