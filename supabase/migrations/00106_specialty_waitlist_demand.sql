-- Specialty waitlist: ensure table exists + place fields for recruitment demand signal
-- (Complements per-doctor availability_alerts. Guest doctor alerts live in 00105.)

CREATE TABLE IF NOT EXISTS public.specialty_waitlist (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  specialty_slug TEXT NOT NULL,
  patient_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  guest_email TEXT,
  guest_name TEXT,
  country_code TEXT,
  consultation_type TEXT,
  status TEXT NOT NULL DEFAULT 'active',
  last_notified_at TIMESTAMPTZ,
  notify_count INT NOT NULL DEFAULT 0,
  unsubscribe_token UUID NOT NULL DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT specialty_waitlist_identity_check
    CHECK (patient_id IS NOT NULL OR guest_email IS NOT NULL)
);

-- Demand / recruitment context
ALTER TABLE public.specialty_waitlist
  ADD COLUMN IF NOT EXISTS place_name TEXT,
  ADD COLUMN IF NOT EXISTS place_lat DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS place_lng DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS source TEXT DEFAULT 'search_empty';

CREATE UNIQUE INDEX IF NOT EXISTS idx_specialty_waitlist_patient_slug
  ON public.specialty_waitlist (patient_id, specialty_slug)
  WHERE patient_id IS NOT NULL AND status = 'active';

CREATE UNIQUE INDEX IF NOT EXISTS idx_specialty_waitlist_guest_slug
  ON public.specialty_waitlist (lower(guest_email), specialty_slug)
  WHERE guest_email IS NOT NULL AND status = 'active';

CREATE INDEX IF NOT EXISTS idx_specialty_waitlist_slug_active
  ON public.specialty_waitlist (specialty_slug)
  WHERE status = 'active';

CREATE INDEX IF NOT EXISTS idx_specialty_waitlist_demand
  ON public.specialty_waitlist (specialty_slug, country_code, place_name, created_at DESC)
  WHERE status = 'active';

CREATE UNIQUE INDEX IF NOT EXISTS idx_specialty_waitlist_unsub_token
  ON public.specialty_waitlist (unsubscribe_token);

ALTER TABLE public.specialty_waitlist ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS specialty_waitlist_select_own ON public.specialty_waitlist;
CREATE POLICY specialty_waitlist_select_own
  ON public.specialty_waitlist FOR SELECT
  TO authenticated
  USING (patient_id = auth.uid());

DROP POLICY IF EXISTS specialty_waitlist_update_own ON public.specialty_waitlist;
CREATE POLICY specialty_waitlist_update_own
  ON public.specialty_waitlist FOR UPDATE
  TO authenticated
  USING (patient_id = auth.uid());

DROP POLICY IF EXISTS specialty_waitlist_service_all ON public.specialty_waitlist;
CREATE POLICY specialty_waitlist_service_all
  ON public.specialty_waitlist FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

COMMENT ON TABLE public.specialty_waitlist IS
  'Specialty-level patient demand: notify when any doctor in the specialty opens slots; admin uses for recruiting.';
