-- Reschedule requests: patient requests new date/time, doctor approves or rejects
CREATE TABLE IF NOT EXISTS public.reschedule_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id UUID NOT NULL REFERENCES public.bookings(id) ON DELETE CASCADE,
  requested_by UUID NOT NULL REFERENCES public.profiles(id),
  original_date DATE NOT NULL,
  original_start_time TIME NOT NULL,
  original_end_time TIME NOT NULL,
  new_date DATE NOT NULL,
  new_start_time TIME NOT NULL,
  new_end_time TIME NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'approved', 'rejected', 'expired')),
  rejection_reason TEXT,
  responded_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_reschedule_booking
  ON public.reschedule_requests(booking_id);

CREATE INDEX IF NOT EXISTS idx_reschedule_status
  ON public.reschedule_requests(status)
  WHERE status = 'pending';

ALTER TABLE public.reschedule_requests ENABLE ROW LEVEL SECURITY;

-- Patient who requested can view their own
CREATE POLICY "Patients view own reschedule requests"
  ON public.reschedule_requests FOR SELECT
  USING (requested_by = auth.uid());

-- Patient can create reschedule requests for their bookings
CREATE POLICY "Patients create reschedule requests"
  ON public.reschedule_requests FOR INSERT
  WITH CHECK (requested_by = auth.uid());

-- Doctor who owns the booking can view and update
CREATE POLICY "Doctors view reschedule requests for their bookings"
  ON public.reschedule_requests FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM bookings b
      JOIN doctors d ON d.id = b.doctor_id
      WHERE b.id = reschedule_requests.booking_id
      AND d.profile_id = auth.uid()
    )
  );

CREATE POLICY "Doctors update reschedule requests for their bookings"
  ON public.reschedule_requests FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM bookings b
      JOIN doctors d ON d.id = b.doctor_id
      WHERE b.id = reschedule_requests.booking_id
      AND d.profile_id = auth.uid()
    )
  );

-- Service role full access
CREATE POLICY "Service role full access on reschedule_requests"
  ON public.reschedule_requests FOR ALL
  USING (auth.jwt() ->> 'role' = 'service_role');
