-- Additive only: generic user click actions (Boost, and optional super_like audit).
-- Boost is a global self-action (target_user_id NULL) with an expiry; it powers feed priority.
CREATE TABLE IF NOT EXISTS public.user_click_actions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  target_user_id uuid REFERENCES auth.users (id) ON DELETE CASCADE,
  action_type text NOT NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  expires_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT user_click_actions_action_type_check CHECK (action_type IN ('boost', 'super_like'))
);

CREATE INDEX IF NOT EXISTS idx_user_click_actions_user ON public.user_click_actions (user_id);
CREATE INDEX IF NOT EXISTS idx_user_click_actions_type_expiry ON public.user_click_actions (action_type, expires_at);

COMMENT ON TABLE public.user_click_actions IS 'Generic Clicks actions (Boost self-action with expiry, optional super_like audit). Boost rows have target_user_id NULL.';

ALTER TABLE public.user_click_actions ENABLE ROW LEVEL SECURITY;

-- Read: own rows, or any row for super users (admin visibility).
DROP POLICY IF EXISTS "user_click_actions_select_own_or_super" ON public.user_click_actions;
CREATE POLICY "user_click_actions_select_own_or_super"
  ON public.user_click_actions FOR SELECT
  TO authenticated
  USING (user_id = auth.uid() OR public.is_super_user(auth.uid()));

-- Read: currently-active boost rows are visible to all members (needed for feed priority).
-- Scoped to non-expired boosts only; no PII beyond user_id is selected by the client.
DROP POLICY IF EXISTS "user_click_actions_select_active_boosts" ON public.user_click_actions;
CREATE POLICY "user_click_actions_select_active_boosts"
  ON public.user_click_actions FOR SELECT
  TO authenticated
  USING (action_type = 'boost' AND expires_at IS NOT NULL AND expires_at > now());

-- Write: only your own rows (primary path is Edge Function with service role).
DROP POLICY IF EXISTS "user_click_actions_insert_own" ON public.user_click_actions;
CREATE POLICY "user_click_actions_insert_own"
  ON public.user_click_actions FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());
