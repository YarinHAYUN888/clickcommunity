-- Stage 5: points ledger, referral codes, tenure anchor

-- ============================================
-- PROFILE COLUMNS
-- ============================================
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS points INTEGER NOT NULL DEFAULT 0;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS referral_code TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS last_tenure_grant_at TIMESTAMPTZ;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS referral_cap_override INTEGER NULL;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS referral_disabled BOOLEAN NOT NULL DEFAULT FALSE;

-- ============================================
-- REFERRAL CODE GENERATION + TRIGGER PROFILE ROW
-- ============================================
CREATE OR REPLACE FUNCTION public.generate_unique_referral_code()
RETURNS TEXT
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  chars TEXT := '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ';
  result TEXT := '';
  i INT;
  tries INT := 0;
BEGIN
  LOOP
    result := '';
    FOR i IN 1..8 LOOP
      result := result || substr(chars, (floor(random() * length(chars))::int + 1), 1);
    END LOOP;
    EXIT WHEN NOT EXISTS (SELECT 1 FROM public.profiles p WHERE p.referral_code = result);
    tries := tries + 1;
    IF tries > 200 THEN
      RAISE EXCEPTION 'referral_code_generation_failed';
    END IF;
  END LOOP;
  RETURN result;
END;
$$;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (user_id, referral_code, points, last_tenure_grant_at)
  VALUES (NEW.id, public.generate_unique_referral_code(), 0, NOW());
  RETURN NEW;
END;
$$;

-- Backfill codes for profiles still missing (pre-migration rows)
UPDATE public.profiles
SET referral_code = public.generate_unique_referral_code()
WHERE referral_code IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_profiles_referral_code_unique ON public.profiles(referral_code);

ALTER TABLE public.profiles ALTER COLUMN referral_code SET NOT NULL;

UPDATE public.profiles
SET last_tenure_grant_at = created_at
WHERE last_tenure_grant_at IS NULL;

-- ============================================
-- POINTS HISTORY
-- ============================================
CREATE TABLE IF NOT EXISTS public.points_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  amount INTEGER NOT NULL,
  ref_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_points_history_user_created ON public.points_history(user_id, created_at DESC);

ALTER TABLE public.points_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read own points_history" ON public.points_history
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Super users read all points_history" ON public.points_history
  FOR SELECT TO authenticated
  USING (public.is_super_user(auth.uid()));

-- No INSERT/UPDATE/DELETE for authenticated clients; service role bypasses RLS

-- ============================================
-- APPLY POINTS BALANCE FROM LEDGER
-- ============================================
CREATE OR REPLACE FUNCTION public.apply_points_history_delta()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.profiles
  SET points = COALESCE(points, 0) + NEW.amount
  WHERE user_id = NEW.user_id;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tr_points_history_after_insert ON public.points_history;
CREATE TRIGGER tr_points_history_after_insert
  AFTER INSERT ON public.points_history
  FOR EACH ROW
  EXECUTE FUNCTION public.apply_points_history_delta();

-- ============================================
-- DEDUPE: one registered referral reward per referred user per referrer
-- ============================================
CREATE UNIQUE INDEX IF NOT EXISTS idx_referrals_referrer_referred_user
  ON public.referrals(referrer_id, referred_user_id)
  WHERE referred_user_id IS NOT NULL;
