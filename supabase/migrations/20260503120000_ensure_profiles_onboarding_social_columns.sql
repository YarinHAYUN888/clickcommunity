-- Ensure onboarding profile fields exist (fixes PGRST204 if earlier migration was never applied).
-- Safe to re-run: IF NOT EXISTS

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS region text,
  ADD COLUMN IF NOT EXISTS region_other text,
  ADD COLUMN IF NOT EXISTS instagram text,
  ADD COLUMN IF NOT EXISTS tiktok text;

COMMENT ON COLUMN public.profiles.region IS 'Geographic region in Israel (one of: דרום, ירושלים, מרכז, שרון, צפון, אחר)';
COMMENT ON COLUMN public.profiles.region_other IS 'Free-text region when region = אחר';
COMMENT ON COLUMN public.profiles.instagram IS 'Instagram handle or URL (optional)';
COMMENT ON COLUMN public.profiles.tiktok IS 'TikTok handle or URL (optional)';
