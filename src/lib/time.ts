// Semua tampilan waktu dipaksa ke WIB (Asia/Jakarta, +07:00), apa pun zona perangkat tamu.
const TZ = 'Asia/Jakarta';

// Formatter Intl mahal dibuat (±50ms di HP low-end) → dibuat saat pertama dipakai.
const lazy = <T>(make: () => T) => {
  let v: T | undefined;
  return () => (v ??= make());
};

const dateFmt = lazy(
  () => new Intl.DateTimeFormat('id-ID', { timeZone: TZ, weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }),
);
const shortDateFmt = lazy(
  () => new Intl.DateTimeFormat('id-ID', { timeZone: TZ, day: '2-digit', month: '2-digit', year: 'numeric' }),
);
const timeFmt = lazy(
  () => new Intl.DateTimeFormat('id-ID', { timeZone: TZ, hour: '2-digit', minute: '2-digit', hour12: false }),
);
const rtf = lazy(() => new Intl.RelativeTimeFormat('id-ID', { numeric: 'auto' }));

const toDate = (v: string | Date) => (typeof v === 'string' ? new Date(v) : v);
const hhmm = (v: string | Date) => timeFmt().format(toDate(v)).replace(':', '.');

/** "Sabtu, 12 Desember 2026" */
export const formatDate = (v: string | Date) => dateFmt().format(toDate(v));

/** "12.12.2026" untuk hero */
export const formatShortDate = (v: string | Date) => shortDateFmt().format(toDate(v)).replaceAll('/', '.');

/** "11.00 WIB" */
export const formatTime = (v: string | Date) => `${hhmm(v)} WIB`;

/** "11.00 – 14.00 WIB" */
export const formatTimeRange = (start: string | Date, end?: string | Date | null) =>
  end ? `${hhmm(start)} – ${formatTime(end)}` : `${formatTime(start)} – selesai`;

/** "Sabtu, 12 Desember 2026, 23.59 WIB" */
export const formatDateTime = (v: string | Date) => `${formatDate(v)}, ${formatTime(v)}`;

const UNITS: Array<[Intl.RelativeTimeFormatUnit, number]> = [
  ['year', 365 * 24 * 3600],
  ['month', 30 * 24 * 3600],
  ['week', 7 * 24 * 3600],
  ['day', 24 * 3600],
  ['hour', 3600],
  ['minute', 60],
];

/** "2 jam yang lalu", "baru saja" */
export function formatRelative(v: string | Date, now = Date.now()): string {
  const diff = Math.round((toDate(v).getTime() - now) / 1000);
  const abs = Math.abs(diff);
  if (abs < 45) return 'baru saja';
  for (const [unit, secs] of UNITS) {
    if (abs >= secs || unit === 'minute') {
      return rtf().format(Math.round(diff / secs), unit);
    }
  }
  return 'baru saja';
}
