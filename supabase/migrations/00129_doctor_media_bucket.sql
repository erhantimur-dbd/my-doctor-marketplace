-- Doctor practice photos and intro videos uploaded to a storage bucket
-- named "public", which does not exist. Create public-read instead.
-- Writes are limited to the caller's own folder: the first path segment
-- must be auth.uid(). Anyone can read objects in the bucket.
-- The photo UI still rejects files over 5MB. The bucket ceiling is 50MB
-- so profile videos (mp4, webm, quicktime) can share it.
--
-- Additive. Policies are created only when missing, so this does not remove
-- access on avatars or message-attachments. 00127 is reserved.
-- Safe inside BEGIN; ... ROLLBACK;.

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'public-read',
  'public-read',
  true,
  52428800, -- 50MB
  ARRAY[
    'image/jpeg',
    'image/png',
    'image/webp',
    'video/mp4',
    'video/webm',
    'video/quicktime'
  ]
)
ON CONFLICT (id) DO NOTHING;

DO $public_read_policies$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_catalog.pg_policies
    WHERE schemaname = 'storage'
      AND tablename = 'objects'
      AND policyname = 'Users can upload own public-read media'
  ) THEN
    CREATE POLICY "Users can upload own public-read media"
    ON storage.objects FOR INSERT
    TO authenticated
    WITH CHECK (
      bucket_id = 'public-read'
      AND auth.uid()::text = (storage.foldername(name))[1]
    );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_catalog.pg_policies
    WHERE schemaname = 'storage'
      AND tablename = 'objects'
      AND policyname = 'Users can update own public-read media'
  ) THEN
    CREATE POLICY "Users can update own public-read media"
    ON storage.objects FOR UPDATE
    TO authenticated
    USING (
      bucket_id = 'public-read'
      AND auth.uid()::text = (storage.foldername(name))[1]
    )
    WITH CHECK (
      bucket_id = 'public-read'
      AND auth.uid()::text = (storage.foldername(name))[1]
    );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_catalog.pg_policies
    WHERE schemaname = 'storage'
      AND tablename = 'objects'
      AND policyname = 'Users can delete own public-read media'
  ) THEN
    CREATE POLICY "Users can delete own public-read media"
    ON storage.objects FOR DELETE
    TO authenticated
    USING (
      bucket_id = 'public-read'
      AND auth.uid()::text = (storage.foldername(name))[1]
    );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_catalog.pg_policies
    WHERE schemaname = 'storage'
      AND tablename = 'objects'
      AND policyname = 'Public-read media is publicly accessible'
  ) THEN
    CREATE POLICY "Public-read media is publicly accessible"
    ON storage.objects FOR SELECT
    USING (bucket_id = 'public-read');
  END IF;
END
$public_read_policies$;
