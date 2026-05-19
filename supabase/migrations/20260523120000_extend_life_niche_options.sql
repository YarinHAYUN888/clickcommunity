-- Extend life_niche enum for onboarding personas (soldier active, discharged, business)

ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_life_niche_check;
ALTER TABLE public.profiles ADD CONSTRAINT profiles_life_niche_check
  CHECK (
    life_niche IS NULL
    OR life_niche IN (
      'soldier_post_service',
      'post_big_trip',
      'student',
      'first_job',
      'soldier_active_service',
      'discharged',
      'business_world'
    )
  );
