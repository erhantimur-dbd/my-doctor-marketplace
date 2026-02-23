CREATE TABLE public.bookings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_number TEXT NOT NULL UNIQUE,
  patient_id UUID NOT NULL REFERENCES public.profiles(id),
  doctor_id UUID NOT NULL REFERENCES public.doctors(id),
  appointment_date DATE NOT NULL,
  start_time TIMESTAMPTZ NOT NULL,
  end_time TIMESTAMPTZ NOT NULL,
  duration_minutes INT NOT NULL DEFAULT 30,
  consultation_type TEXT NOT NULL CHECK (consultation_type IN ('in_person', 'video')),
  video_room_url TEXT,
  status TEXT NOT NULL DEFAULT 'pending_payment'
    CHECK (status IN (
      'pending_payment', 'confirmed', 'pending_approval', 'approved',
      'rejected', 'completed', 'cancelled_patient', 'cancelled_doctor',
      'no_show', 'refunded'
    )),
  currency TEXT NOT NULL,
  consultation_fee_cents INT NOT NULL,
  platform_fee_cents INT NOT NULL,
  total_amount_cents INT NOT NULL,
  stripe_payment_intent_id TEXT,
  stripe_charge_id TEXT,
  paid_at TIMESTAMPTZ,
  refunded_at TIMESTAMPTZ,
  refund_amount_cents INT,
  patient_notes TEXT,
  patient_phone TEXT,
  cancelled_at TIMESTAMPTZ,
  cancellation_reason TEXT,
  cancellation_fee_cents INT DEFAULT 0,
  reminder_24h_sent BOOLEAN DEFAULT FALSE,
  reminder_1h_sent BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE OR REPLACE FUNCTION public.generate_booking_number()
RETURNS TRIGGER
LANGUAGE plpgsql AS $$
BEGIN
  NEW.booking_number := 'BK-' || TO_CHAR(NOW(), 'YYYYMMDD') || '-' ||
    UPPER(SUBSTRING(gen_random_uuid()::TEXT FROM 1 FOR 4));
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_generate_booking_number
BEFORE INSERT ON public.bookings
FOR EACH ROW EXECUTE FUNCTION public.generate_booking_number();

CREATE TRIGGER trg_bookings_updated_at
BEFORE UPDATE ON public.bookings
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE INDEX idx_bookings_patient ON public.bookings(patient_id);
CREATE INDEX idx_bookings_doctor ON public.bookings(doctor_id);
CREATE INDEX idx_bookings_date ON public.bookings(appointment_date);
CREATE INDEX idx_bookings_status ON public.bookings(status);
CREATE INDEX idx_bookings_doctor_date ON public.bookings(doctor_id, appointment_date);
