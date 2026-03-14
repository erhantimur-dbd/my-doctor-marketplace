-- ── Message Attachments Storage Bucket ─────────────────────────────
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'message-attachments',
  'message-attachments',
  false,
  10485760, -- 10MB
  ARRAY[
    'image/jpeg', 'image/png', 'image/webp', 'image/gif',
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  ]
) ON CONFLICT (id) DO NOTHING;

-- Storage policies: participants of a conversation can upload/read
CREATE POLICY "conversation_participants_upload_attachments"
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'message-attachments'
    AND EXISTS (
      SELECT 1 FROM conversations c
      WHERE c.id::text = (storage.foldername(name))[1]
        AND (c.patient_id = auth.uid() OR EXISTS (
          SELECT 1 FROM doctors d WHERE d.id = c.doctor_id AND d.profile_id = auth.uid()
        ))
    )
  );

CREATE POLICY "conversation_participants_read_attachments"
  ON storage.objects
  FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'message-attachments'
    AND EXISTS (
      SELECT 1 FROM conversations c
      WHERE c.id::text = (storage.foldername(name))[1]
        AND (c.patient_id = auth.uid() OR EXISTS (
          SELECT 1 FROM doctors d WHERE d.id = c.doctor_id AND d.profile_id = auth.uid()
        ))
    )
  );

-- ── Message Attachments Table ──────────────────────────────────────
CREATE TABLE message_attachments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id UUID NOT NULL REFERENCES direct_messages(id) ON DELETE CASCADE,
  conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  file_name TEXT NOT NULL,
  file_type TEXT NOT NULL,
  file_size INTEGER NOT NULL,
  storage_path TEXT NOT NULL,
  uploaded_by UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for fast lookups
CREATE INDEX idx_message_attachments_message_id ON message_attachments(message_id);
CREATE INDEX idx_message_attachments_conversation_id ON message_attachments(conversation_id);

-- RLS
ALTER TABLE message_attachments ENABLE ROW LEVEL SECURITY;

-- Participants can view attachments in their conversations
CREATE POLICY "participants_view_attachments"
  ON message_attachments
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM conversations c
      WHERE c.id = message_attachments.conversation_id
        AND (c.patient_id = auth.uid() OR EXISTS (
          SELECT 1 FROM doctors d WHERE d.id = c.doctor_id AND d.profile_id = auth.uid()
        ))
    )
  );

-- Service role can insert (handled via admin client in server actions)
CREATE POLICY "service_role_insert_attachments"
  ON message_attachments
  FOR INSERT
  TO service_role
  WITH CHECK (true);
