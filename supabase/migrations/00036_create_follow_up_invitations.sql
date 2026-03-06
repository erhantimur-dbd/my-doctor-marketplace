-- Follow-up Invitations: Doctors invite patients for follow-up appointments
-- with optional multi-session packages and discounts.

-- 1A. follow_up_invitations table
CREATE TABLE public.follow_up_invitations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  token TEXT NOT NULL UNIQUE,
  doctor_id UUID NOT NULL REFERENCES public.doctors(id) ON DELETE CASCADE,
  patient_id UUID NOT NULL REFERENCES public.profiles(id),

  -- Service details (from doctor_services or custom)
  service_id UUID REFERENCES public.doctor_services(id) ON DELETE SET NULL,
  service_name TEXT NOT NULL,
  consultation_type TEXT NOT NULL CHECK (consultation_type IN ('in_person', 'video')),
  duration_minutes INT NOT NULL DEFAULT 30 CHECK (duration_minutes IN (15, 30, 45, 60)),

  -- Package pricing
  unit_price_cents INT NOT NULL,
  total_sessions INT NOT NULL CHECK (total_sessions BETWEEN 1 AND 10),
  discount_type TEXT CHECK (discount_type IN ('percentage', 'fixed_amount')),
  discount_value INT,
  discounted_total_cents INT NOT NULL,
  platform_fee_cents INT NOT NULL,
  currency TEXT NOT NULL,

  -- Status tracking
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'accepted', 'expired', 'cancelled')),
  sessions_booked INT NOT NULL DEFAULT 0,
  doctor_note TEXT,

  -- Stripe
  stripe_checkout_session_id TEXT,
  stripe_payment_intent_id TEXT,
  paid_at TIMESTAMPTZ,

  -- Expiry
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_fui_token ON public.follow_up_invitations(token);
CREATE INDEX idx_fui_doctor ON public.follow_up_invitations(doctor_id);
CREATE INDEX idx_fui_patient ON public.follow_up_invitations(patient_id);
CREATE INDEX idx_fui_status ON public.follow_up_invitations(status) WHERE status = 'pending';

CREATE TRIGGER trg_follow_up_invitations_updated_at
  BEFORE UPDATE ON public.follow_up_invitations
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- 1B. Add invitation_id to bookings
ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS invitation_id UUID
    REFERENCES public.follow_up_invitations(id) ON DELETE SET NULL;

CREATE INDEX idx_bookings_invitation ON public.bookings(invitation_id)
  WHERE invitation_id IS NOT NULL;

-- 1C. RLS policies
ALTER TABLE public.follow_up_invitations ENABLE ROW LEVEL SECURITY;

-- Anyone can read (public invitation page needs this)
CREATE POLICY "read_invitations" ON public.follow_up_invitations
  FOR SELECT USING (TRUE);

-- Doctors manage their own invitations
CREATE POLICY "doctor_manage_own_invitations" ON public.follow_up_invitations
  FOR ALL USING (public.rls_is_own_doctor(doctor_id));

-- Patients can update invitations addressed to them (for status changes after payment)
CREATE POLICY "patient_update_own_invitations" ON public.follow_up_invitations
  FOR UPDATE USING (patient_id = auth.uid());
