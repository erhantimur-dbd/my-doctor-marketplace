-- Stop anon listing of the avatars bucket. Public URLs still load because
-- the bucket stays public. The owner SELECT is kept because the signed-in
-- avatar upsert needs it. Objects live in a folder per user
-- (<uid>/avatar.<ext>), matching the upload, update, and delete policies.
--
-- DROP POLICY IF EXISTS is a no-op when the policy is already gone, so
-- dropping and recreating the owner SELECT is safe to run twice.

DROP POLICY IF EXISTS "Avatar images are publicly accessible" ON storage.objects;

DROP POLICY IF EXISTS "Users can read own avatar" ON storage.objects;

CREATE POLICY "Users can read own avatar"
  ON storage.objects
  FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'avatars'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );
