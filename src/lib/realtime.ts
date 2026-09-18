import type { SupabaseClient, RealtimeChannel } from '@supabase/supabase-js';
import type { Wish } from './api';

let clientPromise: Promise<SupabaseClient> | undefined;

/** supabase-js dimuat lazy, hanya saat section ucapan terlihat. */
function getClient(): Promise<SupabaseClient> {
  clientPromise ??= import('@supabase/supabase-js').then(({ createClient }) =>
    createClient(import.meta.env.PUBLIC_SUPABASE_URL, import.meta.env.PUBLIC_SUPABASE_ANON_KEY, {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    }),
  );
  return clientPromise;
}

export type WishFeedHandlers = {
  onNew: (wish: Wish) => void;
  onHidden: (id: number) => void;
  /** true = realtime tersambung, false = gagal (pakai polling). */
  onStatus: (connected: boolean) => void;
};

/** Subscribe ke topic broadcast "wishes". Kembalikan fungsi unsubscribe. */
export async function subscribeWishes(h: WishFeedHandlers): Promise<() => void> {
  let channel: RealtimeChannel | undefined;
  let closed = false;
  try {
    const client = await getClient();
    if (closed) return () => {};
    channel = client
      .channel('wishes', { config: { private: false } })
      .on('broadcast', { event: 'wish_new' }, ({ payload }) => h.onNew(payload as Wish))
      .on('broadcast', { event: 'wish_hidden' }, ({ payload }) => h.onHidden((payload as { id: number }).id))
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') h.onStatus(true);
        else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') h.onStatus(false);
      });
  } catch (err) {
    console.warn('realtime tidak tersedia', err);
    h.onStatus(false);
  }
  return () => {
    closed = true;
    if (channel) void getClient().then((c) => c.removeChannel(channel!));
  };
}
