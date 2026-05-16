-- Life niche (stable enum for feed matching) + community vouch pipeline (5 approvals path)

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS life_niche text,
  ADD COLUMN IF NOT EXISTS community_vouch_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS community_welcome_sms_sent_at timestamptz;

UPDATE public.profiles SET community_vouch_count = 0 WHERE community_vouch_count IS NULL;

ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_life_niche_check;
ALTER TABLE public.profiles ADD CONSTRAINT profiles_life_niche_check
  CHECK (
    life_niche IS NULL
    OR life_niche IN (
      'soldier_post_service',
      'post_big_trip',
      'student',
      'first_job'
    )
  );

COMMENT ON COLUMN public.profiles.life_niche IS 'Stable persona key for matching (see client LIFE_NICHE_OPTIONS)';
COMMENT ON COLUMN public.profiles.community_vouch_count IS 'Number of distinct community_vouches rows for this user as target';
COMMENT ON COLUMN public.profiles.community_welcome_sms_sent_at IS 'When welcome SMS after approval was sent (null = not sent)';

CREATE TABLE IF NOT EXISTS public.community_vouches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  target_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  voucher_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  event_id uuid REFERENCES public.events(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT community_vouches_distinct_pair UNIQUE (target_user_id, voucher_user_id),
  CONSTRAINT community_vouches_no_self_vouch CHECK (target_user_id <> voucher_user_id)
);

CREATE INDEX IF NOT EXISTS idx_community_vouches_target ON public.community_vouches (target_user_id);
CREATE INDEX IF NOT EXISTS idx_community_vouches_created ON public.community_vouches (created_at DESC);

CREATE OR REPLACE FUNCTION public.increment_community_vouch_count_for_target()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.profiles
  SET community_vouch_count = COALESCE(community_vouch_count, 0) + 1
  WHERE user_id = NEW.target_user_id;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tr_community_vouches_bump ON public.community_vouches;
CREATE TRIGGER tr_community_vouches_bump
  AFTER INSERT ON public.community_vouches
  FOR EACH ROW
  EXECUTE FUNCTION public.increment_community_vouch_count_for_target();

ALTER TABLE public.community_vouches ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "community_vouches_select_own_or_super" ON public.community_vouches;
CREATE POLICY "community_vouches_select_own_or_super" ON public.community_vouches
  FOR SELECT TO authenticated
  USING (
    auth.uid() = target_user_id
    OR auth.uid() = voucher_user_id
    OR public.is_super_user(auth.uid())
  );

DROP POLICY IF EXISTS "community_vouches_insert_member" ON public.community_vouches;
CREATE POLICY "community_vouches_insert_member" ON public.community_vouches
  FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = voucher_user_id
    AND voucher_user_id <> target_user_id
  );
