import type { Wish } from './api';

// Form dan list ucapan adalah island terpisah; mereka bicara lewat event DOM.
export type LocalWish = Wish & { pending?: boolean; awaitingModeration?: boolean };

type Events = {
  'wish:optimistic': { tempId: number; wish: LocalWish };
  'wish:confirmed': { tempId: number; wish: Wish | null; hidden: boolean };
  'wish:failed': { tempId: number };
};

export function emit<K extends keyof Events>(name: K, detail: Events[K]) {
  document.dispatchEvent(new CustomEvent(name, { detail }));
}

export function on<K extends keyof Events>(name: K, fn: (detail: Events[K]) => void): () => void {
  const handler = (e: Event) => fn((e as CustomEvent<Events[K]>).detail);
  document.addEventListener(name, handler);
  return () => document.removeEventListener(name, handler);
}

let seq = 0;
/** Id sementara (negatif) untuk bubble optimistic. */
export const nextTempId = () => --seq;
