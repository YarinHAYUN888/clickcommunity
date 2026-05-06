-- Additive moderation + onboarding progress fields (backward-compatible)
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS moderation_status text NOT NULL DEFAULT 'approved',
  ADD COLUMN IF NOT EXISTS moderation_reason text,
  ADD COLUMN IF NOT EXISTS moderation_confidence numeric(4,3),
  ADD COLUMN IF NOT EXISTS moderation_flags jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS moderation_reviewed_at timestamptz,
  ADD COLUMN IF NOT EXISTS moderation_reviewed_by uuid,
  ADD COLUMN IF NOT EXISTS profile_completed boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS image_upload_status text NOT NULL DEFAULT 'pending';

ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_moderation_status_check;
ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_moderation_status_check
  CHECK (moderation_status IN ('approved', 'pending', 'rejected'));

ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_image_upload_status_check;
ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_image_upload_status_check
  CHECK (image_upload_status IN ('pending', 'success', 'failed'));

CREATE INDEX IF NOT EXISTS idx_profiles_moderation_status
  ON public.profiles (moderation_status);

CREATE INDEX IF NOT EXISTS idx_profiles_profile_completed
  ON public.profiles (profile_completed);
