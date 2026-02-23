CREATE TABLE public.doctor_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  doctor_id UUID NOT NULL REFERENCES public.doctors(id) ON DELETE CASCADE,
  stripe_subscription_id TEXT NOT NULL UNIQUE,
  stripe_customer_id TEXT NOT NULL,
  plan_id TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN (
    'active', 'past_due', 'cancelled', 'trialing', 'incomplete'
  )),
  current_period_start TIMESTAMPTZ NOT NULL,
  current_period_end TIMESTAMPTZ NOT NULL,
  cancel_at_period_end BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE public.platform_fees (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id UUID NOT NULL REFERENCES public.bookings(id),
  doctor_id UUID NOT NULL REFERENCES public.doctors(id),
  fee_type TEXT NOT NULL CHECK (fee_type IN ('commission', 'processing')),
  amount_cents INT NOT NULL,
  currency TEXT NOT NULL,
  stripe_application_fee_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER trg_subscriptions_updated_at
BEFORE UPDATE ON public.doctor_subscriptions
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
