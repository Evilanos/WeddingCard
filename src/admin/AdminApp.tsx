import { useEffect, useState } from 'preact/hooks';
import type { Session } from '@supabase/supabase-js';
import { sb } from './supabase';
import GuestsTab from './GuestsTab';
import RecapTab from './RecapTab';
import WishesTab from './WishesTab';
import SettingsTab from './SettingsTab';

const TABS = [
  { key: 'guests', label: 'Tamu' },
  { key: 'recap', label: 'Rekap' },
  { key: 'wishes', label: 'Ucapan' },
  { key: 'settings', label: 'Pengaturan' },
] as const;
type TabKey = (typeof TABS)[number]['key'];

export default function AdminApp() {
  const [session, setSession] = useState<Session | null | undefined>(undefined);
  const [isAdmin, setIsAdmin] = useState<boolean | undefined>(undefined);
  const [tab, setTab] = useState<TabKey>(() => {
    const h = location.hash.slice(1);
    return (TABS.find((t) => t.key === h)?.key ?? 'guests') as TabKey;
  });

  useEffect(() => {
    void sb.auth.getSession().then(({ data }) => setSession(data.session));
    const { data } = sb.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => data.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!session) {
      setIsAdmin(undefined);
      return;
    }
    void sb.rpc('is_admin').then(({ data, error }) => setIsAdmin(!error && data === true));
  }, [session?.user.id]);

  useEffect(() => {
    history.replaceState(null, '', `#${tab}`);
  }, [tab]);

  if (session === undefined) return <Centered>Memuat…</Centered>;
  if (!session) return <Login />;
  if (isAdmin === undefined) return <Centered>Memeriksa akses…</Centered>;
  if (!isAdmin) {
    return (
      <Centered>
        <p>
          Akun <strong>{session.user.email}</strong> bukan admin.
        </p>
        <button type="button" class="btn btn-outline mt-4" onClick={() => void sb.auth.signOut()}>
          Keluar
        </button>
      </Centered>
    );
  }

  return (
    <div class="mx-auto max-w-6xl px-4 pb-16">
      <header class="sticky top-0 z-10 -mx-4 border-b border-ink/10 bg-paper/95 px-4 pt-4 backdrop-blur">
        <div class="flex items-center justify-between gap-3">
          <h1 class="text-2xl">Admin Undangan</h1>
          <div class="flex items-center gap-3 text-xs text-ink-soft">
            <span class="hidden sm:inline">{session.user.email}</span>
            <button type="button" class="btn btn-outline !min-h-8 !py-1 text-xs" onClick={() => void sb.auth.signOut()}>
              Keluar
            </button>
          </div>
        </div>
        <nav class="mt-3 flex gap-1 overflow-x-auto" aria-label="Menu admin">
          {TABS.map((t) => (
            <button
              key={t.key}
              type="button"
              aria-current={tab === t.key ? 'page' : undefined}
              class={`whitespace-nowrap border-b-2 px-4 py-2 text-sm ${
                tab === t.key ? 'border-ink font-semibold text-ink' : 'border-transparent text-ink-soft'
              }`}
              onClick={() => setTab(t.key)}
            >
              {t.label}
            </button>
          ))}
        </nav>
      </header>

      <main class="pt-6">
        {tab === 'guests' && <GuestsTab />}
        {tab === 'recap' && <RecapTab />}
        {tab === 'wishes' && <WishesTab />}
        {tab === 'settings' && <SettingsTab />}
      </main>
    </div>
  );
}

function Centered({ children }: { children: preact.ComponentChildren }) {
  return <div class="min-h-screen-safe flex flex-col items-center justify-center p-6 text-center">{children}</div>;
}

function Login() {
  const [email, setEmail] = useState('');
  const [state, setState] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle');
  const [message, setMessage] = useState('');

  async function submit(e: Event) {
    e.preventDefault();
    setState('sending');
    const { error } = await sb.auth.signInWithOtp({
      email: email.trim(),
      options: { shouldCreateUser: false, emailRedirectTo: `${location.origin}/admin` },
    });
    if (error) {
      setState('error');
      setMessage(error.message);
    } else {
      setState('sent');
    }
  }

  return (
    <Centered>
      <form class="card w-full max-w-sm space-y-4 text-left" onSubmit={submit}>
        <h1 class="text-center text-2xl">Admin Undangan</h1>
        {state === 'sent' ? (
          <p class="text-sm">
            Link masuk sudah dikirim ke <strong>{email}</strong>. Buka email dan klik link tersebut di browser ini.
          </p>
        ) : (
          <>
            <label class="block text-sm font-medium" for="admin-email">
              Email admin
            </label>
            <input
              id="admin-email"
              type="email"
              class="input"
              required
              autoComplete="email"
              value={email}
              onInput={(e) => setEmail(e.currentTarget.value)}
            />
            <button type="submit" class="btn btn-primary w-full" disabled={state === 'sending'}>
              {state === 'sending' ? 'Mengirim…' : 'Kirim Magic Link'}
            </button>
            {state === 'error' && <p class="text-sm text-rose-700">{message}</p>}
          </>
        )}
      </form>
    </Centered>
  );
}
