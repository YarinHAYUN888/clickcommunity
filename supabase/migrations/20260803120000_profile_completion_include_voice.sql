-- Additive: include uploaded voice intro in profile_completion score (still max 100).
-- Existing users without voice drop from 100→90 display only; profile_completed is unchanged.
-- No DROP of data/columns; CREATE OR REPLACE function only.

CREATE OR REPLACE FUNCTION public.profile_completion_score_from_row(p public.profiles)
RETURNS INTEGER
LANGUAGE plpgsql
STABLE
SET search_path TO 'public'
AS $$
DECLARE
  completion INTEGER := 0;
BEGIN
  IF p.first_name IS NOT NULL AND LENGTH(TRIM(p.first_name)) >= 2 THEN
    completion := completion + 10;
  END IF;

  IF p.date_of_birth IS NOT NULL THEN
    completion := completion + 10;
  END IF;

  IF p.gender IS NOT NULL AND LENGTH(TRIM(p.gender)) >= 1 THEN
    completion := completion + 10;
  END IF;

  -- Photos: 15 (was 20) — room for voice intro points
  IF p.photos IS NOT NULL AND COALESCE(array_length(p.photos, 1), 0) >= 1 THEN
    completion := completion + 15;
  ELSIF p.avatar_url IS NOT NULL AND LENGTH(TRIM(p.avatar_url)) >= 1 THEN
    completion := completion + 15;
  END IF;

  -- Voice intro stored in private bucket and marked uploaded
  IF p.voice_intro_url IS NOT NULL
     AND LENGTH(TRIM(p.voice_intro_url)) >= 1
     AND p.voice_intro_status IS NOT NULL
     AND p.voice_intro_status = 'uploaded' THEN
    completion := completion + 10;
  END IF;

  IF p.occupation IS NOT NULL AND LENGTH(TRIM(p.occupation)) >= 2 THEN
    completion := completion + 10;
  END IF;

  -- Bio: 10 (was 15)
  IF p.bio IS NOT NULL AND LENGTH(TRIM(p.bio)) >= 1 THEN
    completion := completion + 10;
  END IF;

  IF p.interests IS NOT NULL AND COALESCE(array_length(p.interests, 1), 0) >= 5 THEN
    completion := completion + 25;
  END IF;

  RETURN LEAST(completion, 100);
END;
$$;
