-- Defensive, additive guard: ensure profile_swipes.action allows 'like', 'pass', 'super_like'.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'profile_swipes'
  ) THEN
    ALTER TABLE public.profile_swipes DROP CONSTRAINT IF EXISTS profile_swipes_action_check;
    ALTER TABLE public.profile_swipes
      ADD CONSTRAINT profile_swipes_action_check
      CHECK (action IN ('like', 'pass', 'super_like'));
  END IF;
END $$;
