-- MD360 prod migration export (supabase_migrations.schema_migrations, project zlixmfcppzvbayyjymrv)
-- version: 20260308181810
-- name: invoice_reminders_and_expired_status
-- statements joined with ';\n' in stored order; body below is verbatim (md5 89326a022285f36d36806e9e4bd5fa5a)

-- Add 'expired' status to invoices and track treatment continuation reminders
ALTER TABLE invoices DROP CONSTRAINT IF EXISTS invoices_status_check;
ALTER TABLE invoices ADD CONSTRAINT invoices_status_check
  CHECK (status IN ('draft', 'sent', 'viewed', 'paid', 'overdue', 'expired', 'cancelled'));

-- Track how many reminders have been sent for each invoice (max 3)
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS reminders_sent INT NOT NULL DEFAULT 0;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS last_reminder_at TIMESTAMPTZ;
