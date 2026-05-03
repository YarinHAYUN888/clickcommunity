-- Compute profile_completion from the row being written (fixes stale SELECT in BEFORE UPDATE).

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

  IF p.photos IS NOT NULL AND COALESCE(array_length(p.photos, 1), 0) >= 1 THEN
    completion := completion + 20;
  END IF;

  IF p.occupation IS NOT NULL AND LENGTH(TRIM(p.occupation)) >= 2 THEN
    completion := completion + 10;
  END IF;

  IF p.bio IS NOT NULL AND LENGTH(TRIM(p.bio)) >= 1 THEN
    completion := completion + 15;
  END IF;

  IF p.interests IS NOT NULL AND COALESCE(array_length(p.interests, 1), 0) >= 5 THEN
    completion := completion + 25;
  END IF;

  RETURN completion;
END;
$$;

CREATE OR REPLACE FUNCTION public.trigger_update_profile_completion()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  NEW.profile_completion := public.profile_completion_score_from_row(NEW);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_profile_completion ON public.profiles;
CREATE TRIGGER trigger_profile_completion
  BEFORE INSERT OR UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.trigger_update_profile_completion();

-- Keep RPC callers consistent: same rules, reads current row (OK for ad-hoc recalc).
CREATE OR REPLACE FUNCTION public.calculate_profile_completion(p_user_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  u public.profiles%ROWTYPE;
BEGIN
  SELECT * INTO u FROM public.profiles WHERE user_id = p_user_id;
  IF NOT FOUND THEN
    RETURN 0;
  END IF;
  RETURN public.profile_completion_score_from_row(u);
END;
$$;
