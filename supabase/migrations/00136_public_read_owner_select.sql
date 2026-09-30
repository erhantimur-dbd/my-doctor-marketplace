-- Stop anon listing of the public-read bucket. Public URLs still load
-- because the bucket is public. The owner SELECT is kept because upsert
-- and remove need it.
--
-- 00135 is reserved for PR #103.
-- DROP POLICY IF EXISTS is a no-op when the policy is already gone, so
-- dropping and recreating the owner SELECT is safe to run twice.

DROP POLICY IF EXISTS "Public-read media is publicly accessible" ON storage.objects;

DROP POLICY IF EXISTS "Users can read own public-read media" ON storage.objects;

CREATE POLICY "Users can read own public-read media"
  ON storage.objects
  FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'public-read'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );
