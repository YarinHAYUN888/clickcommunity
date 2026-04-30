-- Fix the infinite recursion: remove the UPDATE inside calculate_profile_completion
-- The trigger already assigns the return value to NEW.profile_completion
CREATE OR REPLACE FUNCTION public.calculate_profile_completion(p_user_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  completion INTEGER := 0;
  u RECORD;
BEGIN
  SELECT * INTO u FROM public.profiles WHERE user_id = p_user_id;

  IF u.first_name IS NOT NULL AND LENGTH(u.first_name) >= 2 THEN
    completion := completion + 10;
  END IF;

  IF u.date_of_birth IS NOT NULL THEN
    completion := completion + 10;
  END IF;

  IF u.gender IS NOT NULL THEN
    completion := completion + 10;
  END IF;

  IF u.photos IS NOT NULL AND array_length(u.photos, 1) >= 1 THEN
    completion := completion + 20;
  END IF;

  IF u.occupation IS NOT NULL AND LENGTH(u.occupation) >= 2 THEN
    completion := completion + 10;
  END IF;

  IF u.bio IS NOT NULL AND LENGTH(u.bio) >= 1 THEN
    completion := completion + 15;
  END IF;

  IF u.interests IS NOT NULL AND array_length(u.interests, 1) >= 5 THEN
    completion := completion + 25;
  END IF;

  RETURN completion;
END;
$$;

-- Now set Yarin as admin
UPDATE profiles SET super_role = 'admin' WHERE user_id = '59856e1e-954e-4255-b1fb-d3511fb670cb';
