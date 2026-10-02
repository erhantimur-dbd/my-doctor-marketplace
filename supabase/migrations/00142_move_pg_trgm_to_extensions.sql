-- Move pg_trgm out of public (advisor 0014 extension_in_public).
--
-- Must run after 00140. That migration pins public.search_medications to
-- search_path '' and calls public.similarity. Moving the extension alone
-- would make that RPC fail at runtime, because plpgsql binds the name when
-- the function runs. This file is one transaction:
--   1. assert 00140 is applied (proconfig contains search_path="");
--   2. ALTER EXTENSION pg_trgm SET SCHEMA extensions;
--   3. recreate public.search_medications with the same signature, body,
--      volatility, and search_path, calling extensions.similarity;
--   4. post-check the extension schema, that no public function still calls
--      public.similarity, and that the four gin_trgm_ops indexes are valid.
--
-- Grants and SECURITY INVOKER stay as they were. This file does not GRANT
-- or REVOKE EXECUTE. CREATE OR REPLACE keeps the existing ACL and owner;
-- the rewrite does not say SECURITY DEFINER. The post-check compares
-- proacl, prosecdef, and proowner with the pre-rewrite row.
--
-- search_allergies and search_chronic_conditions are unchanged. 00127 pins
-- them to search_path public, extensions, so unqualified similarity()
-- resolves in extensions after the move. The four GIN indexes reference
-- gin_trgm_ops by OID, so they stay valid when the opclass moves.
--
-- On hosted Supabase the migration role is not a superuser and pg_trgm is
-- owned by supabase_admin. SET SCHEMA should be allowed by supautils
-- (pg_trgm is a privileged extension) but that is unverified: dry-run this
-- on a Supabase branch before applying it. This file does not drop the
-- extension or rebuild the indexes.
--
-- Safe to run twice. The Supabase migration runner applies this file as a
-- single transaction, so the schema move and the function rewrite commit
-- or roll back together.

DO $guard_00142$
DECLARE
  v_proc oid := pg_catalog.to_regprocedure('public.search_medications(text, integer)');
BEGIN
  -- 00140 must already be applied, or a later run of it would put
  -- public.similarity back under search_path ''.
  IF v_proc IS NULL OR NOT EXISTS (
    SELECT 1
    FROM pg_catalog.pg_proc AS p
    CROSS JOIN LATERAL pg_catalog.unnest(p.proconfig) AS cfg
    WHERE p.oid = v_proc
      AND cfg = 'search_path=""'
  ) THEN
    RAISE EXCEPTION '00142 requires 00140 (search_medications search_path pin) to be applied first';
  END IF;
END
$guard_00142$;

DO $move_00142$
DECLARE
  v_schema name;
BEGIN
  IF pg_catalog.to_regnamespace('extensions') IS NULL THEN
    RAISE EXCEPTION 'schema extensions does not exist';
  END IF;

  SELECT n.nspname
  INTO v_schema
  FROM pg_catalog.pg_extension AS e
  JOIN pg_catalog.pg_namespace AS n ON n.oid = e.extnamespace
  WHERE e.extname = 'pg_trgm';

  IF v_schema IS NULL THEN
    RAISE EXCEPTION 'pg_trgm is not installed';
  ELSIF v_schema = 'public' THEN
    ALTER EXTENSION pg_trgm SET SCHEMA extensions;
  ELSIF v_schema <> 'extensions' THEN
    RAISE EXCEPTION 'pg_trgm is in unexpected schema %', v_schema;
  END IF;
END
$move_00142$;

-- Compared again after the rewrite. CREATE OR REPLACE must not change them.
CREATE TEMP TABLE _00142_search_medications_before ON COMMIT DROP AS
SELECT p.proacl, p.prosecdef, p.proowner, p.proconfig
FROM pg_catalog.pg_proc AS p
WHERE p.oid = pg_catalog.to_regprocedure('public.search_medications(text, integer)');

-- Same function as 00140, with extensions.similarity instead of public.similarity.
CREATE OR REPLACE FUNCTION public.search_medications(search_query TEXT, max_results INT DEFAULT 10)
RETURNS TABLE (
  id INT,
  name TEXT,
  generic_name TEXT,
  category TEXT,
  form TEXT
)
LANGUAGE plpgsql
STABLE
SET search_path = ''
AS $$
DECLARE
  result_count INT;
BEGIN
  RETURN QUERY
    SELECT m.id, m.name, m.generic_name, m.category, m.form
    FROM public.medications m
    WHERE extensions.similarity(m.name, search_query) > 0.1
       OR extensions.similarity(COALESCE(m.generic_name, ''), search_query) > 0.1
    ORDER BY GREATEST(
      extensions.similarity(m.name, search_query),
      extensions.similarity(COALESCE(m.generic_name, ''), search_query)
    ) DESC
    LIMIT max_results;

  GET DIAGNOSTICS result_count = ROW_COUNT;

  IF result_count = 0 THEN
    RETURN QUERY
      SELECT m.id, m.name, m.generic_name, m.category, m.form
      FROM public.medications m
      WHERE m.name ILIKE search_query || '%'
         OR m.generic_name ILIKE search_query || '%'
      ORDER BY
        CASE WHEN m.name ILIKE search_query || '%' THEN 0 ELSE 1 END,
        m.name
      LIMIT max_results;
  END IF;
END;
$$;

DO $assert_00142$
DECLARE
  v_bad text;
  v_calls int;
BEGIN
  IF (SELECT n.nspname
      FROM pg_catalog.pg_extension AS e
      JOIN pg_catalog.pg_namespace AS n ON n.oid = e.extnamespace
      WHERE e.extname = 'pg_trgm') <> 'extensions' THEN
    RAISE EXCEPTION 'pg_trgm is not in schema extensions';
  END IF;

  IF pg_catalog.to_regprocedure('extensions.similarity(text, text)') IS NULL THEN
    RAISE EXCEPTION 'extensions.similarity(text, text) missing';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_catalog.pg_proc AS p
    CROSS JOIN LATERAL pg_catalog.unnest(p.proconfig) AS cfg
    WHERE p.oid = pg_catalog.to_regprocedure('public.search_medications(text, integer)')
      AND cfg = 'search_path=""'
      AND NOT p.prosecdef
  ) THEN
    RAISE EXCEPTION 'search_medications lost its search_path pin or invoker security';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM pg_catalog.pg_proc AS p
    JOIN _00142_search_medications_before AS before ON true
    WHERE p.oid = pg_catalog.to_regprocedure('public.search_medications(text, integer)')
      AND (
        p.proacl IS DISTINCT FROM before.proacl
        OR p.prosecdef IS DISTINCT FROM before.prosecdef
        OR p.proowner IS DISTINCT FROM before.proowner
        OR p.proconfig IS DISTINCT FROM before.proconfig
      )
  ) THEN
    RAISE EXCEPTION 'search_medications grants or security settings changed';
  END IF;

  SELECT count(*)
  INTO v_calls
  FROM pg_catalog.pg_proc AS p
  CROSS JOIN LATERAL pg_catalog.regexp_matches(p.prosrc, 'extensions\.similarity\s*\(', 'g') AS m
  WHERE p.oid = pg_catalog.to_regprocedure('public.search_medications(text, integer)');

  IF v_calls <> 4 THEN
    RAISE EXCEPTION 'search_medications must call extensions.similarity four times (found %)', v_calls;
  END IF;

  SELECT string_agg(p.oid::regprocedure::text, ', ' ORDER BY p.oid::regprocedure::text)
  INTO v_bad
  FROM pg_catalog.pg_proc AS p
  JOIN pg_catalog.pg_namespace AS n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public'
    AND p.prosrc ~* 'public\.(similarity|word_similarity|strict_word_similarity|show_trgm|set_limit)\s*\(';

  IF v_bad IS NOT NULL THEN
    RAISE EXCEPTION 'functions still reference public trgm functions: %', v_bad;
  END IF;

  SELECT string_agg(expected, ', ' ORDER BY expected)
  INTO v_bad
  FROM (
    VALUES
      ('idx_allergies_name_trgm'),
      ('idx_chronic_conditions_name_trgm'),
      ('idx_medications_generic_name_trgm'),
      ('idx_medications_name_trgm')
  ) AS e(expected)
  WHERE NOT EXISTS (
    SELECT 1
    FROM pg_catalog.pg_class AS c
    JOIN pg_catalog.pg_namespace AS n ON n.oid = c.relnamespace
    JOIN pg_catalog.pg_index AS i ON i.indexrelid = c.oid
    WHERE n.nspname = 'public'
      AND c.relname = e.expected
      AND i.indisvalid
      AND i.indisready
  );

  IF v_bad IS NOT NULL THEN
    RAISE EXCEPTION 'trgm indexes missing or invalid: %', v_bad;
  END IF;

  SELECT string_agg(i.indexrelid::regclass::text, ', ' ORDER BY i.indexrelid::regclass::text)
  INTO v_bad
  FROM pg_catalog.pg_index AS i
  CROSS JOIN LATERAL pg_catalog.unnest(i.indclass::oid[]) AS u(opc)
  JOIN pg_catalog.pg_opclass AS o ON o.oid = u.opc
  WHERE o.opcname IN ('gin_trgm_ops', 'gist_trgm_ops')
    AND o.opcnamespace <> 'extensions'::regnamespace;

  IF v_bad IS NOT NULL THEN
    RAISE EXCEPTION 'trgm indexes still use a non-extensions opclass: %', v_bad;
  END IF;
END
$assert_00142$;
