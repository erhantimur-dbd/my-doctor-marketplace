-- ===== doctor_services table =====
CREATE TABLE public.doctor_services (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  doctor_id UUID NOT NULL REFERENCES public.doctors(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  price_cents INT NOT NULL,
  duration_minutes INT NOT NULL DEFAULT 30
    CHECK (duration_minutes IN (15, 30, 45, 60)),
  consultation_type TEXT NOT NULL DEFAULT 'in_person'
    CHECK (consultation_type IN ('in_person', 'video', 'both')),
  is_active BOOLEAN DEFAULT TRUE,
  display_order INT DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_doctor_services_doctor ON public.doctor_services(doctor_id);
CREATE INDEX idx_doctor_services_active ON public.doctor_services(doctor_id, is_active) WHERE is_active = TRUE;

CREATE TRIGGER trg_doctor_services_updated_at
  BEFORE UPDATE ON public.doctor_services
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- ===== RLS =====
ALTER TABLE public.doctor_services ENABLE ROW LEVEL SECURITY;

-- Anyone can read active services (needed for booking page)
CREATE POLICY "read_active_services" ON public.doctor_services
  FOR SELECT USING (is_active = TRUE);

-- Doctors manage their own services
CREATE POLICY "doctor_manage_own_services" ON public.doctor_services
  FOR ALL USING (public.rls_is_own_doctor(doctor_id));

-- ===== Add service columns to bookings =====
ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS service_id UUID REFERENCES public.doctor_services(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS service_name TEXT;

-- ===== Update get_available_slots RPC to accept optional duration override =====
CREATE OR REPLACE FUNCTION public.get_available_slots(
  p_doctor_id UUID,
  p_date DATE,
  p_consultation_type TEXT DEFAULT 'in_person',
  p_slot_duration_override INT DEFAULT NULL
)
RETURNS TABLE (
  slot_start TIMESTAMPTZ,
  slot_end TIMESTAMPTZ,
  is_available BOOLEAN
)
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_day_of_week INT;
  v_timezone TEXT;
BEGIN
  v_day_of_week := EXTRACT(DOW FROM p_date);

  SELECT COALESCE(l.timezone, 'Europe/London') INTO v_timezone
  FROM public.doctors d
  LEFT JOIN public.locations l ON d.location_id = l.id
  WHERE d.id = p_doctor_id;

  -- Check if entire day is blocked
  IF EXISTS (
    SELECT 1 FROM public.availability_overrides ao
    WHERE ao.doctor_id = p_doctor_id
      AND ao.override_date = p_date
      AND ao.is_available = FALSE
      AND ao.start_time IS NULL
  ) THEN
    RETURN;
  END IF;

  RETURN QUERY
  WITH schedule_slots AS (
    SELECT
      (p_date + s.start_time) AT TIME ZONE v_timezone AS slot_s,
      (p_date + s.end_time) AT TIME ZONE v_timezone AS slot_e,
      COALESCE(p_slot_duration_override, s.slot_duration_minutes) AS eff_slot_duration
    FROM public.availability_schedules s
    WHERE s.doctor_id = p_doctor_id
      AND s.day_of_week = v_day_of_week
      AND s.consultation_type = p_consultation_type
      AND s.is_active = TRUE
  ),
  expanded_slots AS (
    SELECT
      slot_s + (n * (eff_slot_duration || ' minutes')::INTERVAL) AS s_start,
      slot_s + ((n + 1) * (eff_slot_duration || ' minutes')::INTERVAL) AS s_end
    FROM schedule_slots,
    generate_series(0, (EXTRACT(EPOCH FROM slot_e - slot_s) / (eff_slot_duration * 60))::INT - 1) AS n
  ),
  booked AS (
    SELECT b.start_time, b.end_time
    FROM public.bookings b
    WHERE b.doctor_id = p_doctor_id
      AND b.appointment_date = p_date
      AND b.status IN ('confirmed', 'pending_approval', 'approved', 'pending_payment')
  )
  SELECT
    es.s_start AS slot_start,
    es.s_end AS slot_end,
    NOT EXISTS (
      SELECT 1 FROM booked bk
      WHERE bk.start_time < es.s_end AND bk.end_time > es.s_start
    ) AS is_available
  FROM expanded_slots es
  WHERE es.s_start > NOW()
  ORDER BY es.s_start;
END;
$$;
