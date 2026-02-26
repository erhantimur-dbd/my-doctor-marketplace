-- Contact form submissions (public, no auth required)
CREATE TABLE contact_inquiries (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL,
  email text NOT NULL,
  inquiry_type text NOT NULL CHECK (inquiry_type IN ('doctor_onboarding', 'partnership', 'press', 'general')),
  message text NOT NULL,
  status text NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'read', 'replied', 'archived')),
  admin_notes text,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);

-- RLS: Only service_role can access (server action uses admin client)
ALTER TABLE contact_inquiries ENABLE ROW LEVEL SECURITY;

-- Admin access via rls_is_admin helper
CREATE POLICY "Admins can manage contact inquiries"
  ON contact_inquiries
  FOR ALL
  USING (rls_is_admin())
  WITH CHECK (rls_is_admin());

-- Indexes for admin querying
CREATE INDEX idx_contact_inquiries_status ON contact_inquiries (status);
CREATE INDEX idx_contact_inquiries_created_at ON contact_inquiries (created_at DESC);
CREATE INDEX idx_contact_inquiries_type ON contact_inquiries (inquiry_type);
