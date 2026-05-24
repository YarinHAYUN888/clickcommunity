-- Remove "אחרי שירות / חיילות" from allowed life_niche values.

UPDATE public.profiles
SET life_niche = NULL
WHERE life_niche = 'soldier_post_service';

ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_life_niche_check;
ALTER TABLE public.profiles ADD CONSTRAINT profiles_life_niche_check
  CHECK (
    life_niche IS NULL
    OR life_niche IN (
      'post_big_trip',
      'student',
      'first_job',
      'soldier_active_service',
      'discharged',
      'business_world'
    )
  );
