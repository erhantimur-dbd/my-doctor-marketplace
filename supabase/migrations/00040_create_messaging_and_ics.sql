-- ============================================================================
-- 00040: Doctor-Patient Messaging + ICS Feed Token + Microsoft Calendar
-- ============================================================================

-- 1. CONVERSATIONS
CREATE TABLE public.conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  doctor_id UUID NOT NULL REFERENCES public.doctors(id) ON DELETE CASCADE,
  patient_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (doctor_id, patient_id)
);

CREATE TRIGGER trg_conversations_updated_at
  BEFORE UPDATE ON public.conversations
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE INDEX idx_conversations_doctor ON public.conversations(doctor_id);
CREATE INDEX idx_conversations_patient ON public.conversations(patient_id);

-- 2. MESSAGES
CREATE TABLE public.direct_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  sender_role TEXT NOT NULL CHECK (sender_role IN ('doctor', 'patient')),
  body TEXT NOT NULL,
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_direct_messages_conversation ON public.direct_messages(conversation_id, created_at);
CREATE INDEX idx_direct_messages_unread ON public.direct_messages(conversation_id, read_at) WHERE read_at IS NULL;

-- 3. ICS FEED TOKEN (private, per-doctor token for calendar feed URL)
ALTER TABLE public.doctors ADD COLUMN IF NOT EXISTS ics_feed_token TEXT UNIQUE;

-- 4. MICROSOFT + CALDAV CALENDAR SUPPORT
ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS microsoft_event_id TEXT;
ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS caldav_event_uid TEXT;

-- CalDAV credentials stored on doctor_calendar_connections (provider = 'caldav')
ALTER TABLE public.doctor_calendar_connections ADD COLUMN IF NOT EXISTS caldav_server_url TEXT;
ALTER TABLE public.doctor_calendar_connections ADD COLUMN IF NOT EXISTS caldav_username TEXT;
ALTER TABLE public.doctor_calendar_connections ADD COLUMN IF NOT EXISTS caldav_password TEXT;
ALTER TABLE public.doctor_calendar_connections ADD COLUMN IF NOT EXISTS caldav_provider TEXT;

-- 5. RLS POLICIES
ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.direct_messages ENABLE ROW LEVEL SECURITY;

-- Conversations: doctors see their own, patients see their own, admins see all
CREATE POLICY "Doctors can view own conversations" ON public.conversations
  FOR SELECT USING (public.rls_is_own_doctor(doctor_id));

CREATE POLICY "Patients can view own conversations" ON public.conversations
  FOR SELECT USING (patient_id = auth.uid());

CREATE POLICY "Doctors can create conversations" ON public.conversations
  FOR INSERT WITH CHECK (public.rls_is_own_doctor(doctor_id));

CREATE POLICY "Admins can manage conversations" ON public.conversations
  FOR ALL USING (public.rls_is_admin());

-- Direct messages: participants can read, senders can insert
CREATE POLICY "Participants can view messages" ON public.direct_messages
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.conversations c
      WHERE c.id = conversation_id
      AND (c.patient_id = auth.uid() OR public.rls_is_own_doctor(c.doctor_id))
    )
  );

CREATE POLICY "Participants can send messages" ON public.direct_messages
  FOR INSERT WITH CHECK (
    sender_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.conversations c
      WHERE c.id = conversation_id
      AND (c.patient_id = auth.uid() OR public.rls_is_own_doctor(c.doctor_id))
    )
  );

CREATE POLICY "Recipients can mark messages read" ON public.direct_messages
  FOR UPDATE USING (
    sender_id != auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.conversations c
      WHERE c.id = conversation_id
      AND (c.patient_id = auth.uid() OR public.rls_is_own_doctor(c.doctor_id))
    )
  ) WITH CHECK (
    sender_id != auth.uid()
  );

CREATE POLICY "Admins can manage messages" ON public.direct_messages
  FOR ALL USING (public.rls_is_admin());
