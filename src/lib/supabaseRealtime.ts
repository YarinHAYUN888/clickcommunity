import { supabase } from '@/integrations/supabase/client';
import type { RealtimeChannel } from '@supabase/supabase-js';

/** Supabase internal topics are prefixed with `realtime:`. */
export function channelTopicMatches(channel: RealtimeChannel, channelName: string): boolean {
  const topic = channel.topic;
  return topic === channelName || topic === `realtime:${channelName}`;
}

/** Remove a registered channel by logical name before creating a new subscription. */
export function removeRealtimeChannelByName(channelName: string): void {
  if (!channelName) return;
  const existing = supabase.getChannels().find((c) => channelTopicMatches(c, channelName));
  if (existing) {
    void supabase.removeChannel(existing);
  }
}

export type PostgresChangeHandler = {
  event: '*' | 'INSERT' | 'UPDATE' | 'DELETE';
  schema: string;
  table: string;
  filter?: string;
  callback: (payload: unknown) => void;
};

/**
 * Create a Realtime channel: all postgres_changes handlers chained before a single subscribe.
 * Always removes any prior channel with the same name to avoid "callback after subscribe" races.
 */
export function subscribePostgresChannel(
  channelName: string,
  handlers: PostgresChangeHandler[],
): RealtimeChannel {
  removeRealtimeChannelByName(channelName);

  let channel = supabase.channel(channelName);
  for (const h of handlers) {
    channel = channel.on(
      'postgres_changes',
      {
        event: h.event,
        schema: h.schema,
        table: h.table,
        filter: h.filter,
      },
      h.callback,
    );
  }

  channel.subscribe((status, err) => {
    if (status === 'CHANNEL_ERROR' && import.meta.env.DEV) {
      console.warn('[realtime] CHANNEL_ERROR', channelName, err);
    }
  });

  return channel;
}

export function unsubscribeRealtimeChannel(channel: RealtimeChannel | null | undefined): void {
  if (channel) void supabase.removeChannel(channel);
}
