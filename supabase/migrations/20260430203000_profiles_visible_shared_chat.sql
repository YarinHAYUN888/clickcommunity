-- DM / group UX: authenticated users must see partner profiles when they share an active chat.
-- Without this, "Profiles select isolation" hides pending/non-active profiles from viewers who are
-- active — so chat headers stay blank and ChatsPage drops direct threads entirely (getDmPartner null).

CREATE POLICY "Profiles visible to shared chat participants"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.chat_participants cp_me
      INNER JOIN public.chat_participants cp_them
        ON cp_me.chat_id = cp_them.chat_id
      WHERE cp_me.user_id = auth.uid()
        AND cp_them.user_id = profiles.user_id
        AND cp_me.removed = false
        AND cp_them.removed = false
        AND cp_me.user_id <> cp_them.user_id
    )
  );
