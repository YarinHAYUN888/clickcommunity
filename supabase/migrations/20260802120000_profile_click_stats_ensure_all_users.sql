-- Ensure every profile has a profile_click_stats row (0 clicks default).
-- Safe to run after 20260729120000; does not reset existing counts or unlock timestamps.

INSERT INTO public.profile_click_stats (user_id, incoming_click_count, event_access_unlocked_at, updated_at)
SELECT
  p.user_id,
  COALESCE(sw.cnt, 0),
  CASE WHEN COALESCE(sw.cnt, 0) >= 5 THEN now() ELSE NULL END,
  now()
FROM public.profiles p
LEFT JOIN (
  SELECT to_user_id, count(*)::integer AS cnt
  FROM public.profile_swipes
  WHERE action IN ('like', 'super_like')
  GROUP BY to_user_id
) sw ON sw.to_user_id = p.user_id
WHERE NOT EXISTS (
  SELECT 1 FROM public.profile_click_stats pcs WHERE pcs.user_id = p.user_id
)
ON CONFLICT (user_id) DO NOTHING;

-- New signups: create stats row alongside profile (trigger maintains counts thereafter).
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role text := 'member';
  v_setting text;
BEGIN
  SELECT value INTO v_setting
  FROM public.system_settings
  WHERE key = 'default_new_user_role'
  LIMIT 1;

  IF v_setting IS NOT NULL THEN
    v_setting := lower(trim(v_setting));
    IF v_setting IN ('guest', 'member', 'community_member') THEN
      v_role := CASE WHEN v_setting = 'guest' THEN 'guest' ELSE 'member' END;
    END IF;
  END IF;

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
    v_role,
    'approved',
    'active',
    false
  );

  INSERT INTO public.profile_click_stats (user_id, incoming_click_count)
  VALUES (NEW.id, 0)
  ON CONFLICT (user_id) DO NOTHING;

  RETURN NEW;
END;
$$;
