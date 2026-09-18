let el: HTMLDivElement | undefined;
let timer: ReturnType<typeof setTimeout> | undefined;

/** Notifikasi singkat di bawah layar. Teks selalu diset via textContent. */
export function toast(message: string, ms = 2500) {
  if (!el) {
    el = document.createElement('div');
    el.setAttribute('role', 'status');
    el.setAttribute('aria-live', 'polite');
    el.className =
      'fixed left-1/2 bottom-24 z-[60] max-w-[90vw] -translate-x-1/2 rounded-full bg-ink px-5 py-2.5 text-center text-sm text-paper shadow-lg transition-opacity duration-300 opacity-0 pointer-events-none whitespace-pre-line';
    document.body.appendChild(el);
  }
  el.textContent = message;
  el.classList.replace('opacity-0', 'opacity-100');
  clearTimeout(timer);
  timer = setTimeout(() => el?.classList.replace('opacity-100', 'opacity-0'), ms);
}
