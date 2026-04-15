-- Chat search intent analytics
-- Append-only ledger of structured search filters used via the AI chat widget.
-- No raw user text stored (GDPR — same rationale as 00090).

CREATE TABLE IF NOT EXISTS chat_search_intents (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  specialty       TEXT,
  location        TEXT,
  language        TEXT,
  consultation_type TEXT,
  doctors_returned INTEGER NOT NULL DEFAULT 0,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Append-only: prevent mutations
CREATE OR REPLACE FUNCTION prevent_chat_intent_mutation()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'chat_search_intents is append-only';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER chat_search_intents_no_update
  BEFORE UPDATE OR DELETE ON chat_search_intents
  FOR EACH ROW EXECUTE FUNCTION prevent_chat_intent_mutation();

-- RLS: service-role inserts only (no public access)
ALTER TABLE chat_search_intents ENABLE ROW LEVEL SECURITY;

-- Index for common analytics queries
CREATE INDEX idx_chat_search_intents_created ON chat_search_intents (created_at DESC);
CREATE INDEX idx_chat_search_intents_specialty ON chat_search_intents (specialty) WHERE specialty IS NOT NULL;
