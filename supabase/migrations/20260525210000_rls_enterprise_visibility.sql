-- Enterprise RLS: explicit pending/blocked/rejected visibility + tighter chat participant policy

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
    WHEN COALESCE(p.moderation_status, 'pending') = 'rejected'
      OR p.suitability_status = 'blocked' THEN false
    WHEN COALESCE(p.moderation_status, 'pending') = 'pending' THEN false
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

DROP POLICY IF EXISTS "Profiles visible to shared chat participants" ON public.profiles;

CREATE POLICY "Profiles visible to shared chat participants"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.chat_participants cp_me
      INNER JOIN public.chat_participants cp_them
        ON cp_me.chat_id = cp_them.chat_id
      INNER JOIN public.profiles me ON me.user_id = cp_me.user_id
      WHERE cp_me.user_id = auth.uid()
        AND cp_them.user_id = profiles.user_id
        AND cp_me.removed = false
        AND cp_them.removed = false
        AND cp_me.user_id <> cp_them.user_id
        AND COALESCE(me.moderation_status, 'pending') = 'approved'
        AND COALESCE(profiles.moderation_status, 'pending') = 'approved'
    )
  );

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
  NEW.points := OLD.points;
  NEW.subscription_status := OLD.subscription_status;
  NEW.suspended_at := OLD.suspended_at;
  NEW.suspended_by := OLD.suspended_by;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_dm_partner_preview(p_chat_id uuid)
RETURNS TABLE(
  user_id uuid,
  first_name text,
  last_name text,
  photos text[],
  avatar_url text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.user_id, p.first_name, p.last_name, p.photos, p.avatar_url
  FROM public.chat_participants cp_me
  INNER JOIN public.chat_participants cp_them
    ON cp_me.chat_id = cp_them.chat_id
    AND cp_me.user_id <> cp_them.user_id
  INNER JOIN public.profiles p ON p.user_id = cp_them.user_id
  INNER JOIN public.chats c ON c.id = cp_me.chat_id AND c.type = 'direct'
  WHERE cp_me.chat_id = p_chat_id
    AND cp_me.user_id = auth.uid()
    AND cp_me.removed = false
    AND cp_them.removed = false
    AND public.profile_is_visible_to_authenticated(p)
  LIMIT 1;
$$;
