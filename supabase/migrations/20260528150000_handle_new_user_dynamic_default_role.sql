-- Align auth trigger profile creation with system_settings.default_new_user_role

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
  RETURN NEW;
END;
$$;
