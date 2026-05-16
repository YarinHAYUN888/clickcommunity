-- New profile rows default to human review queue (additive; does not UPDATE existing rows).
ALTER TABLE public.profiles
  ALTER COLUMN moderation_status SET DEFAULT 'pending';

COMMENT ON COLUMN public.profiles.moderation_status IS 'approved | pending | rejected — staff/AI gate; default pending for new rows';
