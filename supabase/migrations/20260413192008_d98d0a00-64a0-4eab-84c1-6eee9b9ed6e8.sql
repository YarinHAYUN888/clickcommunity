
-- Create security definer function to check super_role without RLS recursion
CREATE OR REPLACE FUNCTION public.is_super_user(p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE user_id = p_user_id AND super_role IS NOT NULL
  );
$$;

-- Drop and recreate policies that reference profiles to use the function instead
DROP POLICY IF EXISTS "Super users view admin logs" ON public.admin_logs;
CREATE POLICY "Super users view admin logs" ON public.admin_logs
  FOR SELECT USING (public.is_super_user(auth.uid()));

DROP POLICY IF EXISTS "Super users create admin logs" ON public.admin_logs;
CREATE POLICY "Super users create admin logs" ON public.admin_logs
  FOR INSERT WITH CHECK (public.is_super_user(auth.uid()));

DROP POLICY IF EXISTS "Super users create announcements" ON public.announcements;
CREATE POLICY "Super users create announcements" ON public.announcements
  FOR INSERT WITH CHECK (public.is_super_user(auth.uid()));

DROP POLICY IF EXISTS "Super users view all chats" ON public.chats;
CREATE POLICY "Super users view all chats" ON public.chats
  FOR SELECT USING (public.is_super_user(auth.uid()));

DROP POLICY IF EXISTS "Super users view all messages" ON public.messages;
CREATE POLICY "Super users view all messages" ON public.messages
  FOR SELECT USING (public.is_super_user(auth.uid()));

DROP POLICY IF EXISTS "Super users manage chats" ON public.chats;
CREATE POLICY "Super users manage chats" ON public.chats
  FOR UPDATE USING (public.is_super_user(auth.uid()));

DROP POLICY IF EXISTS "Super users manage events" ON public.events;
CREATE POLICY "Super users manage events" ON public.events
  FOR ALL USING (public.is_super_user(auth.uid()));

DROP POLICY IF EXISTS "Super users manage registrations" ON public.event_registrations;
CREATE POLICY "Super users manage registrations" ON public.event_registrations
  FOR ALL USING (public.is_super_user(auth.uid()));

DROP POLICY IF EXISTS "Super users manage subscriptions" ON public.subscriptions;
CREATE POLICY "Super users manage subscriptions" ON public.subscriptions
  FOR ALL USING (public.is_super_user(auth.uid()));

DROP POLICY IF EXISTS "Super users manage profiles" ON public.profiles;
CREATE POLICY "Super users manage profiles" ON public.profiles
  FOR UPDATE USING (public.is_super_user(auth.uid()));

-- Fix messages insert policy too
DROP POLICY IF EXISTS "Participants can send messages" ON public.messages;
CREATE POLICY "Participants can send messages" ON public.messages
  FOR INSERT WITH CHECK (
    auth.uid() = sender_id
    AND EXISTS (
      SELECT 1 FROM public.chat_participants
      WHERE chat_id = messages.chat_id AND user_id = auth.uid() AND removed = FALSE
    )
    AND EXISTS (
      SELECT 1 FROM public.chats
      WHERE id = messages.chat_id
      AND is_closed = FALSE
      AND (expires_at IS NULL OR expires_at > NOW())
      AND (
        announcements_only = FALSE
        OR public.is_super_user(auth.uid())
      )
    )
  );
