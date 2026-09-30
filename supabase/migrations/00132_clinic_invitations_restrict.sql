-- clinic_invitations: the public read let anon list every pending row,
-- including token, email and role. Production has that policy and no other
-- public variant. The accept page looks up one token with the service role.
-- Apply after that code is live. DROP IF EXISTS covers a repo rebuild and
-- Production.

DROP POLICY IF EXISTS "Anyone can read pending invitations by token"
  ON public.clinic_invitations;
