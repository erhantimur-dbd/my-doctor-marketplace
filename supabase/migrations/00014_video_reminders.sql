-- ============================================================================
-- Migration 00014: Video Appointments (Daily.co) + Configurable Reminders
-- ============================================================================

-- 1. Doctor reminder preferences (configurable per-doctor reminder schedule)
-- ============================================================================

CREATE TABLE public.doctor_reminder_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  doctor_id UUID NOT NULL REFERENCES public.doctors(id) ON DELETE CASCADE,
  minutes_before INT NOT NULL,
  channel TEXT NOT NULL DEFAULT 'email'
    CHECK (channel IN ('email', 'sms', 'in_app')),
  is_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (doctor_id, minutes_before, channel)
);

CREATE INDEX idx_reminder_prefs_doctor ON public.doctor_reminder_preferences(doctor_id);

ALTER TABLE public.doctor_reminder_preferences ENABLE ROW LEVEL SECURITY;

-- Doctors can manage their own reminder preferences
CREATE POLICY "Doctors can view own reminder prefs"
  ON public.doctor_reminder_preferences FOR SELECT
  USING (doctor_id IN (SELECT id FROM public.doctors WHERE profile_id = auth.uid()));

CREATE POLICY "Doctors can insert own reminder prefs"
  ON public.doctor_reminder_preferences FOR INSERT
  WITH CHECK (doctor_id IN (SELECT id FROM public.doctors WHERE profile_id = auth.uid()));

CREATE POLICY "Doctors can update own reminder prefs"
  ON public.doctor_reminder_preferences FOR UPDATE
  USING (doctor_id IN (SELECT id FROM public.doctors WHERE profile_id = auth.uid()));

CREATE POLICY "Doctors can delete own reminder prefs"
  ON public.doctor_reminder_preferences FOR DELETE
  USING (doctor_id IN (SELECT id FROM public.doctors WHERE profile_id = auth.uid()));

-- Service role full access for cron job
CREATE POLICY "Service role full access to reminder prefs"
  ON public.doctor_reminder_preferences FOR ALL
  USING (auth.role() = 'service_role');

-- 2. Booking reminders sent (flexible tracking, replaces rigid boolean flags)
-- ============================================================================

CREATE TABLE public.booking_reminders_sent (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id UUID NOT NULL REFERENCES public.bookings(id) ON DELETE CASCADE,
  minutes_before INT NOT NULL,
  channel TEXT NOT NULL,
  sent_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (booking_id, minutes_before, channel)
);

CREATE INDEX idx_reminders_sent_booking ON public.booking_reminders_sent(booking_id);

ALTER TABLE public.booking_reminders_sent ENABLE ROW LEVEL SECURITY;

-- Only service role (cron job) writes to this table
CREATE POLICY "Service role full access to reminders sent"
  ON public.booking_reminders_sent FOR ALL
  USING (auth.role() = 'service_role');

-- 3. Add Daily.co room name to bookings for cleanup on cancellation
-- ============================================================================

ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS daily_room_name TEXT;
