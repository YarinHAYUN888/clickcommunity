-- Backfill profile moderation/suitability columns for environments
-- where migration history was out of sync with an existing schema.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS suitability_status text NOT NULL DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS is_shadow boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS moderation_status text NOT NULL DEFAULT 'approved',
  ADD COLUMN IF NOT EXISTS super_role text,
  ADD COLUMN IF NOT EXISTS role text,
  ADD COLUMN IF NOT EXISTS suspended boolean NOT NULL DEFAULT false;

ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_suitability_status_check;
ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_suitability_status_check
  CHECK (suitability_status IN ('active', 'pending', 'shadow', 'blocked'));

ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_moderation_status_check;
ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_moderation_status_check
  CHECK (moderation_status IN ('approved', 'pending', 'rejected'));
