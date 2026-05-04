-- User suitability & shadow isolation (additive). Existing `profiles.status` remains member tier (new/veteran/ambassador).

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS suitability_status text NOT NULL DEFAULT 'active';

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS risk_flags jsonb NOT NULL DEFAULT '[]'::jsonb;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS ai_summary text;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS is_shadow boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.profiles.suitability_status IS 'active | pending | shadow | blocked (moderation; not member tier)';
COMMENT ON COLUMN public.profiles.risk_flags IS 'Flags from automated suitability review';
COMMENT ON COLUMN public.profiles.ai_summary IS 'Summary from AI / mock review';
COMMENT ON COLUMN public.profiles.is_shadow IS 'Shadow universe isolation (paired with suitability_status=shadow)';

ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_suitability_status_check;
ALTER TABLE public.profiles ADD CONSTRAINT profiles_suitability_status_check
  CHECK (suitability_status IN ('active', 'pending', 'shadow', 'blocked'));

CREATE INDEX IF NOT EXISTS idx_profiles_suitability_status ON public.profiles (suitability_status)
  WHERE suitability_status IS DISTINCT FROM 'active';

CREATE INDEX IF NOT EXISTS idx_profiles_is_shadow ON public.profiles (is_shadow) WHERE is_shadow = true;

-- RLS: super users see all; others see self; active+non-shadow see same bucket; shadow sees shadow only
CREATE OR REPLACE FUNCTION public.profile_is_visible_to_authenticated(p public.profiles)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT CASE
    WHEN auth.uid() IS NULL THEN false
    WHEN EXISTS (
      SELECT 1 FROM public.profiles v
      WHERE v.user_id = auth.uid() AND v.super_role IS NOT NULL
    ) THEN true
    WHEN p.user_id = auth.uid() THEN true
    WHEN EXISTS (
      SELECT 1 FROM public.profiles v
      WHERE v.user_id = auth.uid()
        AND v.suitability_status = 'active'
        AND COALESCE(v.is_shadow, false) = false
    )
    THEN (
      p.suitability_status = 'active'
      AND COALESCE(p.is_shadow, false) = false
    )
    WHEN EXISTS (
      SELECT 1 FROM public.profiles v
      WHERE v.user_id = auth.uid()
        AND v.suitability_status = 'shadow'
        AND COALESCE(v.is_shadow, false) = true
    )
    THEN (
      p.suitability_status = 'shadow'
      AND COALESCE(p.is_shadow, false) = true
    )
    ELSE false
  END;
$$;

REVOKE ALL ON FUNCTION public.profile_is_visible_to_authenticated(public.profiles) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.profile_is_visible_to_authenticated(public.profiles) TO authenticated;
GRANT EXECUTE ON FUNCTION public.profile_is_visible_to_authenticated(public.profiles) TO service_role;

DROP POLICY IF EXISTS "Users can view all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Profiles select isolation" ON public.profiles;
CREATE POLICY "Profiles select isolation"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (public.profile_is_visible_to_authenticated(profiles));

-- Events: host profile isolation (super hosts / super viewers unchanged)
CREATE OR REPLACE FUNCTION public.event_is_visible_to_authenticated(ev public.events)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT CASE
    WHEN auth.uid() IS NULL THEN false
    WHEN EXISTS (SELECT 1 FROM public.profiles v WHERE v.user_id = auth.uid() AND v.super_role IS NOT NULL) THEN true
    WHEN ev.host_id IS NULL THEN EXISTS (
      SELECT 1 FROM public.profiles v
      WHERE v.user_id = auth.uid()
        AND v.suitability_status = 'active'
        AND NOT COALESCE(v.is_shadow, false)
    )
    WHEN EXISTS (SELECT 1 FROM public.profiles h WHERE h.user_id = ev.host_id AND h.super_role IS NOT NULL) THEN true
    WHEN EXISTS (
      SELECT 1 FROM public.profiles v
      WHERE v.user_id = auth.uid()
        AND v.suitability_status = 'active'
        AND NOT COALESCE(v.is_shadow, false)
    ) THEN EXISTS (
      SELECT 1 FROM public.profiles h
      WHERE h.user_id = ev.host_id
        AND h.suitability_status = 'active'
        AND NOT COALESCE(h.is_shadow, false)
    )
    WHEN EXISTS (
      SELECT 1 FROM public.profiles v
      WHERE v.user_id = auth.uid()
        AND v.suitability_status = 'shadow'
        AND COALESCE(v.is_shadow, false) = true
    ) THEN EXISTS (
      SELECT 1 FROM public.profiles h
      WHERE h.user_id = ev.host_id
        AND h.suitability_status = 'shadow'
        AND COALESCE(h.is_shadow, false) = true
    )
    ELSE false
  END;
$$;

REVOKE ALL ON FUNCTION public.event_is_visible_to_authenticated(public.events) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.event_is_visible_to_authenticated(public.events) TO authenticated;
GRANT EXECUTE ON FUNCTION public.event_is_visible_to_authenticated(public.events) TO service_role;

DROP POLICY IF EXISTS "Events are viewable by authenticated users" ON public.events;
CREATE POLICY "Events select isolation"
  ON public.events FOR SELECT TO authenticated
  USING (public.event_is_visible_to_authenticated(events));

