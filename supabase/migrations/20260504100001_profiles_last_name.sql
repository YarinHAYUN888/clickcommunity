-- Optional from plan: persist last name on profile row (Auth still has metadata from complete-registration).

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS last_name text;

COMMENT ON COLUMN public.profiles.last_name IS 'Family name collected at onboarding';
