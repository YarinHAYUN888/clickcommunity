-- New auth users are community members by default (not guest).
-- Backfill existing guests per product policy.

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (
    user_id,
    referral_code,
    points,
    last_tenure_grant_at,
    role,
    moderation_status,
    suitability_status,
    is_shadow
  )
  VALUES (
    NEW.id,
    public.generate_unique_referral_code(),
    0,
    NOW(),
    'member',
    'approved',
    'active',
    false
  );
  RETURN NEW;
END;
$$;

ALTER TABLE public.profiles ALTER COLUMN role SET DEFAULT 'member';

UPDATE public.profiles
SET
  role = 'member',
  moderation_status = CASE
    WHEN moderation_status = 'rejected' THEN moderation_status
    ELSE COALESCE(NULLIF(moderation_status, ''), 'approved')
  END,
  suitability_status = COALESCE(NULLIF(suitability_status, ''), 'active'),
  is_shadow = COALESCE(is_shadow, false),
  updated_at = now()
WHERE role = 'guest' OR role IS NULL;
