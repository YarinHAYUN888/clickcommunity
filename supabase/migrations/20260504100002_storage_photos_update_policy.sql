-- Allow authenticated users to overwrite their own objects (upload with upsert: true).

DROP POLICY IF EXISTS "Users update own photos" ON storage.objects;

CREATE POLICY "Users update own photos" ON storage.objects
  FOR UPDATE
  USING (
    bucket_id = 'photos'
    AND auth.uid()::text = (storage.foldername(name))[1]
  )
  WITH CHECK (
    bucket_id = 'photos'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );
