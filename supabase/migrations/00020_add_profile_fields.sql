-- Add address fields to profiles table
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS address_line1 TEXT,
  ADD COLUMN IF NOT EXISTS address_line2 TEXT,
  ADD COLUMN IF NOT EXISTS city TEXT,
  ADD COLUMN IF NOT EXISTS state TEXT,
  ADD COLUMN IF NOT EXISTS postal_code TEXT,
  ADD COLUMN IF NOT EXISTS country TEXT;

-- Add missing notification preference columns (used by settings page)
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS notification_email BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS notification_sms BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS notification_whatsapp BOOLEAN DEFAULT false;

NOTIFY pgrst, 'reload schema';
