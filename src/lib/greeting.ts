import { event } from '../config/event';

type Sapaan = keyof typeof event.sapaanLabel;

const TITLE_PREFIX = /^(bapak|bpk|ibu|bu|pak|sdr|sdri|saudara|saudari|keluarga|kel|dr|drs|prof|h|hj|mas|mbak|kak)\b\.?/i;

/** Label sapaan untuk tamu; kosong jika nama di CSV sudah diawali gelar ("Bapak Budi"). */
export function sapaanFor(nama: string, sapaan: Sapaan): string {
  if (TITLE_PREFIX.test(nama.trim())) return '';
  return event.sapaanLabel[sapaan] ?? '';
}

/** "Bapak/Ibu Budi Santoso" */
export function greetingName(nama: string, sapaan: Sapaan): string {
  return [sapaanFor(nama, sapaan), nama].filter(Boolean).join(' ');
}
