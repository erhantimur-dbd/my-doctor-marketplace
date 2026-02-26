-- Migration: Create support ticket system
-- Tables: support_tickets, support_messages

-- ============================================================
-- 1. Support Tickets Table
-- ============================================================
CREATE TABLE IF NOT EXISTS public.support_tickets (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  ticket_number TEXT UNIQUE NOT NULL,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  user_role TEXT NOT NULL CHECK (user_role IN ('patient', 'doctor')),
  category TEXT NOT NULL CHECK (category IN ('billing', 'booking', 'account', 'technical', 'verification', 'other')),
  priority TEXT NOT NULL DEFAULT 'normal' CHECK (priority IN ('low', 'normal', 'high', 'urgent')),
  subject TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'in_progress', 'waiting_on_customer', 'resolved', 'closed')),
  resolved_at TIMESTAMPTZ,
  closed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_support_tickets_user ON public.support_tickets (user_id);
CREATE INDEX idx_support_tickets_status ON public.support_tickets (status);
CREATE INDEX idx_support_tickets_priority_updated ON public.support_tickets (priority DESC, updated_at DESC);

-- Enable RLS
ALTER TABLE public.support_tickets ENABLE ROW LEVEL SECURITY;

-- Users can read their own tickets
CREATE POLICY "Users can read own tickets"
  ON public.support_tickets FOR SELECT
  USING (auth.uid() = user_id);

-- Users can create tickets
CREATE POLICY "Users can create tickets"
  ON public.support_tickets FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Admins can read all tickets
CREATE POLICY "Admins can read all tickets"
  ON public.support_tickets FOR SELECT
  USING (public.rls_is_admin());

-- Admins can update all tickets (status, priority)
CREATE POLICY "Admins can update all tickets"
  ON public.support_tickets FOR UPDATE
  USING (public.rls_is_admin());

-- ============================================================
-- 2. Support Messages Table
-- ============================================================
CREATE TABLE IF NOT EXISTS public.support_messages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  ticket_id UUID NOT NULL REFERENCES public.support_tickets(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  sender_role TEXT NOT NULL CHECK (sender_role IN ('patient', 'doctor', 'admin')),
  message TEXT NOT NULL,
  attachments JSONB DEFAULT '[]'::jsonb,
  is_internal_note BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index
CREATE INDEX idx_support_messages_ticket ON public.support_messages (ticket_id);

-- Enable RLS
ALTER TABLE public.support_messages ENABLE ROW LEVEL SECURITY;

-- Users can read messages on their own tickets (excluding internal notes)
CREATE POLICY "Users can read messages on own tickets"
  ON public.support_messages FOR SELECT
  USING (
    is_internal_note = FALSE
    AND EXISTS (
      SELECT 1 FROM public.support_tickets t
      WHERE t.id = ticket_id AND t.user_id = auth.uid()
    )
  );

-- Users can insert messages on their own tickets (no internal notes)
CREATE POLICY "Users can reply to own tickets"
  ON public.support_messages FOR INSERT
  WITH CHECK (
    is_internal_note = FALSE
    AND auth.uid() = sender_id
    AND EXISTS (
      SELECT 1 FROM public.support_tickets t
      WHERE t.id = ticket_id AND t.user_id = auth.uid()
    )
  );

-- Admins can read all messages (including internal notes)
CREATE POLICY "Admins can read all messages"
  ON public.support_messages FOR SELECT
  USING (public.rls_is_admin());

-- Admins can insert messages (including internal notes)
CREATE POLICY "Admins can insert messages"
  ON public.support_messages FOR INSERT
  WITH CHECK (public.rls_is_admin());

-- ============================================================
-- 3. Auto-update ticket updated_at on new message
-- ============================================================
CREATE OR REPLACE FUNCTION public.update_ticket_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE public.support_tickets
  SET updated_at = NOW()
  WHERE id = NEW.ticket_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trigger_update_ticket_on_message
  AFTER INSERT ON public.support_messages
  FOR EACH ROW
  EXECUTE FUNCTION public.update_ticket_updated_at();

-- ============================================================
-- 4. Add whatsapp to doctor_reminder_preferences channel check
-- ============================================================
ALTER TABLE public.doctor_reminder_preferences
  DROP CONSTRAINT IF EXISTS doctor_reminder_preferences_channel_check;

ALTER TABLE public.doctor_reminder_preferences
  ADD CONSTRAINT doctor_reminder_preferences_channel_check
  CHECK (channel IN ('email', 'sms', 'in_app', 'whatsapp'));
