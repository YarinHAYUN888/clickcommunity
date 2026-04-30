
-- ============================================
-- ADD SUPER ROLE TO PROFILES
-- ============================================
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS super_role TEXT CHECK (super_role IN ('developer', 'admin'));
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS suspended BOOLEAN DEFAULT FALSE;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS suspended_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS suspended_by UUID;

-- ============================================
-- ADMIN ACTION LOGS
-- ============================================
CREATE TABLE IF NOT EXISTS public.admin_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  admin_id UUID NOT NULL,
  action TEXT NOT NULL,
  target_type TEXT NOT NULL CHECK (target_type IN ('user', 'event', 'chat', 'message', 'subscription', 'system')),
  target_id UUID,
  details JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================
-- ANNOUNCEMENTS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS public.announcements (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  chat_id UUID NOT NULL REFERENCES public.chats(id) ON DELETE CASCADE,
  admin_id UUID NOT NULL,
  content TEXT NOT NULL,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================
-- UPDATE CHATS TABLE
-- ============================================
ALTER TABLE public.chats ADD COLUMN IF NOT EXISTS announcements_only BOOLEAN DEFAULT FALSE;
ALTER TABLE public.chats ADD COLUMN IF NOT EXISTS announcements_set_by UUID;
ALTER TABLE public.chats ADD COLUMN IF NOT EXISTS announcements_set_at TIMESTAMP WITH TIME ZONE;

-- ============================================
-- UPDATE EVENTS TABLE
-- ============================================
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS created_by UUID;

-- ============================================
-- UPDATE MESSAGES
-- ============================================
ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS is_announcement BOOLEAN DEFAULT FALSE;

-- ============================================
-- INDEXES
-- ============================================
CREATE INDEX IF NOT EXISTS idx_admin_logs_admin ON public.admin_logs(admin_id);
CREATE INDEX IF NOT EXISTS idx_admin_logs_target ON public.admin_logs(target_type, target_id);
CREATE INDEX IF NOT EXISTS idx_admin_logs_date ON public.admin_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_profiles_super_role ON public.profiles(super_role) WHERE super_role IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_announcements_chat ON public.announcements(chat_id);

-- ============================================
-- ADMIN STATS FUNCTIONS
-- ============================================
CREATE OR REPLACE FUNCTION public.admin_count_users()
RETURNS TABLE(total BIGINT, guests BIGINT, members BIGINT, veterans BIGINT, ambassadors BIGINT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    COUNT(*)::BIGINT as total,
    COUNT(*) FILTER (WHERE role = 'guest')::BIGINT as guests,
    COUNT(*) FILTER (WHERE role = 'member')::BIGINT as members,
    COUNT(*) FILTER (WHERE status = 'veteran')::BIGINT as veterans,
    COUNT(*) FILTER (WHERE status = 'ambassador')::BIGINT as ambassadors
  FROM public.profiles
  WHERE suspended = FALSE;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_subscription_stats()
RETURNS TABLE(active_total BIGINT, active_free BIGINT, active_paid BIGINT, monthly_revenue NUMERIC, cancelled_this_month BIGINT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    COUNT(*) FILTER (WHERE status = 'active')::BIGINT as active_total,
    COUNT(*) FILTER (WHERE status = 'active' AND amount = 0)::BIGINT as active_free,
    COUNT(*) FILTER (WHERE status = 'active' AND amount > 0)::BIGINT as active_paid,
    COALESCE(SUM(amount) FILTER (WHERE status = 'active' AND amount > 0), 0) as monthly_revenue,
    COUNT(*) FILTER (WHERE status = 'cancelled' AND updated_at >= date_trunc('month', CURRENT_DATE))::BIGINT as cancelled_this_month
  FROM public.subscriptions;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_event_stats()
RETURNS TABLE(total_events BIGINT, active_events BIGINT, past_events BIGINT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    COUNT(*)::BIGINT,
    COUNT(*) FILTER (WHERE status IN ('open', 'almost_full', 'full'))::BIGINT,
    COUNT(*) FILTER (WHERE status = 'past')::BIGINT
  FROM public.events;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_chat_stats()
RETURNS TABLE(total_chats BIGINT, active_chats BIGINT, closed_chats BIGINT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    COUNT(*)::BIGINT,
    COUNT(*) FILTER (WHERE is_closed = FALSE AND (expires_at IS NULL OR expires_at > NOW()))::BIGINT,
    COUNT(*) FILTER (WHERE is_closed = TRUE OR (expires_at IS NOT NULL AND expires_at <= NOW()))::BIGINT
  FROM public.chats;
END;
$$;

-- ============================================
-- ROW LEVEL SECURITY
-- ============================================
ALTER TABLE public.admin_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.announcements ENABLE ROW LEVEL SECURITY;

-- Admin logs: only super users can view
CREATE POLICY "Super users view admin logs" ON public.admin_logs
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE user_id = auth.uid() AND super_role IS NOT NULL)
  );

-- Admin logs: only super users can insert
CREATE POLICY "Super users create admin logs" ON public.admin_logs
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM public.profiles WHERE user_id = auth.uid() AND super_role IS NOT NULL)
  );

-- Announcements: everyone in the chat can read
CREATE POLICY "Chat members view announcements" ON public.announcements
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.chat_participants
      WHERE chat_id = announcements.chat_id AND user_id = auth.uid()
    )
  );

-- Announcements: only super users can create
CREATE POLICY "Super users create announcements" ON public.announcements
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM public.profiles WHERE user_id = auth.uid() AND super_role IS NOT NULL)
  );

-- UPDATE messages policy to respect announcements_only mode
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
        OR EXISTS (SELECT 1 FROM public.profiles WHERE user_id = auth.uid() AND super_role IS NOT NULL)
      )
    )
  );

-- Super users can view ALL chats
CREATE POLICY "Super users view all chats" ON public.chats
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE user_id = auth.uid() AND super_role IS NOT NULL)
  );

-- Super users can view ALL messages
CREATE POLICY "Super users view all messages" ON public.messages
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE user_id = auth.uid() AND super_role IS NOT NULL)
  );

-- Super users can update ANY chat
CREATE POLICY "Super users manage chats" ON public.chats
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE user_id = auth.uid() AND super_role IS NOT NULL)
  );

-- Super users can manage ALL events
CREATE POLICY "Super users manage events" ON public.events
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE user_id = auth.uid() AND super_role IS NOT NULL)
  );

-- Super users can manage ALL registrations
CREATE POLICY "Super users manage registrations" ON public.event_registrations
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE user_id = auth.uid() AND super_role IS NOT NULL)
  );

-- Super users can manage ALL subscriptions (additional to existing service_role policy)
CREATE POLICY "Super users manage subscriptions" ON public.subscriptions
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE user_id = auth.uid() AND super_role IS NOT NULL)
  );

-- Super users can update ANY profile
CREATE POLICY "Super users manage profiles" ON public.profiles
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE user_id = auth.uid() AND super_role IS NOT NULL)
  );
