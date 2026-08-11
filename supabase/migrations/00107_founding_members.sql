-- Founding Doctor Programme
-- First N doctors who complete registration get founding status, a permanent
-- number, and priority profile placement (is_featured) until launch ops
-- re-evaluate featured inventory.

-- ── Doctor flags ──────────────────────────────────────────────────────────
ALTER TABLE public.doctors
  ADD COLUMN IF NOT EXISTS is_founding_member BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE public.doctors
  ADD COLUMN IF NOT EXISTS founding_member_number INT;

-- Unique founding number when assigned (nulls allowed for non-founders)
CREATE UNIQUE INDEX IF NOT EXISTS idx_doctors_founding_member_number
  ON public.doctors (founding_member_number)
  WHERE founding_member_number IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_doctors_is_founding_member
  ON public.doctors (is_founding_member)
  WHERE is_founding_member = TRUE;

-- ── Singleton programme counter ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.founding_programme (
  id INT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  max_spots INT NOT NULL DEFAULT 100 CHECK (max_spots > 0),
  claimed_spots INT NOT NULL DEFAULT 0 CHECK (claimed_spots >= 0),
  is_open BOOLEAN NOT NULL DEFAULT TRUE,
  pricing_note TEXT NOT NULL DEFAULT
    'Founding pricing locked for life for the first 100 doctors who register.',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO public.founding_programme (id, max_spots, claimed_spots, is_open)
VALUES (1, 100, 0, TRUE)
ON CONFLICT (id) DO NOTHING;

-- Seed claimed_spots from any pre-existing founding flags (idempotent)
UPDATE public.founding_programme fp
SET
  claimed_spots = GREATEST(
    fp.claimed_spots,
    (SELECT COUNT(*)::INT FROM public.doctors d WHERE d.is_founding_member = TRUE)
  ),
  updated_at = now()
WHERE fp.id = 1;

ALTER TABLE public.founding_programme ENABLE ROW LEVEL SECURITY;

-- Public can read programme status (spots remaining on landing/pricing)
DROP POLICY IF EXISTS "Anyone can read founding programme" ON public.founding_programme;
CREATE POLICY "Anyone can read founding programme"
  ON public.founding_programme
  FOR SELECT
  USING (true);

-- Only service role / admin client mutates via RPC below
DROP POLICY IF EXISTS "Service role manages founding programme" ON public.founding_programme;
CREATE POLICY "Service role manages founding programme"
  ON public.founding_programme
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- ── Atomic claim ──────────────────────────────────────────────────────────
-- Returns founding number when claimed, or NULL when programme full / closed
-- or doctor already claimed. Safe under concurrent signups.
CREATE OR REPLACE FUNCTION public.claim_founding_member(p_doctor_id UUID)
RETURNS INT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_number INT;
  v_max INT;
  v_open BOOLEAN;
  v_existing INT;
BEGIN
  IF p_doctor_id IS NULL THEN
    RETURN NULL;
  END IF;

  -- Already a founding member?
  SELECT founding_member_number INTO v_existing
  FROM public.doctors
  WHERE id = p_doctor_id;

  IF FOUND AND v_existing IS NOT NULL THEN
    RETURN v_existing;
  END IF;

  -- Lock singleton row
  SELECT max_spots, is_open
  INTO v_max, v_open
  FROM public.founding_programme
  WHERE id = 1
  FOR UPDATE;

  IF NOT FOUND OR v_open IS NOT TRUE THEN
    RETURN NULL;
  END IF;

  -- Recompute claimed from flags to stay consistent
  SELECT COUNT(*)::INT INTO v_number
  FROM public.doctors
  WHERE is_founding_member = TRUE;

  IF v_number >= v_max THEN
    UPDATE public.founding_programme
    SET claimed_spots = v_number, is_open = FALSE, updated_at = now()
    WHERE id = 1;
    RETURN NULL;
  END IF;

  v_number := v_number + 1;

  UPDATE public.doctors
  SET
    is_founding_member = TRUE,
    founding_member_number = v_number,
    -- Priority profile placement for founding cohort
    is_featured = TRUE,
    featured_until = COALESCE(featured_until, '2099-12-31T23:59:59Z'::timestamptz)
  WHERE id = p_doctor_id
    AND is_founding_member = FALSE;

  IF NOT FOUND THEN
    -- Race: another claim won or doctor missing
    SELECT founding_member_number INTO v_existing
    FROM public.doctors WHERE id = p_doctor_id;
    RETURN v_existing;
  END IF;

  UPDATE public.founding_programme
  SET
    claimed_spots = v_number,
    is_open = (v_number < v_max),
    updated_at = now()
  WHERE id = 1;

  RETURN v_number;
END;
$$;

REVOKE ALL ON FUNCTION public.claim_founding_member(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.claim_founding_member(UUID) TO service_role;

COMMENT ON FUNCTION public.claim_founding_member(UUID) IS
  'Atomically assign founding member number (1..max_spots) and featured priority.';
