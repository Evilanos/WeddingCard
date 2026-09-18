import { sapaanFor } from '../lib/greeting';
import type { GuestRow } from './supabase';

const partsFmt = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Asia/Jakarta',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
});

/** timestamptz → nilai <input type="datetime-local"> dalam WIB. */
export function toWibInput(iso: string | null | undefined): string {
  if (!iso) return '';
  const p = Object.fromEntries(partsFmt.formatToParts(new Date(iso)).map((x) => [x.type, x.value]));
  const hour = p.hour === '24' ? '00' : p.hour;
  return `${p.year}-${p.month}-${p.day}T${hour}:${p.minute}`;
}

/** Nilai datetime-local (dianggap WIB) → ISO dengan offset +07:00. */
export function fromWibInput(value: string): string | null {
  return value ? `${value}:00+07:00` : null;
}

const shortFmt = new Intl.DateTimeFormat('id-ID', {
  timeZone: 'Asia/Jakarta',
  day: '2-digit',
  month: 'short',
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
});
export const shortWib = (iso: string | null | undefined) => (iso ? `${shortFmt.format(new Date(iso))} WIB` : '–');

/** 0812-xxx / +62 812 / 812 → 62812… (format wa.me). null jika tidak valid. */
export function normalizePhone(raw: string | null | undefined): string | null {
  if (!raw) return null;
  let d = raw.replace(/\D/g, '');
  if (d.startsWith('0')) d = `62${d.slice(1)}`;
  else if (d.startsWith('8')) d = `62${d}`;
  return d.length >= 10 && d.length <= 15 ? d : null;
}

export function renderTemplate(template: string, g: Pick<GuestRow, 'nama' | 'sapaan'>, link: string): string {
  return template
    .replaceAll('{sapaan}', sapaanFor(g.nama, g.sapaan))
    .replaceAll('{nama}', g.nama)
    .replaceAll('{link}', link)
    .split('\n')
    .map((line) => line.replace(/[ \t]{2,}/g, ' ').trim())
    .join('\n');
}

export function waUrl(phone: string | null, text: string): string {
  const q = `text=${encodeURIComponent(text)}`;
  return phone ? `https://wa.me/${phone}?${q}` : `https://wa.me/?${q}`;
}
