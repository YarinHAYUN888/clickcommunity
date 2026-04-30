
-- ============================================
-- CHATS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS public.chats (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  type TEXT NOT NULL CHECK (type IN ('direct', 'group')),
  event_id UUID REFERENCES public.events(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  expires_at TIMESTAMP WITH TIME ZONE,
  is_closed BOOLEAN DEFAULT FALSE,
  closed_by UUID,
  closed_at TIMESTAMP WITH TIME ZONE,
  close_reason TEXT
);

-- ============================================
-- CHAT PARTICIPANTS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS public.chat_participants (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  chat_id UUID NOT NULL REFERENCES public.chats(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  joined_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  muted BOOLEAN DEFAULT FALSE,
  removed BOOLEAN DEFAULT FALSE,
  removed_by UUID,
  removed_at TIMESTAMP WITH TIME ZONE,
  UNIQUE(chat_id, user_id)
);

-- ============================================
-- MESSAGES TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS public.messages (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  chat_id UUID NOT NULL REFERENCES public.chats(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL,
  content TEXT NOT NULL,
  is_system BOOLEAN DEFAULT FALSE,
  is_pinned BOOLEAN DEFAULT FALSE,
  pinned_by UUID,
  is_deleted BOOLEAN DEFAULT FALSE,
  deleted_by UUID,
  deleted_at TIMESTAMP WITH TIME ZONE,
  read_by UUID[] DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================
-- BLOCKED USERS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS public.blocked_users (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  blocker_id UUID NOT NULL,
  blocked_id UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(blocker_id, blocked_id)
);

-- ============================================
-- CHAT REPORTS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS public.chat_reports (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  reporter_id UUID NOT NULL,
  reported_user_id UUID,
  chat_id UUID REFERENCES public.chats(id),
  message_id UUID REFERENCES public.messages(id),
  reason TEXT NOT NULL,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'reviewed', 'resolved', 'dismissed')),
  admin_notes TEXT,
  reviewed_by UUID,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  resolved_at TIMESTAMP WITH TIME ZONE
);

-- ============================================
-- INDEXES
-- ============================================
CREATE INDEX IF NOT EXISTS idx_chat_participants_user ON public.chat_participants(user_id);
CREATE INDEX IF NOT EXISTS idx_chat_participants_chat ON public.chat_participants(chat_id);
CREATE INDEX IF NOT EXISTS idx_messages_chat ON public.messages(chat_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_messages_sender ON public.messages(sender_id);
CREATE INDEX IF NOT EXISTS idx_blocked_blocker ON public.blocked_users(blocker_id);
CREATE INDEX IF NOT EXISTS idx_blocked_blocked ON public.blocked_users(blocked_id);
CREATE INDEX IF NOT EXISTS idx_reports_status ON public.chat_reports(status);

-- ============================================
-- ENABLE REALTIME ON MESSAGES
-- ============================================
ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;

-- ============================================
-- AUTO-EXPIRE GROUP CHATS FUNCTION
-- ============================================
CREATE OR REPLACE FUNCTION public.auto_set_chat_expiry()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.type = 'group' AND NEW.event_id IS NOT NULL THEN
    NEW.expires_at := (
      SELECT (e.date + e.time + INTERVAL '3 days')
      FROM public.events e WHERE e.id = NEW.event_id
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER trigger_auto_chat_expiry
BEFORE INSERT ON public.chats
FOR EACH ROW EXECUTE FUNCTION public.auto_set_chat_expiry();

-- ============================================
-- UPDATE chat.updated_at ON NEW MESSAGE
-- ============================================
CREATE OR REPLACE FUNCTION public.update_chat_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE public.chats SET updated_at = NOW() WHERE id = NEW.chat_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER trigger_update_chat_timestamp
AFTER INSERT ON public.messages
FOR EACH ROW EXECUTE FUNCTION public.update_chat_timestamp();

-- ============================================
-- ROW LEVEL SECURITY
-- ============================================
ALTER TABLE public.chats ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.blocked_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_reports ENABLE ROW LEVEL SECURITY;

-- Chats: participants can view their chats
CREATE POLICY "Users can view their chats" ON public.chats
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.chat_participants
      WHERE chat_id = chats.id AND user_id = auth.uid() AND removed = FALSE
    )
  );

-- Chat participants: users see participants in their chats
CREATE POLICY "Users can view chat participants" ON public.chat_participants
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.chat_participants cp
      WHERE cp.chat_id = chat_participants.chat_id AND cp.user_id = auth.uid() AND cp.removed = FALSE
    )
  );

-- Chat participants: users can update their own participation (mute)
CREATE POLICY "Users can update own participation" ON public.chat_participants
  FOR UPDATE USING (auth.uid() = user_id);

-- Messages: chat participants can read non-deleted messages
CREATE POLICY "Participants can view messages" ON public.messages
  FOR SELECT USING (
    is_deleted = FALSE
    AND EXISTS (
      SELECT 1 FROM public.chat_participants
      WHERE chat_id = messages.chat_id AND user_id = auth.uid() AND removed = FALSE
    )
  );

-- Messages: participants can insert if chat is open
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
    )
  );

-- Messages: allow updating read_by array
CREATE POLICY "Participants can update read status" ON public.messages
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.chat_participants
      WHERE chat_id = messages.chat_id AND user_id = auth.uid() AND removed = FALSE
    )
  );

-- Blocked users: users manage their own blocks
CREATE POLICY "Users can view own blocks" ON public.blocked_users
  FOR SELECT USING (auth.uid() = blocker_id);

CREATE POLICY "Users can create blocks" ON public.blocked_users
  FOR INSERT WITH CHECK (auth.uid() = blocker_id);

CREATE POLICY "Users can delete blocks" ON public.blocked_users
  FOR DELETE USING (auth.uid() = blocker_id);

-- Reports: users can create
CREATE POLICY "Users can create reports" ON public.chat_reports
  FOR INSERT WITH CHECK (auth.uid() = reporter_id);

-- Reports: users can view their own
CREATE POLICY "Users can view own reports" ON public.chat_reports
  FOR SELECT USING (auth.uid() = reporter_id);
