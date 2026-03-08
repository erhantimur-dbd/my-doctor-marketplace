-- Add 'expired' status to invoices and track treatment continuation reminders
ALTER TABLE invoices DROP CONSTRAINT IF EXISTS invoices_status_check;
ALTER TABLE invoices ADD CONSTRAINT invoices_status_check
  CHECK (status IN ('draft', 'sent', 'viewed', 'paid', 'overdue', 'expired', 'cancelled'));

-- Track how many reminders have been sent for each invoice (max 3)
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS reminders_sent INT NOT NULL DEFAULT 0;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS last_reminder_at TIMESTAMPTZ;
