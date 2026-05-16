-- Additive only: swipe/like/pass for Clicks feed (no changes to existing tables).
CREATE TABLE IF NOT EXISTS public.profile_swipes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  from_user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  to_user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  action text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT profile_swipes_no_self CHECK (from_user_id <> to_user_id),
  CONSTRAINT profile_swipes_action_check CHECK (action IN ('like', 'pass', 'super_like')),
  CONSTRAINT profile_swipes_unique_pair UNIQUE (from_user_id, to_user_id)
);

CREATE INDEX IF NOT EXISTS idx_profile_swipes_from_user ON public.profile_swipes (from_user_id);
CREATE INDEX IF NOT EXISTS idx_profile_swipes_to_user ON public.profile_swipes (to_user_id);

COMMENT ON TABLE public.profile_swipes IS 'Outgoing swipe/like/pass from Clicks; used for feed filtering and mutual match → DM.';

ALTER TABLE public.profile_swipes ENABLE ROW LEVEL SECURITY;

-- Read: only your own outgoing or incoming rows (needed for client feed filtering).
DROP POLICY IF EXISTS "profile_swipes_select_own" ON public.profile_swipes;
CREATE POLICY "profile_swipes_select_own"
  ON public.profile_swipes FOR SELECT
  TO authenticated
  USING (from_user_id = auth.uid() OR to_user_id = auth.uid());

-- Optional direct client writes (primary path is Edge Function with service role).
DROP POLICY IF EXISTS "profile_swipes_insert_own" ON public.profile_swipes;
CREATE POLICY "profile_swipes_insert_own"
  ON public.profile_swipes FOR INSERT
  TO authenticated
  WITH CHECK (from_user_id = auth.uid());

DROP POLICY IF EXISTS "profile_swipes_update_own_outgoing" ON public.profile_swipes;
CREATE POLICY "profile_swipes_update_own_outgoing"
  ON public.profile_swipes FOR UPDATE
  TO authenticated
  USING (from_user_id = auth.uid())
  WITH CHECK (from_user_id = auth.uid());
