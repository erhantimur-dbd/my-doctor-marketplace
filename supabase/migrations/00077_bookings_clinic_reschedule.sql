-- ============================================================
-- BOOKINGS: Add clinic location + admin reschedule payment fields
-- ============================================================

-- Which clinic branch this appointment is at
ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS clinic_location_id UUID
    REFERENCES public.clinic_locations(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_bookings_clinic_location
  ON public.bookings(clinic_location_id)
  WHERE clinic_location_id IS NOT NULL;

-- Admin reschedule audit trail
ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS rescheduled_from_booking_id UUID
    REFERENCES public.bookings(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS reschedule_price_diff_cents INT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS reschedule_payment_intent_id TEXT,
  ADD COLUMN IF NOT EXISTS reschedule_payment_status TEXT
    CHECK (reschedule_payment_status IN ('not_required', 'pending', 'paid', 'refunded', 'expired')),
  ADD COLUMN IF NOT EXISTS rescheduled_by UUID
    REFERENCES public.profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS rescheduled_at TIMESTAMPTZ;

-- Add 'pending_reschedule_payment' to booking status
-- (patient owes extra after admin rescheduled to higher-fee slot)
ALTER TABLE public.bookings
  DROP CONSTRAINT IF EXISTS bookings_status_check;

ALTER TABLE public.bookings
  ADD CONSTRAINT bookings_status_check CHECK (
    status IN (
      'pending_payment',
      'confirmed',
      'pending_approval',
      'approved',
      'rejected',
      'completed',
      'cancelled_patient',
      'cancelled_doctor',
      'no_show',
      'refunded',
      'pending_reschedule_payment'
    )
  );

-- ============================================================
-- RPC: Get all bookings for an organization (admin dashboard)
-- Returns bookings across ALL doctors in the clinic, with
-- doctor name, patient name, and location name joined.
-- ============================================================

CREATE OR REPLACE FUNCTION public.get_org_bookings(
  p_org_id UUID,
  p_status TEXT DEFAULT NULL,
  p_doctor_id UUID DEFAULT NULL,
  p_location_id UUID DEFAULT NULL,
  p_from_date DATE DEFAULT NULL,
  p_to_date DATE DEFAULT NULL,
  p_limit INT DEFAULT 50,
  p_offset INT DEFAULT 0
)
RETURNS TABLE(
  booking_id UUID,
  booking_number TEXT,
  appointment_date DATE,
  start_time TIMESTAMPTZ,
  end_time TIMESTAMPTZ,
  status TEXT,
  consultation_type TEXT,
  consultation_fee_cents INT,
  total_amount_cents INT,
  currency TEXT,
  payment_mode TEXT,
  reschedule_payment_status TEXT,
  doctor_id UUID,
  doctor_first_name TEXT,
  doctor_last_name TEXT,
  doctor_avatar_url TEXT,
  patient_id UUID,
  patient_first_name TEXT,
  patient_last_name TEXT,
  patient_email TEXT,
  patient_phone TEXT,
  clinic_location_id UUID,
  clinic_location_name TEXT,
  service_name TEXT,
  created_at TIMESTAMPTZ
) AS $$
  SELECT
    b.id                  AS booking_id,
    b.booking_number,
    b.appointment_date,
    b.start_time,
    b.end_time,
    b.status,
    b.consultation_type,
    b.consultation_fee_cents,
    b.total_amount_cents,
    b.currency,
    b.payment_mode,
    b.reschedule_payment_status,
    d.id                  AS doctor_id,
    dp.first_name         AS doctor_first_name,
    dp.last_name          AS doctor_last_name,
    dp.avatar_url         AS doctor_avatar_url,
    b.patient_id,
    pp.first_name         AS patient_first_name,
    pp.last_name          AS patient_last_name,
    pp.email              AS patient_email,
    pp.phone              AS patient_phone,
    b.clinic_location_id,
    cl.name               AS clinic_location_name,
    b.service_name,
    b.created_at
  FROM public.bookings b
  JOIN public.doctors d ON d.id = b.doctor_id
  JOIN public.profiles dp ON dp.id = d.profile_id
  JOIN public.profiles pp ON pp.id = b.patient_id
  LEFT JOIN public.clinic_locations cl ON cl.id = b.clinic_location_id
  WHERE b.organization_id = p_org_id
    AND (p_status IS NULL OR b.status = p_status)
    AND (p_doctor_id IS NULL OR b.doctor_id = p_doctor_id)
    AND (p_location_id IS NULL OR b.clinic_location_id = p_location_id)
    AND (p_from_date IS NULL OR b.appointment_date >= p_from_date)
    AND (p_to_date IS NULL OR b.appointment_date <= p_to_date)
  ORDER BY b.start_time DESC
  LIMIT p_limit
  OFFSET p_offset
$$ LANGUAGE sql STABLE SECURITY DEFINER;
