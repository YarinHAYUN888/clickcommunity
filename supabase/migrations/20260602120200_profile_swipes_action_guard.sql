-- Defensive, additive guard: ensure profile_swipes.action allows 'like', 'pass', 'super_like'.
-- Covers possible production drift where an older CHECK constraint omitted 'super_like'.
-- All existing rows are a subset of these values, so recreating the constraint is safe.

ALTER TABLE public.profile_swipes
  DROP CONSTRAINT IF EXISTS profile_swipes_action_check;

ALTER TABLE public.profile_swipes
  ADD CONSTRAINT profile_swipes_action_check
  CHECK (action IN ('like', 'pass', 'super_like'));
