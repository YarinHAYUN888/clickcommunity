-- Incoming click stats (separate from profiles — users can UPDATE their own profile row)
-- Event access unlock is permanent once event_access_unlocked_at is set.

CREATE TABLE IF NOT EXISTS public.profile_click_stats (
  user_id uuid PRIMARY KEY REFERENCES auth.users (id) ON DELETE CASCADE,
  incoming_click_count integer NOT NULL DEFAULT 0 CHECK (incoming_click_count >= 0),
  event_access_unlocked_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.profile_click_stats IS 'Incoming like/super_like counts and permanent event-access unlock; maintained by triggers only.';
COMMENT ON COLUMN public.profile_click_stats.incoming_click_count IS 'Count of distinct incoming like/super_like swipes (can decrease if swipes change/delete).';
COMMENT ON COLUMN public.profile_click_stats.event_access_unlocked_at IS 'Permanent unlock for event access once user first reaches 5 incoming clicks.';

ALTER TABLE public.profile_click_stats ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "profile_click_stats_select_own" ON public.profile_click_stats;
CREATE POLICY "profile_click_stats_select_own"
  ON public.profile_click_stats FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE TABLE IF NOT EXISTS public.user_notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  type text NOT NULL,
  title text NOT NULL,
  body text NOT NULL,
  dedupe_key text NOT NULL UNIQUE,
  read_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_user_notifications_user_created
  ON public.user_notifications (user_id, created_at DESC);

ALTER TABLE public.user_notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "user_notifications_select_own" ON public.user_notifications;
CREATE POLICY "user_notifications_select_own"
  ON public.user_notifications FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "user_notifications_update_read_own" ON public.user_notifications;
CREATE POLICY "user_notifications_update_read_own"
  ON public.user_notifications FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE OR REPLACE FUNCTION public.is_positive_swipe_action(action text)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT action IN ('like', 'super_like');
$$;

CREATE OR REPLACE FUNCTION public.try_insert_user_notification(
  p_user_id uuid,
  p_type text,
  p_title text,
  p_body text,
  p_dedupe_key text,
  p_metadata jsonb DEFAULT '{}'::jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.user_notifications (user_id, type, title, body, dedupe_key, metadata)
  VALUES (p_user_id, p_type, p_title, p_body, p_dedupe_key, p_metadata)
  ON CONFLICT (dedupe_key) DO NOTHING;
EXCEPTION
  WHEN OTHERS THEN
    RAISE LOG 'try_insert_user_notification failed user=% dedupe=% err=%', p_user_id, p_dedupe_key, SQLERRM;
END;
$$;

CREATE OR REPLACE FUNCTION public.apply_incoming_click_delta(
  p_user_id uuid,
  p_delta integer,
  p_swipe_id uuid DEFAULT NULL,
  p_from_user_id uuid DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  unlocked_now boolean := false;
BEGIN
  IF p_user_id IS NULL OR p_delta = 0 THEN
    RETURN;
  END IF;

  INSERT INTO public.profile_click_stats (user_id, incoming_click_count)
  VALUES (p_user_id, GREATEST(0, p_delta))
  ON CONFLICT (user_id) DO UPDATE SET
    incoming_click_count = GREATEST(0, public.profile_click_stats.incoming_click_count + p_delta),
    updated_at = now();

  WITH unlock AS (
    UPDATE public.profile_click_stats
    SET event_access_unlocked_at = now(),
        updated_at = now()
    WHERE user_id = p_user_id
      AND incoming_click_count >= 5
      AND event_access_unlocked_at IS NULL
    RETURNING user_id
  )
  SELECT EXISTS (SELECT 1 FROM unlock) INTO unlocked_now;

  IF unlocked_now THEN
    PERFORM public.try_insert_user_notification(
      p_user_id,
      'event_access_unlocked',
      'הגישה לאירועים נפתחה!',
      'השלמת 5 קליקים! הגישה לאירוע נפתחה עבורך.',
      'event_access_unlocked:' || p_user_id::text,
      '{}'::jsonb
    );
  END IF;

  IF p_delta > 0 AND p_swipe_id IS NOT NULL THEN
    PERFORM public.try_insert_user_notification(
      p_user_id,
      'incoming_click',
      'קיבלת קליק! 💜',
      'מישהו/י שלח/ה לך קליק.',
      'incoming_click:' || p_swipe_id::text,
      jsonb_build_object('from_user_id', p_from_user_id, 'swipe_id', p_swipe_id)
    );
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE LOG 'apply_incoming_click_delta failed user=% delta=% err=%', p_user_id, p_delta, SQLERRM;
END;
$$;

CREATE OR REPLACE FUNCTION public.profile_swipes_sync_click_stats()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  old_pos boolean;
  new_pos boolean;
  delta integer;
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF public.is_positive_swipe_action(NEW.action) THEN
      PERFORM public.apply_incoming_click_delta(NEW.to_user_id, 1, NEW.id, NEW.from_user_id);
    END IF;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    IF public.is_positive_swipe_action(OLD.action) THEN
      PERFORM public.apply_incoming_click_delta(OLD.to_user_id, -1, NULL, NULL);
    END IF;
    RETURN OLD;
  ELSIF TG_OP = 'UPDATE' THEN
    old_pos := public.is_positive_swipe_action(OLD.action);
    new_pos := public.is_positive_swipe_action(NEW.action);

    IF OLD.to_user_id IS DISTINCT FROM NEW.to_user_id THEN
      IF old_pos THEN
        PERFORM public.apply_incoming_click_delta(OLD.to_user_id, -1, NULL, NULL);
      END IF;
      IF new_pos THEN
        PERFORM public.apply_incoming_click_delta(NEW.to_user_id, 1, NEW.id, NEW.from_user_id);
      END IF;
    ELSE
      delta := (CASE WHEN new_pos THEN 1 ELSE 0 END) - (CASE WHEN old_pos THEN 1 ELSE 0 END);
      IF delta > 0 THEN
        PERFORM public.apply_incoming_click_delta(NEW.to_user_id, delta, NEW.id, NEW.from_user_id);
      ELSIF delta < 0 THEN
        PERFORM public.apply_incoming_click_delta(NEW.to_user_id, delta, NULL, NULL);
      END IF;
    END IF;
    RETURN NEW;
  END IF;

  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS tr_profile_swipes_sync_click_stats ON public.profile_swipes;
CREATE TRIGGER tr_profile_swipes_sync_click_stats
  AFTER INSERT OR UPDATE OR DELETE ON public.profile_swipes
  FOR EACH ROW
  EXECUTE FUNCTION public.profile_swipes_sync_click_stats();

-- Backfill counts + permanent unlock for users already at 5+ (no retroactive notifications)
INSERT INTO public.profile_click_stats (user_id, incoming_click_count, event_access_unlocked_at, updated_at)
SELECT
  sub.to_user_id,
  sub.cnt,
  CASE WHEN sub.cnt >= 5 THEN now() ELSE NULL END,
  now()
FROM (
  SELECT to_user_id, count(*)::integer AS cnt
  FROM public.profile_swipes
  WHERE action IN ('like', 'super_like')
  GROUP BY to_user_id
) sub
ON CONFLICT (user_id) DO UPDATE SET
  incoming_click_count = EXCLUDED.incoming_click_count,
  event_access_unlocked_at = COALESCE(
    public.profile_click_stats.event_access_unlocked_at,
    EXCLUDED.event_access_unlocked_at
  ),
  updated_at = now();

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'profile_click_stats'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.profile_click_stats;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'user_notifications'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.user_notifications;
  END IF;
EXCEPTION
  WHEN undefined_object THEN NULL;
END $$;
