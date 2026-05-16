-- DM list / header: return partner profile fields for the other participant in a direct chat,
-- only when auth.uid() is an active participant. Bypasses profiles RLS for this scoped read.

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
  LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.get_dm_partner_preview(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_dm_partner_preview(uuid) TO authenticated;

COMMENT ON FUNCTION public.get_dm_partner_preview(uuid) IS
  'Returns the other user''s profile fields for a direct chat when the caller is an active participant.';
