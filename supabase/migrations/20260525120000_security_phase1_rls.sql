-- Security Phase 1: enable RLS on events tables, moderation-aware visibility, profile column guard

-- ---------------------------------------------------------------------------
-- Events family: policies existed but RLS was never enabled in initial migration
-- ---------------------------------------------------------------------------
ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_registrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_votes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_photos ENABLE ROW LEVEL SECURITY;

-- ---------------------------------------------------------------------------
-- Profile visibility: require approved moderation for community discovery
-- ---------------------------------------------------------------------------
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
        AND COALESCE(v.moderation_status, 'pending') = 'approved'
    )
    THEN (
      p.suitability_status = 'active'
      AND COALESCE(p.is_shadow, false) = false
      AND COALESCE(p.moderation_status, 'pending') = 'approved'
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

-- ---------------------------------------------------------------------------
-- Events visibility: viewer must be approved (when host-scoped rules apply)
-- ---------------------------------------------------------------------------
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
        AND COALESCE(v.moderation_status, 'pending') = 'approved'
    )
    WHEN EXISTS (SELECT 1 FROM public.profiles h WHERE h.user_id = ev.host_id AND h.super_role IS NOT NULL) THEN true
    WHEN EXISTS (
      SELECT 1 FROM public.profiles v
      WHERE v.user_id = auth.uid()
        AND v.suitability_status = 'active'
        AND NOT COALESCE(v.is_shadow, false)
        AND COALESCE(v.moderation_status, 'pending') = 'approved'
    ) THEN EXISTS (
      SELECT 1 FROM public.profiles h
      WHERE h.user_id = ev.host_id
        AND h.suitability_status = 'active'
        AND NOT COALESCE(h.is_shadow, false)
        AND COALESCE(h.moderation_status, 'pending') = 'approved'
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

-- ---------------------------------------------------------------------------
-- Prevent privilege escalation via self-service profile UPDATE
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.profiles_guard_privileged_columns()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF public.is_super_user(auth.uid()) THEN
    RETURN NEW;
  END IF;

  NEW.super_role := OLD.super_role;
  NEW.moderation_status := OLD.moderation_status;
  NEW.suitability_status := OLD.suitability_status;
  NEW.is_shadow := OLD.is_shadow;
  NEW.role := OLD.role;
  NEW.suspended := OLD.suspended;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS profiles_guard_privileged_columns_trigger ON public.profiles;
CREATE TRIGGER profiles_guard_privileged_columns_trigger
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.profiles_guard_privileged_columns();
