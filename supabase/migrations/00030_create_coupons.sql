-- ============================================================================
-- Coupon / Promo Code System
-- ============================================================================

-- 1. Coupons table (admin-managed coupon definitions)
CREATE TABLE public.coupons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- The human-readable code doctors enter (e.g., "WELCOME50", "LAUNCH2026")
  code TEXT NOT NULL,

  -- Display name for admin reference
  name TEXT NOT NULL,

  -- Description (optional, shown to admin only)
  description TEXT,

  -- Discount type: 'percentage' or 'fixed_amount'
  discount_type TEXT NOT NULL CHECK (discount_type IN ('percentage', 'fixed_amount')),

  -- Discount value: percentage (1-100) or amount in cents for fixed_amount
  discount_value INT NOT NULL CHECK (discount_value > 0),

  -- For fixed_amount discounts, the currency
  currency TEXT NOT NULL DEFAULT 'EUR',

  -- Which plans this coupon applies to (NULL = all paid plans)
  applicable_plans TEXT[] DEFAULT NULL,

  -- Stripe duration: 'once', 'repeating', or 'forever'
  duration TEXT NOT NULL DEFAULT 'once' CHECK (duration IN ('once', 'repeating', 'forever')),

  -- For 'repeating' duration, how many months
  duration_in_months INT,

  -- Usage limits
  max_uses INT,              -- NULL = unlimited
  current_uses INT NOT NULL DEFAULT 0,

  -- Validity period
  valid_from TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ,    -- NULL = no expiry

  -- Active toggle (admin can deactivate without deleting)
  is_active BOOLEAN NOT NULL DEFAULT TRUE,

  -- Link to Stripe coupon
  stripe_coupon_id TEXT,

  -- Audit
  created_by UUID REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Case-insensitive unique code
CREATE UNIQUE INDEX idx_coupons_code_upper ON public.coupons (UPPER(code));
CREATE INDEX idx_coupons_active ON public.coupons (is_active) WHERE is_active = TRUE;
CREATE INDEX idx_coupons_expires ON public.coupons (expires_at) WHERE expires_at IS NOT NULL;

-- Updated_at trigger
CREATE TRIGGER trg_coupons_updated_at
  BEFORE UPDATE ON public.coupons
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();


-- 2. Coupon redemptions table (tracks who used which coupon)
CREATE TABLE public.coupon_redemptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  coupon_id UUID NOT NULL REFERENCES public.coupons(id) ON DELETE CASCADE,
  doctor_id UUID NOT NULL REFERENCES public.doctors(id) ON DELETE CASCADE,

  -- Which plan the coupon was applied to
  plan_id TEXT NOT NULL,

  -- Stripe checkout session ID (for reconciliation)
  stripe_checkout_session_id TEXT,

  -- Timestamp of redemption
  redeemed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_redemptions_coupon ON public.coupon_redemptions(coupon_id);
CREATE INDEX idx_redemptions_doctor ON public.coupon_redemptions(doctor_id);

-- Prevent same doctor from using same coupon twice
CREATE UNIQUE INDEX idx_redemptions_unique_doctor_coupon
  ON public.coupon_redemptions(coupon_id, doctor_id);


-- 3. RLS Policies
ALTER TABLE public.coupons ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.coupon_redemptions ENABLE ROW LEVEL SECURITY;

-- Admins can manage all coupons
CREATE POLICY "Admins can manage coupons"
  ON public.coupons
  FOR ALL
  USING (public.rls_is_admin())
  WITH CHECK (public.rls_is_admin());

-- Doctors can read active coupons (for validation)
CREATE POLICY "Doctors can read active coupons"
  ON public.coupons
  FOR SELECT
  USING (
    is_active = TRUE
    AND EXISTS (
      SELECT 1 FROM public.doctors WHERE profile_id = auth.uid()
    )
  );

-- Admins can read all redemptions
CREATE POLICY "Admins can read all redemptions"
  ON public.coupon_redemptions
  FOR ALL
  USING (public.rls_is_admin())
  WITH CHECK (public.rls_is_admin());

-- Doctors can read own redemptions
CREATE POLICY "Doctors can read own redemptions"
  ON public.coupon_redemptions
  FOR SELECT
  USING (
    doctor_id IN (
      SELECT id FROM public.doctors WHERE profile_id = auth.uid()
    )
  );


-- 4. Helper function to atomically increment coupon usage count
CREATE OR REPLACE FUNCTION public.increment_coupon_uses(p_coupon_id UUID)
RETURNS VOID
LANGUAGE sql SECURITY DEFINER
SET search_path = ''
AS $$
  UPDATE public.coupons
  SET current_uses = current_uses + 1
  WHERE id = p_coupon_id;
$$;


NOTIFY pgrst, 'reload schema';
