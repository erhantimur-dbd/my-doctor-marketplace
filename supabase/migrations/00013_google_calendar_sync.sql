-- Google Calendar Sync: connection table + booking column

CREATE TABLE public.doctor_calendar_connections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  doctor_id UUID NOT NULL REFERENCES public.doctors(id) ON DELETE CASCADE,
  provider TEXT NOT NULL DEFAULT 'google' CHECK (provider IN ('google')),
  access_token TEXT NOT NULL,
  refresh_token TEXT NOT NULL,
  token_expires_at TIMESTAMPTZ NOT NULL,
  calendar_id TEXT,  -- selected Google Calendar ID
  sync_enabled BOOLEAN NOT NULL DEFAULT true,
  last_synced_at TIMESTAMPTZ,
  webhook_channel_id TEXT,
  webhook_resource_id TEXT,
  webhook_expiration TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_doctor_calendar_connection UNIQUE (doctor_id, provider)
);

-- Index for quick lookup by doctor
CREATE INDEX idx_calendar_connections_doctor ON public.doctor_calendar_connections(doctor_id);

-- Updated_at trigger
CREATE TRIGGER trg_calendar_connections_updated_at
BEFORE UPDATE ON public.doctor_calendar_connections
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- Add google_event_id to bookings so we can track exported events
ALTER TABLE public.bookings ADD COLUMN google_event_id TEXT;

-- RLS policies
ALTER TABLE public.doctor_calendar_connections ENABLE ROW LEVEL SECURITY;

-- Doctors can view/manage their own calendar connections
CREATE POLICY "Doctors can view own calendar connections"
  ON public.doctor_calendar_connections FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.doctors d
      WHERE d.id = doctor_calendar_connections.doctor_id
      AND d.profile_id = auth.uid()
    )
  );

CREATE POLICY "Doctors can insert own calendar connections"
  ON public.doctor_calendar_connections FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.doctors d
      WHERE d.id = doctor_calendar_connections.doctor_id
      AND d.profile_id = auth.uid()
    )
  );

CREATE POLICY "Doctors can update own calendar connections"
  ON public.doctor_calendar_connections FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.doctors d
      WHERE d.id = doctor_calendar_connections.doctor_id
      AND d.profile_id = auth.uid()
    )
  );

CREATE POLICY "Doctors can delete own calendar connections"
  ON public.doctor_calendar_connections FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.doctors d
      WHERE d.id = doctor_calendar_connections.doctor_id
      AND d.profile_id = auth.uid()
    )
  );

-- Service role (admin) can manage all connections (for sync cron / webhooks)
CREATE POLICY "Service role can manage all calendar connections"
  ON public.doctor_calendar_connections FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');
