-- Ensure profile_swipes exists on production (safe IF NOT EXISTS).
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

ALTER TABLE public.profile_swipes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "profile_swipes_select_own" ON public.profile_swipes;
CREATE POLICY "profile_swipes_select_own"
  ON public.profile_swipes FOR SELECT
  TO authenticated
  USING (from_user_id = auth.uid() OR to_user_id = auth.uid());

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

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'profile_swipes'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.profile_swipes;
  END IF;
EXCEPTION
  WHEN undefined_object THEN NULL;
END $$;
