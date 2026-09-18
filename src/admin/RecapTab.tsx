import { useEffect, useMemo, useState } from 'preact/hooks';
import { STATUS_LABEL } from '../lib/labels';
import { downloadCsv, toCsv } from './csv';
import { shortWib } from './format';
import { fetchAllGuests, guestLink, type GuestRow } from './supabase';

type ListKey = 'belum_rsvp' | 'belum_dibuka' | 'belum_dikirim' | 'hadir' | 'ragu' | 'tidak';

const LISTS: Array<{ key: ListKey; label: string; match: (g: GuestRow) => boolean }> = [
  { key: 'belum_rsvp', label: 'Belum RSVP', match: (g) => !g.rsvp },
  { key: 'belum_dibuka', label: 'Belum dibuka', match: (g) => !g.opened_at },
  { key: 'belum_dikirim', label: 'Belum dikirim', match: (g) => !g.sent_at },
  { key: 'hadir', label: 'Hadir', match: (g) => g.rsvp?.status === 'hadir' },
  { key: 'ragu', label: 'Masih ragu', match: (g) => g.rsvp?.status === 'ragu' },
  { key: 'tidak', label: 'Tidak hadir', match: (g) => g.rsvp?.status === 'tidak' },
];

const HEADER = [
  'nama', 'grup', 'sapaan', 'sesi', 'max_pax', 'no_wa', 'link',
  'dikirim (WIB)', 'dibuka (WIB)', 'status_rsvp', 'jumlah_orang', 'rsvp_diperbarui (WIB)',
];
const toRow = (g: GuestRow) => [
  g.nama, g.grup, g.sapaan, g.sesi, g.max_pax, g.no_wa, guestLink(g.slug),
  g.sent_at ? shortWib(g.sent_at) : '', g.opened_at ? shortWib(g.opened_at) : '',
  g.rsvp ? STATUS_LABEL[g.rsvp.status] : 'Belum RSVP', g.rsvp?.jumlah_orang ?? '',
  g.rsvp ? shortWib(g.rsvp.updated_at) : '',
];

const stamp = () => new Date().toISOString().slice(0, 10);

export default function RecapTab() {
  const [guests, setGuests] = useState<GuestRow[] | null>(null);
  const [error, setError] = useState('');
  const [grup, setGrup] = useState('');
  const [list, setList] = useState<ListKey>('belum_rsvp');

  const load = () =>
    fetchAllGuests()
      .then((g) => {
        setGuests(g);
        setError('');
      })
      .catch((e) => setError(e instanceof Error ? e.message : String(e)));
  useEffect(() => void load(), []);

  const groups = useMemo(
    () => [...new Set((guests ?? []).map((g) => g.grup).filter((x): x is string => Boolean(x)))].sort(),
    [guests],
  );
  const scoped = useMemo(() => (guests ?? []).filter((g) => !grup || g.grup === grup), [guests, grup]);

  const stats = useMemo(() => {
    const s = { total: scoped.length, hadir: 0, paxHadir: 0, ragu: 0, paxRagu: 0, tidak: 0, belum: 0, dibuka: 0, dikirim: 0, kuota: 0 };
    for (const g of scoped) {
      s.kuota += g.max_pax;
      if (g.opened_at) s.dibuka++;
      if (g.sent_at) s.dikirim++;
      if (!g.rsvp) s.belum++;
      else if (g.rsvp.status === 'hadir') {
        s.hadir++;
        s.paxHadir += g.rsvp.jumlah_orang;
      } else if (g.rsvp.status === 'ragu') {
        s.ragu++;
        s.paxRagu += g.rsvp.jumlah_orang;
      } else s.tidak++;
    }
    return s;
  }, [scoped]);

  const perGroup = useMemo(() => {
    const map = new Map<string, { total: number; hadir: number; pax: number; belum: number }>();
    for (const g of guests ?? []) {
      const k = g.grup ?? '(Tanpa grup)';
      const row = map.get(k) ?? { total: 0, hadir: 0, pax: 0, belum: 0 };
      row.total++;
      if (!g.rsvp) row.belum++;
      if (g.rsvp?.status === 'hadir') {
        row.hadir++;
        row.pax += g.rsvp.jumlah_orang;
      }
      map.set(k, row);
    }
    return [...map.entries()].sort(([a], [b]) => a.localeCompare(b));
  }, [guests]);

  if (error) return <p class="text-rose-700">Gagal memuat: {error}</p>;
  if (!guests) return <p class="text-ink-soft">Memuat rekap…</p>;

  const activeList = LISTS.find((l) => l.key === list)!;
  const listRows = scoped.filter(activeList.match);

  const tiles: Array<[string, string | number, string?]> = [
    ['Hadir', stats.hadir, `${stats.paxHadir} orang`],
    ['Masih ragu', stats.ragu, `${stats.paxRagu} orang`],
    ['Tidak hadir', stats.tidak],
    ['Belum RSVP', stats.belum],
    ['Total pax (hadir)', stats.paxHadir, `maks. ${stats.paxHadir + stats.paxRagu} jika ragu datang`],
    ['Dibuka', `${stats.dibuka}/${stats.total}`],
    ['Dikirim', `${stats.dikirim}/${stats.total}`],
    ['Kuota undangan', stats.kuota, 'jumlah max_pax'],
  ];

  return (
    <div class="space-y-6">
      <div class="flex flex-wrap items-center gap-2">
        <select class="input !w-auto !py-2" value={grup} onChange={(e) => setGrup(e.currentTarget.value)}>
          <option value="">Semua grup</option>
          {groups.map((g) => (
            <option key={g} value={g}>
              {g}
            </option>
          ))}
        </select>
        <button type="button" class="btn btn-outline" onClick={() => void load()}>
          Muat ulang
        </button>
        <button
          type="button"
          class="btn btn-primary ml-auto"
          onClick={() => downloadCsv(`rekap-tamu-${stamp()}.csv`, toCsv(HEADER, scoped.map(toRow)))}
        >
          Ekspor Semua (CSV)
        </button>
      </div>

      <div class="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {tiles.map(([label, value, sub]) => (
          <div key={label} class="rounded-xl bg-white p-4 ring-1 ring-ink/10">
            <p class="text-xs text-ink-soft">{label}</p>
            <p class="mt-1 font-serif text-3xl font-semibold tabular-nums">{value}</p>
            {sub && <p class="text-[11px] text-ink-soft">{sub}</p>}
          </div>
        ))}
      </div>

      {!grup && perGroup.length > 1 && (
        <div class="overflow-x-auto rounded-xl bg-white ring-1 ring-ink/10">
          <table class="w-full text-left text-sm">
            <thead class="bg-paper-deep text-xs uppercase text-ink-soft">
              <tr>
                <th class="px-3 py-2">Grup</th>
                <th class="px-3 py-2 text-right">Tamu</th>
                <th class="px-3 py-2 text-right">Hadir</th>
                <th class="px-3 py-2 text-right">Pax</th>
                <th class="px-3 py-2 text-right">Belum RSVP</th>
              </tr>
            </thead>
            <tbody>
              {perGroup.map(([name, r]) => (
                <tr key={name} class="border-t border-ink/5">
                  <td class="px-3 py-1.5">{name}</td>
                  <td class="px-3 py-1.5 text-right tabular-nums">{r.total}</td>
                  <td class="px-3 py-1.5 text-right tabular-nums">{r.hadir}</td>
                  <td class="px-3 py-1.5 text-right tabular-nums">{r.pax}</td>
                  <td class="px-3 py-1.5 text-right tabular-nums">{r.belum}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div>
        <div class="flex flex-wrap items-center gap-1">
          {LISTS.map((l) => (
            <button
              key={l.key}
              type="button"
              class={`rounded-full px-3 py-1.5 text-xs ${list === l.key ? 'bg-ink text-paper' : 'bg-white ring-1 ring-ink/10'}`}
              onClick={() => setList(l.key)}
            >
              {l.label} ({scoped.filter(l.match).length})
            </button>
          ))}
          <button
            type="button"
            class="btn btn-outline ml-auto !min-h-8 text-xs"
            onClick={() => downloadCsv(`${list}-${stamp()}.csv`, toCsv(HEADER, listRows.map(toRow)))}
          >
            Ekspor daftar ini
          </button>
        </div>
        <ul class="mt-3 divide-y divide-ink/5 rounded-xl bg-white ring-1 ring-ink/10">
          {listRows.map((g) => (
            <li key={g.id} class="flex flex-wrap justify-between gap-2 px-3 py-2 text-sm">
              <span>
                {g.nama} <span class="text-xs text-ink-soft">· {g.grup ?? 'tanpa grup'}</span>
              </span>
              <span class="text-xs text-ink-soft">
                {g.rsvp && g.rsvp.status !== 'tidak' ? `${g.rsvp.jumlah_orang}/${g.max_pax} orang · ` : ''}
                {g.no_wa ?? ''}
              </span>
            </li>
          ))}
          {listRows.length === 0 && <li class="px-3 py-6 text-center text-sm text-ink-soft">Kosong 🎉</li>}
        </ul>
      </div>
    </div>
  );
}
