-- Participant statistics (counts, gender ratio) are admin-only.
-- Co-attendees may still list profiles via app flows; aggregate stats use this RPC or get-event-stats Edge Function.

CREATE OR REPLACE FUNCTION public.get_event_participant_stats(p_event_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_total int;
  v_females int;
  v_males int;
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_super_user(auth.uid()) THEN
    RETURN NULL;
  END IF;

  SELECT count(*)::int INTO v_total
  FROM public.event_registrations er
  WHERE er.event_id = p_event_id
    AND er.status IN ('registered', 'approved');

  IF v_total = 0 THEN
    RETURN jsonb_build_object('total', 0, 'femalePercent', 50, 'malePercent', 50);
  END IF;

  SELECT
    count(*) FILTER (WHERE p.gender = 'female')::int,
    count(*) FILTER (WHERE p.gender = 'male')::int
  INTO v_females, v_males
  FROM public.event_registrations er
  JOIN public.profiles p ON p.user_id = er.user_id
  WHERE er.event_id = p_event_id
    AND er.status IN ('registered', 'approved');

  RETURN jsonb_build_object(
    'total', v_total,
    'femalePercent', round((v_females::numeric / v_total) * 100),
    'malePercent', round((v_males::numeric / v_total) * 100)
  );
END;
$$;

REVOKE ALL ON FUNCTION public.get_event_participant_stats(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_event_participant_stats(uuid) TO authenticated;
