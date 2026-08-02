import { describe, expect, it, vi, beforeEach } from 'vitest';

const { mockRemoveChannel, mockGetChannels, mockSubscribe, mockOn, mockChannel } = vi.hoisted(() => {
  const mockSubscribe = vi.fn();
  const mockOn = vi.fn();
  const mockRemoveChannel = vi.fn();
  const mockGetChannels = vi.fn(() => []);
  const createChainableChannel = () => {
    const channel = {
      topic: 'realtime:test-channel',
      on: mockOn,
      subscribe: mockSubscribe,
    };
    mockOn.mockImplementation(() => channel);
    return channel;
  };
  const mockChannel = vi.fn(() => createChainableChannel());
  return { mockRemoveChannel, mockGetChannels, mockSubscribe, mockOn, mockChannel };
});

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    getChannels: () => mockGetChannels(),
    removeChannel: mockRemoveChannel,
    channel: mockChannel,
  },
}));

import {
  channelTopicMatches,
  removeRealtimeChannelByName,
  subscribePostgresChannel,
} from '@/lib/supabaseRealtime';

describe('supabaseRealtime', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetChannels.mockReturnValue([]);
  });

  it('channelTopicMatches handles realtime prefix', () => {
    const ch = { topic: 'realtime:chat-membership-abc' } as import('@supabase/supabase-js').RealtimeChannel;
    expect(channelTopicMatches(ch, 'chat-membership-abc')).toBe(true);
    expect(channelTopicMatches(ch, 'other')).toBe(false);
  });

  it('removeRealtimeChannelByName removes existing channel', () => {
    const existing = { topic: 'realtime:dup' } as import('@supabase/supabase-js').RealtimeChannel;
    mockGetChannels.mockReturnValue([existing]);
    removeRealtimeChannelByName('dup');
    expect(mockRemoveChannel).toHaveBeenCalledWith(existing);
  });

  it('subscribePostgresChannel chains handlers before subscribe', () => {
    subscribePostgresChannel('my-channel', [
      {
        event: 'INSERT',
        schema: 'public',
        table: 'messages',
        filter: 'chat_id=eq.1',
        callback: () => {},
      },
      {
        event: 'UPDATE',
        schema: 'public',
        table: 'messages',
        filter: 'chat_id=eq.1',
        callback: () => {},
      },
    ]);
    expect(mockChannel).toHaveBeenCalledWith('my-channel');
    expect(mockOn).toHaveBeenCalledTimes(2);
    expect(mockSubscribe).toHaveBeenCalledTimes(1);
  });
});
