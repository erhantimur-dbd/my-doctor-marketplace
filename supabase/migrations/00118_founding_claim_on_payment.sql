-- Founding spot is claimed when payment succeeds, not when Checkout is created.
-- A pending reservation can hold a spot during Checkout and is released if
-- the session expires. Featured follows the subscription period.
-- pricing_note matches founding terms: the £99 price lasts while the plan is kept.

ALTER TABLE public.doctors
  ADD COLUMN IF NOT EXISTS welcome_email_sent_at TIMESTAMPTZ;

COMMENT ON COLUMN public.doctors.welcome_email_sent_at IS
  'When the doctor welcome email was sent after paid signup. Null means not sent.';

UPDATE public.founding_programme
SET
  pricing_note = '£99 a month for as long as you keep your Founding plan.',
  updated_at = now()
WHERE id = 1;

ALTER TABLE public.founding_programme
  ALTER COLUMN pricing_note SET DEFAULT
    '£99 a month for as long as you keep your Founding plan.';

CREATE TABLE IF NOT EXISTS public.founding_spot_reservations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  doctor_id UUID NOT NULL REFERENCES public.doctors(id) ON DELETE CASCADE,
  checkout_session_id TEXT,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'converted', 'released')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS founding_spot_reservations_one_pending
  ON public.founding_spot_reservations (doctor_id)
  WHERE status = 'pending';

ALTER TABLE public.founding_spot_reservations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Service role manages founding spot reservations"
  ON public.founding_spot_reservations;
CREATE POLICY "Service role manages founding spot reservations"
  ON public.founding_spot_reservations
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- Hold a spot without claiming it or marking the doctor featured.
CREATE OR REPLACE FUNCTION public.reserve_founding_spot(
  p_doctor_id UUID,
  p_checkout_session_id TEXT
) RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_max INT;
  v_open BOOLEAN;
  v_claimed INT;
  v_other_pending INT;
  v_existing_number INT;
BEGIN
  IF p_doctor_id IS NULL THEN
    RETURN FALSE;
  END IF;

  SELECT founding_member_number INTO v_existing_number
  FROM public.doctors
  WHERE id = p_doctor_id;

  IF FOUND AND v_existing_number IS NOT NULL THEN
    RETURN TRUE;
  END IF;

  PERFORM 1
  FROM public.founding_programme
  WHERE id = 1
  FOR UPDATE;

  SELECT max_spots, is_open INTO v_max, v_open
  FROM public.founding_programme
  WHERE id = 1;

  IF NOT FOUND OR v_open IS NOT TRUE THEN
    RETURN FALSE;
  END IF;

  UPDATE public.founding_spot_reservations
  SET
    checkout_session_id = COALESCE(p_checkout_session_id, checkout_session_id),
    updated_at = now()
  WHERE doctor_id = p_doctor_id
    AND status = 'pending';

  IF FOUND THEN
    RETURN TRUE;
  END IF;

  SELECT COUNT(*)::INT INTO v_claimed
  FROM public.doctors
  WHERE is_founding_member = TRUE;

  SELECT COUNT(*)::INT INTO v_other_pending
  FROM public.founding_spot_reservations
  WHERE status = 'pending'
    AND doctor_id <> p_doctor_id;

  IF v_claimed + v_other_pending >= v_max THEN
    RETURN FALSE;
  END IF;

  BEGIN
    INSERT INTO public.founding_spot_reservations (
      doctor_id, checkout_session_id, status
    ) VALUES (
      p_doctor_id, p_checkout_session_id, 'pending'
    );
  EXCEPTION WHEN unique_violation THEN
    UPDATE public.founding_spot_reservations
    SET
      checkout_session_id = COALESCE(p_checkout_session_id, checkout_session_id),
      updated_at = now()
    WHERE doctor_id = p_doctor_id
      AND status = 'pending';
  END;

  RETURN TRUE;
END;
$$;

-- Drop a pending hold. Does not unclaim a doctor who already paid.
CREATE OR REPLACE FUNCTION public.release_founding_spot_reservation(
  p_checkout_session_id TEXT DEFAULT NULL,
  p_doctor_id UUID DEFAULT NULL
) RETURNS INT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count INT;
BEGIN
  IF p_checkout_session_id IS NULL AND p_doctor_id IS NULL THEN
    RETURN 0;
  END IF;

  UPDATE public.founding_spot_reservations
  SET status = 'released', updated_at = now()
  WHERE status = 'pending'
    AND (
      (
        p_checkout_session_id IS NOT NULL
        AND checkout_session_id = p_checkout_session_id
      )
      OR (
        p_doctor_id IS NOT NULL
        AND doctor_id = p_doctor_id
        AND (
          p_checkout_session_id IS NULL
          OR checkout_session_id IS NULL
          OR checkout_session_id = p_checkout_session_id
        )
      )
    );

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

-- Replace the one-argument claim so featured_until comes from the caller.
DROP FUNCTION IF EXISTS public.claim_founding_member(UUID);

CREATE OR REPLACE FUNCTION public.claim_founding_member(
  p_doctor_id UUID,
  p_featured_until TIMESTAMPTZ DEFAULT NULL
) RETURNS INT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_number INT;
  v_max INT;
  v_open BOOLEAN;
  v_existing INT;
  v_has_hold BOOLEAN;
  v_other_pending INT;
BEGIN
  IF p_doctor_id IS NULL THEN
    RETURN NULL;
  END IF;

  SELECT founding_member_number INTO v_existing
  FROM public.doctors
  WHERE id = p_doctor_id;

  IF FOUND AND v_existing IS NOT NULL THEN
    -- A missing or past period end must not turn featured on. Null until
    -- is read as featured with no expiry by search, so leave the row alone.
    IF p_featured_until IS NOT NULL AND p_featured_until > now() THEN
      UPDATE public.doctors
      SET
        is_featured = TRUE,
        featured_until = p_featured_until
      WHERE id = p_doctor_id;
    END IF;

    UPDATE public.founding_spot_reservations
    SET status = 'converted', updated_at = now()
    WHERE doctor_id = p_doctor_id
      AND status = 'pending';

    RETURN v_existing;
  END IF;

  SELECT max_spots, is_open
  INTO v_max, v_open
  FROM public.founding_programme
  WHERE id = 1
  FOR UPDATE;

  IF NOT FOUND OR v_open IS NOT TRUE THEN
    RETURN NULL;
  END IF;

  SELECT COUNT(*)::INT INTO v_number
  FROM public.doctors
  WHERE is_founding_member = TRUE;

  SELECT EXISTS (
    SELECT 1
    FROM public.founding_spot_reservations
    WHERE doctor_id = p_doctor_id
      AND status = 'pending'
  ) INTO v_has_hold;

  SELECT COUNT(*)::INT INTO v_other_pending
  FROM public.founding_spot_reservations
  WHERE status = 'pending'
    AND doctor_id <> p_doctor_id;

  IF v_number >= v_max THEN
    UPDATE public.founding_programme
    SET claimed_spots = v_number, is_open = FALSE, updated_at = now()
    WHERE id = 1;
    RETURN NULL;
  END IF;

  IF NOT v_has_hold AND v_number + v_other_pending >= v_max THEN
    RETURN NULL;
  END IF;

  v_number := v_number + 1;

  UPDATE public.doctors
  SET
    is_founding_member = TRUE,
    founding_member_number = v_number,
    -- New claim: featured only with a future period end. A null end stays off.
    is_featured = (p_featured_until IS NOT NULL AND p_featured_until > now()),
    featured_until = CASE
      WHEN p_featured_until IS NOT NULL AND p_featured_until > now()
      THEN p_featured_until
      ELSE NULL
    END
  WHERE id = p_doctor_id
    AND is_founding_member = FALSE;

  IF NOT FOUND THEN
    SELECT founding_member_number INTO v_existing
    FROM public.doctors
    WHERE id = p_doctor_id;
    RETURN v_existing;
  END IF;

  UPDATE public.founding_spot_reservations
  SET status = 'converted', updated_at = now()
  WHERE doctor_id = p_doctor_id
    AND status = 'pending';

  UPDATE public.founding_programme
  SET
    claimed_spots = v_number,
    is_open = (v_number < v_max),
    updated_at = now()
  WHERE id = 1;

  RETURN v_number;
END;
$$;

REVOKE ALL ON FUNCTION public.reserve_founding_spot(UUID, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.reserve_founding_spot(UUID, TEXT) TO service_role;

REVOKE ALL ON FUNCTION public.release_founding_spot_reservation(TEXT, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.release_founding_spot_reservation(TEXT, UUID) TO service_role;

REVOKE ALL ON FUNCTION public.claim_founding_member(UUID, TIMESTAMPTZ) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.claim_founding_member(UUID, TIMESTAMPTZ) TO service_role;

COMMENT ON FUNCTION public.claim_founding_member(UUID, TIMESTAMPTZ) IS
  'Claim a founding spot after payment. Idempotent. featured_until is the subscription period, never a sentinel.';
