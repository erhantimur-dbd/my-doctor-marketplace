-- Add GMC (General Medical Council) reference number for doctor verification
ALTER TABLE doctors ADD COLUMN IF NOT EXISTS gmc_number TEXT;

-- Index for admin lookups
CREATE INDEX IF NOT EXISTS idx_doctors_gmc_number ON doctors (gmc_number) WHERE gmc_number IS NOT NULL;
