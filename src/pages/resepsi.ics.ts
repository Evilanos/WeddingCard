import type { APIRoute } from 'astro';
import { event } from '../config/event';
import { icsContent } from '../lib/calendar';

export const GET: APIRoute = ({ site }) => {
  const [first, second] = event.coupleOrder.map((k) => event[k].panggilan);
  const r = event.resepsi;
  const body = icsContent(
    {
      title: `${r.judul} ${first} & ${second}`,
      start: r.mulai,
      end: r.selesai,
      location: `${r.tempat}, ${r.alamat}`,
      details: `Undangan pernikahan ${first} & ${second}. ${new URL('/', site).href}`,
    },
    `resepsi@${site?.host ?? 'wedding'}`,
  );
  return new Response(body, { headers: { 'Content-Type': 'text/calendar; charset=utf-8' } });
};
