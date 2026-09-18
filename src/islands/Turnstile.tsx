import { useEffect, useRef } from 'preact/hooks';

declare global {
  interface Window {
    turnstile?: {
      render: (el: HTMLElement, opts: Record<string, unknown>) => string;
      reset: (id?: string) => void;
      remove: (id?: string) => void;
    };
    __turnstileLoad?: Promise<void>;
  }
}

const SITE_KEY = import.meta.env.PUBLIC_TURNSTILE_SITE_KEY as string | undefined;

function loadScript(): Promise<void> {
  window.__turnstileLoad ??= new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
    s.async = true;
    s.defer = true;
    s.onload = () => resolve();
    s.onerror = () => {
      window.__turnstileLoad = undefined;
      reject(new Error('turnstile_load_failed'));
    };
    document.head.appendChild(s);
  });
  return window.__turnstileLoad;
}

type Props = {
  onToken: (token: string | null) => void;
  /** Ganti nilai ini untuk mereset widget (token hanya sekali pakai). */
  resetKey: number;
  onError?: () => void;
};

export default function Turnstile({ onToken, resetKey, onError }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const widgetId = useRef<string>();
  const cb = useRef({ onToken, onError });
  cb.current = { onToken, onError };

  useEffect(() => {
    if (!SITE_KEY) {
      cb.current.onError?.();
      return;
    }
    let cancelled = false;
    loadScript()
      .then(() => {
        if (cancelled || !ref.current || !window.turnstile) return;
        widgetId.current = window.turnstile.render(ref.current, {
          sitekey: SITE_KEY,
          language: 'id',
          appearance: 'interaction-only',
          size: 'flexible',
          callback: (t: string) => cb.current.onToken(t),
          'expired-callback': () => cb.current.onToken(null),
          'error-callback': () => {
            cb.current.onToken(null);
            cb.current.onError?.();
          },
        });
      })
      .catch(() => cb.current.onError?.());
    return () => {
      cancelled = true;
      if (widgetId.current) window.turnstile?.remove(widgetId.current);
    };
  }, []);

  useEffect(() => {
    if (resetKey > 0 && widgetId.current) {
      cb.current.onToken(null);
      window.turnstile?.reset(widgetId.current);
    }
  }, [resetKey]);

  return <div ref={ref} class="flex min-h-0 justify-center" />;
}
