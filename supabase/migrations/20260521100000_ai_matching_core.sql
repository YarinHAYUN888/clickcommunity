-- AI matching engine: preferences, personality cache, match scores, behavior events (additive only).

-- ---------------------------------------------------------------------------
-- profile_preferences: what the user is looking for (1:1 per user)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.profile_preferences (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  preferred_gender text,
  min_age integer CHECK (min_age IS NULL OR (min_age >= 18 AND min_age <= 120)),
  max_age integer CHECK (max_age IS NULL OR (max_age >= 18 AND max_age <= 120)),
  preferred_regions text[] NOT NULL DEFAULT '{}',
  relationship_goal text,
  smoking_preference text,
  drinking_preference text,
  religion_preference text,
  wants_children text,
  languages text[] NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT profile_preferences_one_per_user UNIQUE (user_id),
  CONSTRAINT profile_preferences_age_order CHECK (
    min_age IS NULL OR max_age IS NULL OR min_age <= max_age
  )
);

CREATE INDEX IF NOT EXISTS idx_profile_preferences_user_id ON public.profile_preferences (user_id);

ALTER TABLE public.profile_preferences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own profile_preferences"
  ON public.profile_preferences
  FOR ALL
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE TRIGGER update_profile_preferences_updated_at
  BEFORE UPDATE ON public.profile_preferences
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

COMMENT ON TABLE public.profile_preferences IS 'Dating-style preferences for AI matching (self-managed).';

-- ---------------------------------------------------------------------------
-- profile_personality_ai: AI-derived traits (writes via service role / Edge)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.profile_personality_ai (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  personality_summary text,
  energy_type text CHECK (energy_type IS NULL OR energy_type IN ('calm', 'social', 'intense', 'balanced')),
  communication_style text,
  emotional_style text,
  social_style text,
  relationship_intent text,
  lifestyle_type text,
  community_risk text NOT NULL DEFAULT 'low' CHECK (community_risk IN ('low', 'medium', 'high')),
  ai_tags jsonb NOT NULL DEFAULT '[]'::jsonb,
  ai_score numeric(5, 2) CHECK (ai_score IS NULL OR (ai_score >= 0 AND ai_score <= 100)),
  analyzed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT profile_personality_ai_one_per_user UNIQUE (user_id)
);

CREATE INDEX IF NOT EXISTS idx_profile_personality_ai_user_id ON public.profile_personality_ai (user_id);
CREATE INDEX IF NOT EXISTS idx_profile_personality_ai_community_risk ON public.profile_personality_ai (community_risk);

ALTER TABLE public.profile_personality_ai ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read own profile_personality_ai"
  ON public.profile_personality_ai
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

COMMENT ON TABLE public.profile_personality_ai IS 'AI personality + safety signals; inserts/updates from Edge (service role).';

-- ---------------------------------------------------------------------------
-- profile_matches: cached compatibility between two users (ordered pair)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.profile_matches_order_pair()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  tmp uuid;
BEGIN
  IF NEW.user_a IS NULL OR NEW.user_b IS NULL THEN
    RAISE EXCEPTION 'user_a and user_b required';
  END IF;
  IF NEW.user_a = NEW.user_b THEN
    RAISE EXCEPTION 'self match not allowed';
  END IF;
  IF NEW.user_a::text > NEW.user_b::text THEN
    tmp := NEW.user_a;
    NEW.user_a := NEW.user_b;
    NEW.user_b := tmp;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TABLE IF NOT EXISTS public.profile_matches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_a uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  user_b uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  compatibility_score integer NOT NULL CHECK (compatibility_score >= 0 AND compatibility_score <= 100),
  compatibility_breakdown jsonb NOT NULL DEFAULT '{}'::jsonb,
  compatibility_reason text,
  ai_summary text,
  match_status text NOT NULL DEFAULT 'active' CHECK (match_status IN ('active', 'hidden', 'blocked', 'rejected')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT profile_matches_unique_pair UNIQUE (user_a, user_b)
);

CREATE TRIGGER profile_matches_order_pair_trigger
  BEFORE INSERT OR UPDATE OF user_a, user_b ON public.profile_matches
  FOR EACH ROW
  EXECUTE FUNCTION public.profile_matches_order_pair();

CREATE INDEX IF NOT EXISTS idx_profile_matches_user_a ON public.profile_matches (user_a);
CREATE INDEX IF NOT EXISTS idx_profile_matches_user_b ON public.profile_matches (user_b);
CREATE INDEX IF NOT EXISTS idx_profile_matches_status_updated ON public.profile_matches (match_status, updated_at DESC);

ALTER TABLE public.profile_matches ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read own profile_matches"
  ON public.profile_matches
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_a OR auth.uid() = user_b);

CREATE TRIGGER update_profile_matches_updated_at
  BEFORE UPDATE ON public.profile_matches
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

COMMENT ON TABLE public.profile_matches IS 'Cached compatibility scores + explanations; writes from Edge (service role).';

-- ---------------------------------------------------------------------------
-- match_behavior_events: future learning hooks (self events only)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.match_behavior_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  event_type text NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_match_behavior_events_user_created ON public.match_behavior_events (user_id, created_at DESC);

ALTER TABLE public.match_behavior_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users insert own match_behavior_events"
  ON public.match_behavior_events
  FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users read own match_behavior_events"
  ON public.match_behavior_events
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

COMMENT ON TABLE public.match_behavior_events IS 'Future: swipes, views, chat opens — optional analytics; RLS self-only.';
