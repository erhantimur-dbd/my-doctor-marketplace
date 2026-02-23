-- Fix doctor_subscriptions: allow trial subscriptions without Stripe IDs
ALTER TABLE public.doctor_subscriptions
  ALTER COLUMN stripe_subscription_id DROP NOT NULL,
  ALTER COLUMN stripe_customer_id DROP NOT NULL;

-- Remove the UNIQUE constraint on stripe_subscription_id so NULLs are allowed
-- (PostgreSQL allows multiple NULLs in UNIQUE columns, but let's keep it clean)
ALTER TABLE public.doctor_subscriptions
  DROP CONSTRAINT IF EXISTS doctor_subscriptions_stripe_subscription_id_key;
ALTER TABLE public.doctor_subscriptions
  ADD CONSTRAINT doctor_subscriptions_stripe_subscription_id_key
  UNIQUE NULLS NOT DISTINCT (stripe_subscription_id);

-- Add missing RLS policies for doctor_subscriptions
CREATE POLICY "Doctors can insert own subscription" ON public.doctor_subscriptions
  FOR INSERT WITH CHECK (
    doctor_id IN (SELECT id FROM public.doctors WHERE profile_id = auth.uid())
  );

CREATE POLICY "Doctors can update own subscription" ON public.doctor_subscriptions
  FOR UPDATE USING (
    doctor_id IN (SELECT id FROM public.doctors WHERE profile_id = auth.uid())
  );

-- Add missing RLS for bookings updates (doctors need to approve/reject)
DO $$ BEGIN
  CREATE POLICY "Doctors can update their bookings" ON public.bookings
    FOR UPDATE USING (
      doctor_id IN (SELECT id FROM public.doctors WHERE profile_id = auth.uid())
    );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Add admin manage subscriptions policy
DO $$ BEGIN
  CREATE POLICY "Admins can manage subscriptions" ON public.doctor_subscriptions
    FOR ALL USING (public.is_admin());
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
