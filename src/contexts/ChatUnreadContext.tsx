import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { useLocation } from 'react-router-dom';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { getTotalUnreadCount } from '@/services/chat';

type ChatUnreadContextValue = {
  totalUnread: number;
  refreshChatUnread: () => Promise<void>;
};

const ChatUnreadContext = createContext<ChatUnreadContextValue | null>(null);

export const CHAT_UNREAD_REFRESH_EVENT = 'chat-unread-refresh';

export function ChatUnreadProvider({ children }: { children: ReactNode }) {
  const { authId } = useCurrentUser();
  const location = useLocation();
  const [totalUnread, setTotalUnread] = useState(0);

  const refreshChatUnread = useCallback(async () => {
    if (!authId) {
      setTotalUnread(0);
      return;
    }
    try {
      const n = await getTotalUnreadCount(authId);
      setTotalUnread(n);
    } catch {
      setTotalUnread(0);
    }
  }, [authId]);

  useEffect(() => {
    void refreshChatUnread();
  }, [location.pathname, refreshChatUnread]);

  useEffect(() => {
    const onVisible = () => void refreshChatUnread();
    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') void refreshChatUnread();
    };
    window.addEventListener('focus', onVisible);
    document.addEventListener('visibilitychange', onVisibilityChange);
    const interval = window.setInterval(() => void refreshChatUnread(), 25000);
    const onCustom = () => void refreshChatUnread();
    window.addEventListener(CHAT_UNREAD_REFRESH_EVENT, onCustom);
    return () => {
      window.removeEventListener('focus', onVisible);
      document.removeEventListener('visibilitychange', onVisibilityChange);
      window.clearInterval(interval);
      window.removeEventListener(CHAT_UNREAD_REFRESH_EVENT, onCustom);
    };
  }, [refreshChatUnread]);

  const value = useMemo(
    () => ({ totalUnread, refreshChatUnread }),
    [totalUnread, refreshChatUnread]
  );

  return <ChatUnreadContext.Provider value={value}>{children}</ChatUnreadContext.Provider>;
}

export function useChatUnread() {
  const ctx = useContext(ChatUnreadContext);
  if (!ctx) throw new Error('useChatUnread must be used within ChatUnreadProvider');
  return ctx;
}

/** Safe for BottomTabBar when provider might be absent (avoid throwing). */
export function useChatUnreadCount(): number {
  return useContext(ChatUnreadContext)?.totalUnread ?? 0;
}

export function notifyChatUnreadRefresh() {
  window.dispatchEvent(new Event(CHAT_UNREAD_REFRESH_EVENT));
}
