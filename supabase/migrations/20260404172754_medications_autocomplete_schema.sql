-- MD360 prod migration export (supabase_migrations.schema_migrations, project zlixmfcppzvbayyjymrv)
-- version: 20260404172754
-- name: medications_autocomplete_schema
-- statements joined with ';\n' in stored order; body below is verbatim (md5 a6a7c6730deb82517de21a780163db0f)


CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE TABLE IF NOT EXISTS medications (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  generic_name TEXT,
  category TEXT NOT NULL,
  form TEXT,
  is_common BOOLEAN DEFAULT true
);

CREATE INDEX IF NOT EXISTS idx_medications_name_trgm ON medications USING GIN (name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_medications_generic_name_trgm ON medications USING GIN (generic_name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_medications_category ON medications USING btree (category);

ALTER TABLE medications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read access for autocomplete"
  ON medications
  FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE OR REPLACE FUNCTION search_medications(search_query TEXT, max_results INT DEFAULT 10)
RETURNS TABLE (
  id INT,
  name TEXT,
  generic_name TEXT,
  category TEXT,
  form TEXT
)
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  result_count INT;
BEGIN
  RETURN QUERY
    SELECT m.id, m.name, m.generic_name, m.category, m.form
    FROM medications m
    WHERE similarity(m.name, search_query) > 0.1
       OR similarity(COALESCE(m.generic_name, ''), search_query) > 0.1
    ORDER BY GREATEST(
      similarity(m.name, search_query),
      similarity(COALESCE(m.generic_name, ''), search_query)
    ) DESC
    LIMIT max_results;

  GET DIAGNOSTICS result_count = ROW_COUNT;

  IF result_count = 0 THEN
    RETURN QUERY
      SELECT m.id, m.name, m.generic_name, m.category, m.form
      FROM medications m
      WHERE m.name ILIKE search_query || '%'
         OR m.generic_name ILIKE search_query || '%'
      ORDER BY
        CASE WHEN m.name ILIKE search_query || '%' THEN 0 ELSE 1 END,
        m.name
      LIMIT max_results;
  END IF;
END;
$$;
