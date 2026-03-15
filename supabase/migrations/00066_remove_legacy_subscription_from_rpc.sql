-- Remove legacy doctor_subscriptions fallback from get_licensed_doctor_ids()
-- All subscription checks now use the licenses table only.

CREATE OR REPLACE FUNCTION get_licensed_doctor_ids()
RETURNS SETOF uuid
LANGUAGE sql
STABLE
AS $$
  SELECT d.id
  FROM doctors d
  JOIN licenses l ON d.organization_id = l.organization_id
  WHERE l.status IN ('active', 'trialing', 'past_due');
$$;
