-- GP pool reassignment: same-slot handoff + patient alternate offers
-- Email is always required for doctors; SMS defaults on (can opt out).

-- Doctor notification defaults for existing doctors
UPDATE public.profiles
SET
  notification_email = TRUE,
  notification_sms = COALESCE(notification_sms, TRUE)
WHERE role = 'doctor';

ALTER TABLE public.profiles
  ALTER COLUMN notification_email SET DEFAULT TRUE,
  ALTER COLUMN notification_sms SET DEFAULT TRUE;

-- Booking GP pool metadata
ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS is_gp_pool BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS display_doctor_as TEXT
    CHECK (display_doctor_as IS NULL OR display_doctor_as IN ('named', 'generic_gp')),
  ADD COLUMN IF NOT EXISTS reassigned_from_doctor_id UUID REFERENCES public.doctors(id),
  ADD COLUMN IF NOT EXISTS reassigned_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS gp_reassignment_status TEXT
    CHECK (
      gp_reassignment_status IS NULL
      OR gp_reassignment_status IN (
        'auto_reassigned',
        'pending_patient_choice',
        'patient_accepted',
        'patient_declined',
        'refunded',
        'failed'
      )
    ),
  ADD COLUMN IF NOT EXISTS stripe_destination_transfer_id TEXT,
  ADD COLUMN IF NOT EXISTS stripe_reassignment_transfer_id TEXT;

CREATE INDEX IF NOT EXISTS idx_bookings_gp_pool
  ON public.bookings (is_gp_pool)
  WHERE is_gp_pool = TRUE;

CREATE INDEX IF NOT EXISTS idx_bookings_gp_reassignment_status
  ON public.bookings (gp_reassignment_status)
  WHERE gp_reassignment_status IS NOT NULL;

-- Patient alternate slot offers when no same-time GP is free
CREATE TABLE IF NOT EXISTS public.gp_slot_offers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id UUID NOT NULL REFERENCES public.bookings(id) ON DELETE CASCADE,
  doctor_id UUID NOT NULL REFERENCES public.doctors(id),
  appointment_date DATE NOT NULL,
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  consultation_type TEXT NOT NULL CHECK (consultation_type IN ('in_person', 'video', 'phone')),
  fee_cents INT NOT NULL,
  token TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'accepted', 'declined', 'expired', 'superseded')),
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  responded_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_gp_slot_offers_booking
  ON public.gp_slot_offers (booking_id);

CREATE INDEX IF NOT EXISTS idx_gp_slot_offers_token
  ON public.gp_slot_offers (token);

CREATE INDEX IF NOT EXISTS idx_gp_slot_offers_pending_expiry
  ON public.gp_slot_offers (expires_at)
  WHERE status = 'pending';

-- RLS: patients read own offers via booking; service role does writes
ALTER TABLE public.gp_slot_offers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Patients can read own gp slot offers"
  ON public.gp_slot_offers
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.bookings b
      WHERE b.id = gp_slot_offers.booking_id
        AND b.patient_id = auth.uid()
    )
  );

-- Doctors can read offers for their bookings (outgoing reassignment)
CREATE POLICY "Doctors can read offers for their bookings"
  ON public.gp_slot_offers
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.bookings b
      JOIN public.doctors d ON d.id = b.doctor_id
      WHERE b.id = gp_slot_offers.booking_id
        AND d.profile_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM public.doctors d
      WHERE d.id = gp_slot_offers.doctor_id
        AND d.profile_id = auth.uid()
    )
  );
