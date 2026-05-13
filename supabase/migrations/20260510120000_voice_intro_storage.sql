-- Voice intro onboarding: additive profile columns + private storage bucket (voice-intros)

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS voice_intro_url text;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS voice_intro_duration int;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS voice_intro_status text;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS voice_intro_meta jsonb NOT NULL DEFAULT '{}'::jsonb;

COMMENT ON COLUMN public.profiles.voice_intro_url IS 'Object path inside bucket voice-intros (not a public URL)';
COMMENT ON COLUMN public.profiles.voice_intro_duration IS 'Recorded duration in seconds';
COMMENT ON COLUMN public.profiles.voice_intro_status IS 'pending | uploaded | failed (null if user skipped voice intro)';
COMMENT ON COLUMN public.profiles.voice_intro_meta IS 'Reserved for future: transcript, moderation, toxicityScore (Whisper/AI analysis) — not used in MVP';

ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_voice_intro_status_check;
ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_voice_intro_status_check
  CHECK (
    voice_intro_status IS NULL
    OR voice_intro_status IN ('pending', 'uploaded', 'failed')
  );

-- Private bucket: signed URLs + path-based access only
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'voice-intros',
  'voice-intros',
  false,
  4194304,
  ARRAY['audio/webm', 'audio/mp4', 'audio/mpeg', 'audio/ogg', 'audio/wav']
)
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- Storage RLS: own folder only (first path segment = user id)
DROP POLICY IF EXISTS "Voice intros owner select" ON storage.objects;
CREATE POLICY "Voice intros owner select"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'voice-intros'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

DROP POLICY IF EXISTS "Voice intros owner insert" ON storage.objects;
CREATE POLICY "Voice intros owner insert"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'voice-intros'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

DROP POLICY IF EXISTS "Voice intros owner update" ON storage.objects;
CREATE POLICY "Voice intros owner update"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'voice-intros'
    AND auth.uid()::text = (storage.foldername(name))[1]
  )
  WITH CHECK (
    bucket_id = 'voice-intros'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

DROP POLICY IF EXISTS "Voice intros owner delete" ON storage.objects;
CREATE POLICY "Voice intros owner delete"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'voice-intros'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

-- Admins read any object in bucket (for moderation dashboard signed URLs)
DROP POLICY IF EXISTS "Voice intros super user select" ON storage.objects;
CREATE POLICY "Voice intros super user select"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'voice-intros'
    AND public.is_super_user(auth.uid())
  );
