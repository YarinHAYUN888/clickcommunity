-- Member event approval flow (additive, safe):
--   * extend events.status to allow 'pending_review' and 'rejected'
--   * keep pending/rejected events out of the auto "past" sweep
--   * hide pending/rejected events from non-super, non-creator users (additive RLS guard)
-- No table/column changes, no weakening of existing rules.

-- 1) Status constraint: add the two review statuses while keeping every existing value.
ALTER TABLE public.events DROP CONSTRAINT IF EXISTS events_status_check;
ALTER TABLE public.events
  ADD CONSTRAINT events_status_check
  CHECK (status IN ('open', 'almost_full', 'full', 'past', 'cancelled', 'pending_review', 'rejected'));

-- 2) Do not auto-mark review-state events as 'past'.
CREATE OR REPLACE FUNCTION public.mark_past_events()
RETURNS void AS $$
BEGIN
  UPDATE public.events
  SET status = 'past', updated_at = NOW()
  WHERE date < CURRENT_DATE
    AND status NOT IN ('past', 'cancelled', 'pending_review', 'rejected');
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- 3) Visibility: pending_review / rejected events are only visible to super users
--    (handled by the first branch) or to the event creator. All other existing
--    visibility logic is preserved unchanged.
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
    WHEN ev.status IN ('pending_review', 'rejected') THEN (ev.created_by = auth.uid())
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
        AND COALESCE(v.moderation_status, 'pending') = 'rejected'
    ) THEN false
    WHEN EXISTS (
      SELECT 1 FROM public.profiles v
      WHERE v.user_id = auth.uid()
        AND (v.suitability_status = 'blocked' OR COALESCE(v.moderation_status, 'pending') = 'pending')
    ) THEN false
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
