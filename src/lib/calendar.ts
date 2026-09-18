export type CalendarEvent = {
  title: string;
  start: string; // ISO +07:00
  end: string; // ISO +07:00
  location: string;
  details?: string;
};

// 2026-12-12T04:00:00.000Z → 20261212T040000Z
const toUtcStamp = (iso: string) => new Date(iso).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');

/** Link Google Calendar (tombol utama "Save the Date"). */
export function googleCalendarUrl(ev: CalendarEvent): string {
  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: ev.title,
    dates: `${toUtcStamp(ev.start)}/${toUtcStamp(ev.end)}`,
    location: ev.location,
    details: ev.details ?? '',
    ctz: 'Asia/Jakarta',
  });
  return `https://calendar.google.com/calendar/render?${params}`;
}

const escapeIcs = (s: string) => s.replace(/\\/g, '\\\\').replace(/\n/g, '\\n').replace(/([,;])/g, '\\$1');

/** Isi file .ics (opsi sekunder; sering gagal diunduh di in-app browser WA). */
export function icsContent(ev: CalendarEvent, uid: string): string {
  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//wedding-card//id',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:${uid}`,
    `DTSTAMP:${toUtcStamp(new Date().toISOString())}`,
    `DTSTART:${toUtcStamp(ev.start)}`,
    `DTEND:${toUtcStamp(ev.end)}`,
    `SUMMARY:${escapeIcs(ev.title)}`,
    `LOCATION:${escapeIcs(ev.location)}`,
    `DESCRIPTION:${escapeIcs(ev.details ?? '')}`,
    'BEGIN:VALARM',
    'TRIGGER:-P1D',
    'ACTION:DISPLAY',
    `DESCRIPTION:${escapeIcs(ev.title)}`,
    'END:VALARM',
    'END:VEVENT',
    'END:VCALENDAR',
    '',
  ].join('\r\n');
}
