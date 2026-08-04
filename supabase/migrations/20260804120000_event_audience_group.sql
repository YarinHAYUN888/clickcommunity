-- Additive: event audience groups (A / B / ALL) + viewer group helper with B approval gate.
-- Group A access: active + not shadow + moderation approved
-- Group B access: shadow + is_shadow + moderation approved (pending B candidates get NO event access)
-- No DROP of data; existing events default to ALL.

ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS audience_group text NOT NULL DEFAULT 'ALL';

ALTER TABLE public.events DROP CONSTRAINT IF EXISTS events_audience_group_check;
ALTER TABLE public.events
  ADD CONSTRAINT events_audience_group_check
  CHECK (audience_group IN ('A', 'B', 'ALL'));

COMMENT ON COLUMN public.events.audience_group IS
  'Target audience: A (active approved), B (shadow approved), ALL (both approved groups)';

-- Returns 'A' | 'B' | null for the current auth user (never exposes other users' groups).
CREATE OR REPLACE FUNCTION public.viewer_event_group()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT CASE
    WHEN auth.uid() IS NULL THEN NULL
    WHEN EXISTS (
      SELECT 1 FROM public.profiles v
      WHERE v.user_id = auth.uid()
        AND v.suitability_status = 'active'
        AND NOT COALESCE(v.is_shadow, false)
        AND COALESCE(v.moderation_status, 'pending') = 'approved'
    ) THEN 'A'
    WHEN EXISTS (
      SELECT 1 FROM public.profiles v
      WHERE v.user_id = auth.uid()
        AND v.suitability_status = 'shadow'
        AND COALESCE(v.is_shadow, false) = true
        AND COALESCE(v.moderation_status, 'pending') = 'approved'
    ) THEN 'B'
    ELSE NULL
  END;
$$;

REVOKE ALL ON FUNCTION public.viewer_event_group() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.viewer_event_group() TO authenticated;
GRANT EXECUTE ON FUNCTION public.viewer_event_group() TO service_role;

-- Visibility: preserve pending_review/host rules; add audience_group gate.
-- Pending B candidates (shadow + pending) → viewer_event_group() IS NULL → no access.
CREATE OR REPLACE FUNCTION public.event_is_visible_to_authenticated(ev public.events)
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
    WHEN ev.status IN ('pending_review', 'rejected') THEN (ev.created_by = auth.uid())
    WHEN EXISTS (
      SELECT 1 FROM public.profiles v
      WHERE v.user_id = auth.uid()
        AND COALESCE(v.moderation_status, 'pending') = 'rejected'
    ) THEN false
    WHEN EXISTS (
      SELECT 1 FROM public.profiles v
      WHERE v.user_id = auth.uid()
        AND (
          v.suitability_status = 'blocked'
          OR COALESCE(v.moderation_status, 'pending') = 'pending'
        )
    ) THEN false
    -- Audience gate: must be approved A or approved B matching event audience
    WHEN public.viewer_event_group() IS NULL THEN false
    WHEN public.viewer_event_group() = 'A'
      AND COALESCE(ev.audience_group, 'ALL') NOT IN ('A', 'ALL') THEN false
    WHEN public.viewer_event_group() = 'B'
      AND COALESCE(ev.audience_group, 'ALL') NOT IN ('B', 'ALL') THEN false
    -- Host-less community events: eligible approved viewers only (already gated above)
    WHEN ev.host_id IS NULL THEN true
    WHEN EXISTS (
      SELECT 1 FROM public.profiles h
      WHERE h.user_id = ev.host_id AND h.super_role IS NOT NULL
    ) THEN true
    -- Group A viewers only see events hosted by approved A hosts
    WHEN public.viewer_event_group() = 'A' THEN EXISTS (
      SELECT 1 FROM public.profiles h
      WHERE h.user_id = ev.host_id
        AND h.suitability_status = 'active'
        AND NOT COALESCE(h.is_shadow, false)
        AND COALESCE(h.moderation_status, 'pending') = 'approved'
    )
    -- Group B viewers only see events hosted by approved B hosts
    WHEN public.viewer_event_group() = 'B' THEN EXISTS (
      SELECT 1 FROM public.profiles h
      WHERE h.user_id = ev.host_id
        AND h.suitability_status = 'shadow'
        AND COALESCE(h.is_shadow, false) = true
        AND COALESCE(h.moderation_status, 'pending') = 'approved'
    )
    ELSE false
  END;
$$;

-- Prevent non-super users from changing audience_group via direct UPDATE.
CREATE OR REPLACE FUNCTION public.events_guard_audience_group()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF TG_OP = 'UPDATE'
     AND NEW.audience_group IS DISTINCT FROM OLD.audience_group THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.user_id = auth.uid() AND p.super_role IS NOT NULL
    )
    AND coalesce(auth.jwt() ->> 'role', '') <> 'service_role' THEN
      NEW.audience_group := OLD.audience_group;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_events_guard_audience_group ON public.events;
CREATE TRIGGER trg_events_guard_audience_group
  BEFORE UPDATE ON public.events
  FOR EACH ROW
  EXECUTE FUNCTION public.events_guard_audience_group();
