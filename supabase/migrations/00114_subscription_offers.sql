-- Doctor subscription offers (annual Solo / annual Pro only).
--
-- Infra applies this migration to Production separately. It does not create
-- Stripe objects. Annual test prices and the three example offers are created
-- by scripts/seed-subscription-offers.ts against a Stripe test secret.
--
-- Example offers (documented here, inserted by the script):
--   50% off first year  (percent_first_year, percent_off 50)
--   25% off first year  (percent_first_year, percent_off 25)
--   Free for 3 months   (free_trial, trial_days 90)
-- Clinic plans are rejected by the eligible_plans check.

-- ── Offers (source of truth) ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.subscription_offers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('percent_first_year', 'free_trial')),
  percent_off INT,
  trial_days INT,
  eligible_plans TEXT[] NOT NULL,
  redeem_by TIMESTAMPTZ NOT NULL,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  stripe_coupon_id TEXT,
  stripe_promotion_code_id TEXT,
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT subscription_offers_kind_fields CHECK (
    (
      kind = 'percent_first_year'
      AND percent_off BETWEEN 1 AND 100
      AND trial_days IS NULL
    )
    OR (
      kind = 'free_trial'
      AND trial_days BETWEEN 1 AND 365
      AND percent_off IS NULL
    )
  ),
  CONSTRAINT subscription_offers_eligible_plans CHECK (
    cardinality(eligible_plans) >= 1
    AND eligible_plans <@ ARRAY['starter_annual', 'professional_annual']::TEXT[]
  )
);

CREATE INDEX IF NOT EXISTS idx_subscription_offers_active
  ON public.subscription_offers (active, redeem_by);

DROP TRIGGER IF EXISTS trg_subscription_offers_updated_at ON public.subscription_offers;
CREATE TRIGGER trg_subscription_offers_updated_at
BEFORE UPDATE ON public.subscription_offers
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- ── Founder invite links (offer + specialty + doctor email) ───────────────
CREATE TABLE IF NOT EXISTS public.subscription_offer_invites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  token TEXT NOT NULL UNIQUE,
  offer_id UUID NOT NULL REFERENCES public.subscription_offers(id),
  specialty_slug TEXT NOT NULL,
  doctor_email TEXT NOT NULL,
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  checkout_started_at TIMESTAMPTZ,
  redeemed_at TIMESTAMPTZ,
  used_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_subscription_offer_invites_offer
  ON public.subscription_offer_invites (offer_id);

-- ── Attribution: which offer and specialty a signup came through ──────────
CREATE TABLE IF NOT EXISTS public.subscription_offer_attributions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invite_id UUID UNIQUE REFERENCES public.subscription_offer_invites(id),
  offer_id UUID NOT NULL REFERENCES public.subscription_offers(id),
  specialty_slug TEXT NOT NULL,
  doctor_email TEXT NOT NULL,
  doctor_id UUID,
  organization_id UUID,
  license_id UUID,
  stripe_subscription_id TEXT,
  status TEXT NOT NULL DEFAULT 'invited'
    CHECK (status IN ('invited', 'account_created', 'subscribed')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_offer_attributions_one_doctor
  ON public.subscription_offer_attributions (doctor_id)
  WHERE doctor_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_offer_attributions_offer
  ON public.subscription_offer_attributions (offer_id);

DROP TRIGGER IF EXISTS trg_subscription_offer_attributions_updated_at
  ON public.subscription_offer_attributions;
CREATE TRIGGER trg_subscription_offer_attributions_updated_at
BEFORE UPDATE ON public.subscription_offer_attributions
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- ── Annual price catalogue (new Stripe prices; old prices are never edited)
CREATE TABLE IF NOT EXISTS public.plan_price_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id TEXT NOT NULL CHECK (plan_id IN ('starter_annual', 'professional_annual')),
  amount_pence INT NOT NULL CHECK (amount_pence > 0),
  currency TEXT NOT NULL DEFAULT 'gbp',
  stripe_price_id TEXT NOT NULL UNIQUE,
  stripe_product_id TEXT,
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_plan_price_versions_plan
  ON public.plan_price_versions (plan_id, created_at DESC);

-- ── Renewal price switches driven by Stripe subscription schedules ────────
CREATE TABLE IF NOT EXISTS public.subscription_price_schedules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  stripe_subscription_id TEXT NOT NULL,
  stripe_schedule_id TEXT NOT NULL UNIQUE,
  organization_id UUID,
  plan_id TEXT NOT NULL CHECK (plan_id IN ('starter_annual', 'professional_annual')),
  from_price_id TEXT NOT NULL,
  to_price_id TEXT NOT NULL,
  from_amount_pence INT NOT NULL,
  to_amount_pence INT NOT NULL,
  switch_at TIMESTAMPTZ NOT NULL,
  notice_due_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_price_schedules_notice
  ON public.subscription_price_schedules (notice_due_at);

-- ── Idempotent service-email log (one row per subscription + event) ───────
CREATE TABLE IF NOT EXISTS public.service_email_sends (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  idempotency_key TEXT NOT NULL UNIQUE,
  event_kind TEXT NOT NULL CHECK (event_kind IN ('trial_reminder_7d', 'price_change_30d')),
  stripe_subscription_id TEXT,
  recipient_email TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('pending', 'sent', 'suppressed', 'failed')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

DROP TRIGGER IF EXISTS trg_service_email_sends_updated_at ON public.service_email_sends;
CREATE TRIGGER trg_service_email_sends_updated_at
BEFORE UPDATE ON public.service_email_sends
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- ── Licence attribution columns ───────────────────────────────────────────
ALTER TABLE public.licenses
  ADD COLUMN IF NOT EXISTS offer_id UUID REFERENCES public.subscription_offers(id),
  ADD COLUMN IF NOT EXISTS attribution_specialty TEXT,
  ADD COLUMN IF NOT EXISTS offer_invite_id UUID REFERENCES public.subscription_offer_invites(id),
  ADD COLUMN IF NOT EXISTS billing_period TEXT;

ALTER TABLE public.licenses
  DROP CONSTRAINT IF EXISTS licenses_billing_period_check;

ALTER TABLE public.licenses
  ADD CONSTRAINT licenses_billing_period_check
  CHECK (billing_period IS NULL OR billing_period IN ('monthly', 'annual'));

CREATE INDEX IF NOT EXISTS idx_licenses_offer
  ON public.licenses (offer_id)
  WHERE offer_id IS NOT NULL;

-- One live *offer* licence per practice. A second offer cannot attach while
-- another offer licence is active, trialing, or past_due.
-- Any live licence (including a paying monthly or annual row with no offer)
-- is refused in the app before Checkout. This index stays offer-only so a
-- tier switch that briefly holds two live rows is not rejected here.
CREATE UNIQUE INDEX IF NOT EXISTS idx_licenses_one_live_offer_per_org
  ON public.licenses (organization_id)
  WHERE offer_id IS NOT NULL
    AND status IN ('active', 'trialing', 'past_due');

-- Service role only. Founder tools use the admin client after the
-- OFFER_ADMIN_EMAILS check. No anon/authenticated policies.
ALTER TABLE public.subscription_offers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscription_offer_invites ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscription_offer_attributions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.plan_price_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscription_price_schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.service_email_sends ENABLE ROW LEVEL SECURITY;
