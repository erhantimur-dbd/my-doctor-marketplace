-- Payment corrections. Automated jobs may flag a row. They never move money.
-- Money movement runs only from admin actions after named approvals.
-- Nothing in this migration charges a card.

CREATE TABLE public.payment_correction_approvers (
  profile_id UUID PRIMARY KEY REFERENCES public.profiles(id),
  director BOOLEAN NOT NULL DEFAULT FALSE,
  named_by UUID REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.payment_correction_approvers IS
  'Named people who may approve a payment correction. Seed is empty; the CTO inserts approvers after deploy.';
COMMENT ON COLUMN public.payment_correction_approvers.director IS
  'A doctor-escalated dispute needs at least one approval from a director, whatever required_approvals says.';

CREATE TABLE public.payment_corrections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  party TEXT NOT NULL CHECK (party IN ('patient', 'doctor')),
  patient_id UUID REFERENCES public.profiles(id),
  doctor_id UUID REFERENCES public.doctors(id),
  direction TEXT NOT NULL CHECK (direction IN ('customer_favour', 'platform_favour')),
  amount_cents INT NOT NULL CHECK (amount_cents > 0),
  currency TEXT NOT NULL CHECK (char_length(currency) = 3),
  disputed_amount_cents INT NOT NULL DEFAULT 0,
  reason TEXT NOT NULL,
  error_type TEXT NOT NULL CHECK (error_type IN (
    'duplicate_payout',
    'over_transfer',
    'double_refund',
    'platform_fee',
    'wrong_account',
    'patient_overcharge',
    'patient_credit_in_error',
    'founding_payment',
    'other',
    'fraud'
  )),
  booking_id UUID REFERENCES public.bookings(id),
  license_id UUID REFERENCES public.licenses(id),
  stripe_charge_id TEXT,
  stripe_payment_intent_id TEXT,
  stripe_transfer_id TEXT,
  stripe_refund_id TEXT,
  stripe_payout_id TEXT,
  stripe_invoice_id TEXT,
  stripe_subscription_id TEXT,
  related_payment_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'flagged' CHECK (status IN (
    'flagged', 'notified', 'disputed', 'approved', 'recovering', 'settled', 'waived'
  )),
  source TEXT NOT NULL DEFAULT 'admin' CHECK (source IN ('admin', 'webhook')),
  created_by UUID REFERENCES public.profiles(id),
  required_approvals SMALLINT NOT NULL DEFAULT 1 CHECK (required_approvals >= 1),
  notice_sent_at TIMESTAMPTZ,
  earliest_recovery_at TIMESTAMPTZ,
  clear_risk BOOLEAN NOT NULL DEFAULT FALSE,
  clear_risk_reason_code TEXT CHECK (
    clear_risk_reason_code IS NULL
    OR clear_risk_reason_code IN ('account_closing', 'suspected_fraud', 'insolvency')
  ),
  clear_risk_reason TEXT,
  escalated_by_doctor_at TIMESTAMPTZ,
  disputed_at TIMESTAMPTZ,
  dispute_reason TEXT,
  dispute_reply_due_at TIMESTAMPTZ,
  dispute_findings TEXT,
  dispute_resolved_at TIMESTAMPTZ,
  dispute_outcome TEXT CHECK (
    dispute_outcome IS NULL OR dispute_outcome IN ('customer_wins', 'correction_upheld')
  ),
  director_reviewed_by UUID REFERENCES public.profiles(id),
  director_reviewed_at TIMESTAMPTZ,
  recovery_method TEXT CHECK (
    recovery_method IS NULL OR recovery_method IN (
      'transfer_reversal',
      'payout_offset',
      'direct_request',
      'patient_refund',
      'wallet_adjustment',
      'doctor_topup'
    )
  ),
  recovery_step SMALLINT CHECK (recovery_step IS NULL OR recovery_step IN (1, 2, 3)),
  customer_response TEXT,
  customer_responded_at TIMESTAMPTZ,
  settled_at TIMESTAMPTZ,
  our_error BOOLEAN NOT NULL DEFAULT FALSE,
  statement_line TEXT NOT NULL,
  direct_request_sent_at TIMESTAMPTZ,
  direct_request_due_at TIMESTAMPTZ,
  offset_remaining_cents INT NOT NULL DEFAULT 0 CHECK (offset_remaining_cents >= 0),
  recovered_cents INT NOT NULL DEFAULT 0 CHECK (recovered_cents >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT payment_corrections_party_chk CHECK (
    (party = 'patient' AND patient_id IS NOT NULL)
    OR (party = 'doctor' AND doctor_id IS NOT NULL)
  ),
  CONSTRAINT payment_corrections_disputed_amount_chk CHECK (
    disputed_amount_cents >= 0 AND disputed_amount_cents <= amount_cents
  ),
  CONSTRAINT payment_corrections_creator_chk CHECK (
    created_by IS NOT NULL OR source = 'webhook'
  ),
  CONSTRAINT payment_corrections_twelve_months_chk CHECK (
    error_type = 'fraud'
    OR (
      related_payment_at IS NOT NULL
      AND created_at <= related_payment_at + INTERVAL '12 months'
    )
  ),
  CONSTRAINT payment_corrections_clear_risk_chk CHECK (
    (
      clear_risk = FALSE
      AND clear_risk_reason_code IS NULL
    )
    OR (
      clear_risk = TRUE
      AND party = 'doctor'
      AND clear_risk_reason_code IN ('account_closing', 'suspected_fraud', 'insolvency')
      AND clear_risk_reason IS NOT NULL
      AND length(btrim(clear_risk_reason)) > 0
    )
  ),
  CONSTRAINT payment_corrections_earliest_recovery_chk CHECK (
    earliest_recovery_at IS NULL
    OR (
      notice_sent_at IS NOT NULL
      AND (
        earliest_recovery_at >= notice_sent_at + INTERVAL '14 days'
        OR (
          clear_risk = TRUE
          AND party = 'doctor'
          AND earliest_recovery_at >= notice_sent_at
        )
      )
    )
  )
);

COMMENT ON TABLE public.payment_corrections IS
  'One payment error. Recovery never charges a patient card. Doctor recovery order is transfer reversal, then offset from future payouts, then a direct request.';
COMMENT ON COLUMN public.payment_corrections.clear_risk_reason_code IS
  'account_closing covers Stripe closing or restricting the doctor connected account. Doctor corrections only.';
COMMENT ON COLUMN public.payment_corrections.required_approvals IS
  'Distinct named approvers, excluding the creator, required before money moves.';
COMMENT ON COLUMN public.payment_corrections.offset_remaining_cents IS
  'Cents still to deduct from a later destination-charge application fee or wallet-credit transfer.';

CREATE INDEX payment_corrections_doctor_status
  ON public.payment_corrections (doctor_id, status);
CREATE INDEX payment_corrections_patient
  ON public.payment_corrections (patient_id);
CREATE INDEX payment_corrections_subscription
  ON public.payment_corrections (stripe_subscription_id)
  WHERE stripe_subscription_id IS NOT NULL;

CREATE TABLE public.payment_correction_approvals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  correction_id UUID NOT NULL REFERENCES public.payment_corrections(id),
  approver_id UUID NOT NULL REFERENCES public.profiles(id),
  approved_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT payment_correction_approvals_pair_uid UNIQUE (correction_id, approver_id)
);

COMMENT ON TABLE public.payment_correction_approvals IS
  'Append-only approvals. The approver is never the creator.';

CREATE TABLE public.payment_correction_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  correction_id UUID NOT NULL REFERENCES public.payment_corrections(id),
  event_type TEXT NOT NULL,
  actor_id UUID REFERENCES public.profiles(id),
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX payment_correction_events_correction
  ON public.payment_correction_events (correction_id, created_at);

COMMENT ON TABLE public.payment_correction_events IS
  'Append-only audit of a correction: what happened, amounts, notice, response, and settlement.';

CREATE TABLE public.payment_correction_offset_holds (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  correction_id UUID NOT NULL REFERENCES public.payment_corrections(id),
  booking_id UUID NOT NULL REFERENCES public.bookings(id),
  amount_cents INT NOT NULL CHECK (amount_cents > 0),
  status TEXT NOT NULL CHECK (status IN ('reserved', 'applied', 'released')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT payment_correction_offset_holds_pair_uid UNIQUE (correction_id, booking_id)
);

COMMENT ON TABLE public.payment_correction_offset_holds IS
  'Reserved doctor offset applied by raising the next destination-charge application fee, or by shrinking a wallet-credit transfer. Released if checkout expires.';

-- Wallet ledger lines for a correction are distinct from admin_manual.
ALTER TABLE public.wallet_transactions
  DROP CONSTRAINT IF EXISTS wallet_transactions_source_type_check;
ALTER TABLE public.wallet_transactions
  ADD CONSTRAINT wallet_transactions_source_type_check
    CHECK (source_type IN (
      'refund', 'cancel_rebook', 'referral', 'promotion',
      'admin_manual', 'top_up', 'gift_card', 'loyalty',
      'payment_correction'
    ));

CREATE OR REPLACE FUNCTION public.reject_payment_correction_audit_mutation()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'payment correction audit rows are append-only';
END;
$$;

CREATE TRIGGER payment_correction_approvals_append_only
  BEFORE UPDATE OR DELETE ON public.payment_correction_approvals
  FOR EACH ROW
  EXECUTE FUNCTION public.reject_payment_correction_audit_mutation();

CREATE TRIGGER payment_correction_events_append_only
  BEFORE UPDATE OR DELETE ON public.payment_correction_events
  FOR EACH ROW
  EXECUTE FUNCTION public.reject_payment_correction_audit_mutation();

CREATE OR REPLACE FUNCTION public.payment_correction_approvals_guard()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_creator UUID;
  v_allowed BOOLEAN;
BEGIN
  SELECT created_by INTO v_creator
  FROM public.payment_corrections
  WHERE id = NEW.correction_id;

  IF v_creator IS NOT NULL AND v_creator = NEW.approver_id THEN
    RAISE EXCEPTION 'approver cannot be the creator';
  END IF;

  SELECT EXISTS (
    SELECT 1
    FROM public.payment_correction_approvers
    WHERE profile_id = NEW.approver_id
  ) INTO v_allowed;

  IF NOT v_allowed THEN
    RAISE EXCEPTION 'approver is not a named approver';
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER payment_correction_approvals_guard
  BEFORE INSERT ON public.payment_correction_approvals
  FOR EACH ROW
  EXECUTE FUNCTION public.payment_correction_approvals_guard();

-- Reserve offset cents against one correction for one booking.
-- Returns the cents reserved (0 when the row is not eligible).
-- An open dispute (disputed_at set, dispute_resolved_at null — the same
-- pause as assertNoOpenDispute) or unmet approvals release every reserved
-- hold on the correction and return 0, even when this booking already holds
-- cents. Applied holds stay applied until a refund restores them.
CREATE OR REPLACE FUNCTION public.reserve_correction_offset(
  p_correction_id UUID,
  p_booking_id UUID,
  p_amount INT
) RETURNS INT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row public.payment_corrections%ROWTYPE;
  v_existing INT;
  v_approvals INT;
  v_director BOOLEAN := TRUE;
  v_hold public.payment_correction_offset_holds%ROWTYPE;
  v_open_dispute BOOLEAN;
  v_approvals_met BOOLEAN;
BEGIN
  IF p_amount IS NULL OR p_amount <= 0 THEN
    RETURN 0;
  END IF;

  SELECT * INTO v_row
  FROM public.payment_corrections
  WHERE id = p_correction_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN 0;
  END IF;

  v_open_dispute := v_row.disputed_at IS NOT NULL AND v_row.dispute_resolved_at IS NULL;

  SELECT COUNT(DISTINCT a.approver_id) INTO v_approvals
  FROM public.payment_correction_approvals a
  JOIN public.payment_correction_approvers p ON p.profile_id = a.approver_id
  WHERE a.correction_id = p_correction_id
    AND (v_row.created_by IS NULL OR a.approver_id <> v_row.created_by);

  IF v_row.escalated_by_doctor_at IS NOT NULL THEN
    SELECT EXISTS (
      SELECT 1
      FROM public.payment_correction_approvals a
      JOIN public.payment_correction_approvers p
        ON p.profile_id = a.approver_id AND p.director
      WHERE a.correction_id = p_correction_id
        AND (v_row.created_by IS NULL OR a.approver_id <> v_row.created_by)
    ) INTO v_director;
  END IF;

  v_approvals_met := v_approvals >= v_row.required_approvals AND COALESCE(v_director, FALSE);

  IF v_open_dispute OR NOT v_approvals_met THEN
    FOR v_hold IN
      SELECT *
      FROM public.payment_correction_offset_holds
      WHERE correction_id = p_correction_id
        AND status = 'reserved'
      FOR UPDATE
    LOOP
      UPDATE public.payment_corrections
      SET
        offset_remaining_cents = offset_remaining_cents + v_hold.amount_cents,
        updated_at = NOW()
      WHERE id = v_hold.correction_id;

      UPDATE public.payment_correction_offset_holds
      SET status = 'released'
      WHERE id = v_hold.id;
    END LOOP;
    RETURN 0;
  END IF;

  SELECT amount_cents INTO v_existing
  FROM public.payment_correction_offset_holds
  WHERE correction_id = p_correction_id
    AND booking_id = p_booking_id
    AND status IN ('reserved', 'applied');

  IF FOUND THEN
    RETURN v_existing;
  END IF;

  IF v_row.party <> 'doctor'
    OR v_row.direction <> 'platform_favour'
    OR v_row.notice_sent_at IS NULL
    OR COALESCE(v_row.recovery_step, 0) < 2
    OR v_row.offset_remaining_cents < p_amount
  THEN
    RETURN 0;
  END IF;

  IF NOT v_row.clear_risk
    AND (v_row.earliest_recovery_at IS NULL OR v_row.earliest_recovery_at > NOW())
  THEN
    RETURN 0;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.payment_correction_events e
    WHERE e.correction_id = p_correction_id
      AND e.event_type = 'reversal_attempted'
      AND e.payload->>'outcome' IN ('short', 'failed')
  ) THEN
    RETURN 0;
  END IF;

  UPDATE public.payment_corrections
  SET
    offset_remaining_cents = offset_remaining_cents - p_amount,
    updated_at = NOW()
  WHERE id = p_correction_id;

  INSERT INTO public.payment_correction_offset_holds (
    correction_id, booking_id, amount_cents, status
  ) VALUES (
    p_correction_id, p_booking_id, p_amount, 'reserved'
  );

  RETURN p_amount;
END;
$$;

REVOKE ALL ON FUNCTION public.reserve_correction_offset(UUID, UUID, INT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.reserve_correction_offset(UUID, UUID, INT) TO service_role;

CREATE OR REPLACE FUNCTION public.release_reserved_offset_holds(p_booking_ids UUID[])
RETURNS INT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_hold public.payment_correction_offset_holds%ROWTYPE;
  v_count INT := 0;
BEGIN
  IF p_booking_ids IS NULL THEN
    RETURN 0;
  END IF;

  FOR v_hold IN
    SELECT *
    FROM public.payment_correction_offset_holds
    WHERE booking_id = ANY(p_booking_ids)
      AND status = 'reserved'
    FOR UPDATE
  LOOP
    UPDATE public.payment_corrections
    SET
      offset_remaining_cents = offset_remaining_cents + v_hold.amount_cents,
      updated_at = NOW()
    WHERE id = v_hold.correction_id;

    UPDATE public.payment_correction_offset_holds
    SET status = 'released'
    WHERE id = v_hold.id;

    v_count := v_count + 1;
  END LOOP;

  RETURN v_count;
END;
$$;

REVOKE ALL ON FUNCTION public.release_reserved_offset_holds(UUID[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.release_reserved_offset_holds(UUID[]) TO service_role;

CREATE OR REPLACE FUNCTION public.apply_reserved_offset_holds(p_booking_id UUID)
RETURNS INT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count INT;
BEGIN
  UPDATE public.payment_correction_offset_holds
  SET status = 'applied'
  WHERE booking_id = p_booking_id
    AND status = 'reserved';
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

REVOKE ALL ON FUNCTION public.apply_reserved_offset_holds(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.apply_reserved_offset_holds(UUID) TO service_role;

-- Give a refunded share of applied offset holds back to offset_remaining_cents.
-- Idempotent per refund id and hold. A settled correction reopens to recovering.
CREATE OR REPLACE FUNCTION public.restore_offset_for_refund(
  p_booking_id UUID,
  p_refund_id TEXT,
  p_refund_cents INT,
  p_original_paid_cents INT
) RETURNS INT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_hold public.payment_correction_offset_holds%ROWTYPE;
  v_already INT;
  v_share INT;
  v_restore INT;
  v_total INT := 0;
  v_refund INT;
  v_original INT;
BEGIN
  IF p_refund_id IS NULL OR btrim(p_refund_id) = '' THEN
    RETURN 0;
  END IF;
  IF p_refund_cents IS NULL OR p_refund_cents <= 0 THEN
    RETURN 0;
  END IF;
  IF p_original_paid_cents IS NULL OR p_original_paid_cents <= 0 THEN
    RETURN 0;
  END IF;

  v_original := p_original_paid_cents;
  v_refund := LEAST(p_refund_cents, v_original);

  FOR v_hold IN
    SELECT *
    FROM public.payment_correction_offset_holds
    WHERE booking_id = p_booking_id
      AND status = 'applied'
    FOR UPDATE
  LOOP
    IF EXISTS (
      SELECT 1
      FROM public.payment_correction_events e
      WHERE e.correction_id = v_hold.correction_id
        AND e.event_type = 'offset_restored'
        AND e.payload->>'refund_id' = p_refund_id
        AND e.payload->>'hold_id' = v_hold.id::text
    ) THEN
      CONTINUE;
    END IF;

    SELECT COALESCE(SUM((e.payload->>'restored_cents')::INT), 0)
      INTO v_already
    FROM public.payment_correction_events e
    WHERE e.correction_id = v_hold.correction_id
      AND e.event_type = 'offset_restored'
      AND e.payload->>'hold_id' = v_hold.id::text;

    v_share := ROUND((v_hold.amount_cents::numeric * v_refund) / v_original)::INT;
    v_restore := LEAST(
      GREATEST(v_hold.amount_cents - COALESCE(v_already, 0), 0),
      GREATEST(v_share, 0)
    );
    IF v_restore <= 0 THEN
      CONTINUE;
    END IF;

    UPDATE public.payment_corrections
    SET
      offset_remaining_cents = offset_remaining_cents + v_restore,
      status = CASE WHEN status = 'settled' THEN 'recovering' ELSE status END,
      settled_at = CASE WHEN status = 'settled' THEN NULL ELSE settled_at END,
      updated_at = NOW()
    WHERE id = v_hold.correction_id;

    INSERT INTO public.payment_correction_events (correction_id, event_type, payload)
    VALUES (
      v_hold.correction_id,
      'offset_restored',
      jsonb_build_object(
        'refund_id', p_refund_id,
        'hold_id', v_hold.id,
        'booking_id', p_booking_id,
        'restored_cents', v_restore,
        'refund_cents', p_refund_cents,
        'original_paid_cents', p_original_paid_cents
      )
    );

    v_total := v_total + v_restore;
  END LOOP;

  RETURN v_total;
END;
$$;

REVOKE ALL ON FUNCTION public.restore_offset_for_refund(UUID, TEXT, INT, INT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.restore_offset_for_refund(UUID, TEXT, INT, INT) TO service_role;

ALTER TABLE public.payment_correction_approvers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_corrections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_correction_approvals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_correction_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_correction_offset_holds ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins read payment correction approvers"
  ON public.payment_correction_approvers
  FOR SELECT
  USING (public.rls_is_admin());

CREATE POLICY "Admins read payment corrections"
  ON public.payment_corrections
  FOR SELECT
  USING (public.rls_is_admin());

CREATE POLICY "Patients read own payment corrections"
  ON public.payment_corrections
  FOR SELECT
  USING (party = 'patient' AND patient_id = auth.uid());

CREATE POLICY "Doctors read own payment corrections"
  ON public.payment_corrections
  FOR SELECT
  USING (
    party = 'doctor'
    AND EXISTS (
      SELECT 1
      FROM public.doctors d
      WHERE d.id = payment_corrections.doctor_id
        AND d.profile_id = auth.uid()
    )
  );

CREATE POLICY "Admins read payment correction approvals"
  ON public.payment_correction_approvals
  FOR SELECT
  USING (public.rls_is_admin());

CREATE POLICY "Parties read payment correction approvals"
  ON public.payment_correction_approvals
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM public.payment_corrections c
      WHERE c.id = payment_correction_approvals.correction_id
        AND (
          (c.party = 'patient' AND c.patient_id = auth.uid())
          OR (
            c.party = 'doctor'
            AND EXISTS (
              SELECT 1 FROM public.doctors d
              WHERE d.id = c.doctor_id AND d.profile_id = auth.uid()
            )
          )
        )
    )
  );

CREATE POLICY "Admins read payment correction events"
  ON public.payment_correction_events
  FOR SELECT
  USING (public.rls_is_admin());

CREATE POLICY "Parties read payment correction events"
  ON public.payment_correction_events
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM public.payment_corrections c
      WHERE c.id = payment_correction_events.correction_id
        AND (
          (c.party = 'patient' AND c.patient_id = auth.uid())
          OR (
            c.party = 'doctor'
            AND EXISTS (
              SELECT 1 FROM public.doctors d
              WHERE d.id = c.doctor_id AND d.profile_id = auth.uid()
            )
          )
        )
    )
  );

CREATE POLICY "Admins read payment correction offset holds"
  ON public.payment_correction_offset_holds
  FOR SELECT
  USING (public.rls_is_admin());

-- No INSERT/UPDATE/DELETE policies. Server actions use the service role.
-- Approvals and events reject UPDATE and DELETE even for the service role.

-- Wallet-credit offsets. amount_cents stays the contractual doctor share
-- (the split check). offset_cents is the part kept for a correction.
-- The Stripe transfer is amount_cents - offset_cents. A full offset is
-- settled_by_offset and sends no transfer.
ALTER TABLE public.doctor_wallet_credit_transfers
  ADD COLUMN IF NOT EXISTS offset_cents INT NOT NULL DEFAULT 0;

ALTER TABLE public.doctor_wallet_credit_transfers
  DROP CONSTRAINT IF EXISTS doctor_wallet_credit_transfers_status_check;

DO $$
DECLARE
  v_name TEXT;
BEGIN
  FOR v_name IN
    SELECT c.conname
    FROM pg_constraint c
    JOIN pg_class t ON t.oid = c.conrelid
    JOIN pg_namespace n ON n.oid = t.relnamespace
    WHERE n.nspname = 'public'
      AND t.relname = 'doctor_wallet_credit_transfers'
      AND c.contype = 'c'
      AND pg_get_constraintdef(c.oid) ILIKE '%''pending''%'
      AND pg_get_constraintdef(c.oid) NOT ILIKE '%settled_by_offset%'
  LOOP
    EXECUTE format(
      'ALTER TABLE public.doctor_wallet_credit_transfers DROP CONSTRAINT %I',
      v_name
    );
  END LOOP;
END $$;

ALTER TABLE public.doctor_wallet_credit_transfers
  ADD CONSTRAINT doctor_wallet_credit_transfers_status_check
  CHECK (
    status IN (
      'pending',
      'paid',
      'reversed',
      'partially_reversed',
      'settled_by_offset'
    )
  );

ALTER TABLE public.doctor_wallet_credit_transfers
  DROP CONSTRAINT IF EXISTS doctor_wallet_credit_transfers_offset_chk;

ALTER TABLE public.doctor_wallet_credit_transfers
  ADD CONSTRAINT doctor_wallet_credit_transfers_offset_chk
  CHECK (offset_cents >= 0 AND offset_cents <= amount_cents);

COMMENT ON COLUMN public.doctor_wallet_credit_transfers.offset_cents IS
  'Payment-correction cents kept from this share. Stripe is sent amount_cents minus offset_cents. amount_cents stays the contractual doctor share.';
COMMENT ON COLUMN public.doctor_wallet_credit_transfers.status IS
  'pending until Stripe accepts the transfer, then paid. settled_by_offset means the offset covered the whole share and no transfer was sent.';
