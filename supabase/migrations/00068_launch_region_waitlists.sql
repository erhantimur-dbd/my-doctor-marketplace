-- Launch region waitlist tables
-- Doctor waitlist: captures doctors outside launch regions who want to join
-- Launch notifications: captures patients who want to be notified when we launch in their region

-- Doctor waitlist
CREATE TABLE IF NOT EXISTS doctor_waitlist (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  specialty TEXT NOT NULL,
  country TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'contacted', 'converted')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Prevent duplicate emails
CREATE UNIQUE INDEX IF NOT EXISTS idx_doctor_waitlist_email ON doctor_waitlist (email);

-- Indexes for admin dashboard queries
CREATE INDEX IF NOT EXISTS idx_doctor_waitlist_country ON doctor_waitlist (country);
CREATE INDEX IF NOT EXISTS idx_doctor_waitlist_status ON doctor_waitlist (status);
CREATE INDEX IF NOT EXISTS idx_doctor_waitlist_created_at ON doctor_waitlist (created_at);

-- Patient launch notifications
CREATE TABLE IF NOT EXISTS launch_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  region TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Prevent duplicate emails per region
CREATE UNIQUE INDEX IF NOT EXISTS idx_launch_notifications_email_region ON launch_notifications (email, region);

-- Indexes for admin dashboard queries
CREATE INDEX IF NOT EXISTS idx_launch_notifications_region ON launch_notifications (region);
CREATE INDEX IF NOT EXISTS idx_launch_notifications_created_at ON launch_notifications (created_at);

-- RLS policies
ALTER TABLE doctor_waitlist ENABLE ROW LEVEL SECURITY;
ALTER TABLE launch_notifications ENABLE ROW LEVEL SECURITY;

-- Allow anonymous inserts (public sign-up forms)
CREATE POLICY "Anyone can insert doctor waitlist"
  ON doctor_waitlist FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Anyone can insert launch notifications"
  ON launch_notifications FOR INSERT
  WITH CHECK (true);

-- Only admins (service role) can read/update
CREATE POLICY "Service role can manage doctor waitlist"
  ON doctor_waitlist FOR ALL
  USING (auth.role() = 'service_role');

CREATE POLICY "Service role can manage launch notifications"
  ON launch_notifications FOR ALL
  USING (auth.role() = 'service_role');
