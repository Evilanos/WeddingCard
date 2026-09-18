import { useEffect, useState } from 'preact/hooks';
import { toast } from '../lib/toast';
import { fromWibInput, renderTemplate, toWibInput } from './format';
import { fetchSettings, guestLink, sb, type AkadData, type SettingsRow } from './supabase';

export default function SettingsTab() {
  const [settings, setSettings] = useState<SettingsRow | null>(null);
  const [deadline, setDeadline] = useState('');
  const [template, setTemplate] = useState('');
  const [akad, setAkad] = useState<AkadData>({});
  const [akadMulai, setAkadMulai] = useState('');
  const [akadSelesai, setAkadSelesai] = useState('');
  const [error, setError] = useState('');
  const [phoneCount, setPhoneCount] = useState<number | null>(null);

  useEffect(() => {
    void (async () => {
      try {
        const s = await fetchSettings();
        setSettings(s);
        setDeadline(toWibInput(s.rsvp_deadline));
        setTemplate(s.wa_template);
        const { data, error: err } = await sb.from('event_private').select('akad').eq('id', 1).single();
        if (err) throw err;
        const a = (data?.akad ?? {}) as AkadData;
        setAkad(a);
        setAkadMulai(toWibInput(a.mulai));
        setAkadSelesai(toWibInput(a.selesai));
        const { count } = await sb.from('guests').select('id', { count: 'exact', head: true }).not('no_wa', 'is', null);
        setPhoneCount(count ?? 0);
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      }
    })();
  }, []);

  async function saveSettings(e: Event) {
    e.preventDefault();
    const { error: err } = await sb
      .from('settings')
      .update({ rsvp_deadline: fromWibInput(deadline), wa_template: template })
      .eq('id', 1);
    toast(err ? `Gagal: ${err.message}` : 'Pengaturan disimpan ✓');
  }

  async function saveAkad(e: Event) {
    e.preventDefault();
    const mulai = fromWibInput(akadMulai);
    const payload: AkadData = mulai
      ? {
          mulai,
          selesai: fromWibInput(akadSelesai) ?? undefined,
          tempat: akad.tempat?.trim() ?? '',
          alamat: akad.alamat?.trim() ?? '',
          maps_url: akad.maps_url?.trim() ?? '',
        }
      : {}; // kosong = akad tidak ditampilkan ke siapa pun
    if (payload.maps_url && !/^https:\/\//.test(payload.maps_url)) {
      return toast('Link Maps harus diawali https://');
    }
    const { error: err } = await sb.from('event_private').update({ akad: payload }).eq('id', 1);
    toast(err ? `Gagal: ${err.message}` : 'Data akad disimpan ✓');
  }

  async function purgePhones() {
    const phrase = 'HAPUS NOMOR';
    const typed = prompt(
      `Ini akan menghapus SEMUA nomor WA tamu (${phoneCount ?? '?'} nomor) secara permanen.\n` +
        `Jalankan setelah acara selesai. Ketik "${phrase}" untuk melanjutkan:`,
    );
    if (typed !== phrase) return;
    const { error: err } = await sb.from('guests').update({ no_wa: null }).not('no_wa', 'is', null);
    if (err) return toast(`Gagal: ${err.message}`);
    setPhoneCount(0);
    toast('Semua nomor WA telah dihapus ✓');
  }

  if (error) return <p class="text-rose-700">Gagal memuat: {error}</p>;
  if (!settings) return <p class="text-ink-soft">Memuat…</p>;

  const preview = renderTemplate(template, { nama: 'Budi Santoso', sapaan: 'formal' }, guestLink('budi-santoso-a1b2c3'));

  return (
    <div class="grid gap-6 lg:grid-cols-2">
      <form class="card space-y-4" onSubmit={saveSettings}>
        <h2 class="text-xl">RSVP &amp; Template WA</h2>
        <label class="block text-sm">
          <span class="font-medium">Batas konfirmasi kehadiran (WIB, +07:00)</span>
          <input
            type="datetime-local"
            class="input mt-1"
            value={deadline}
            onInput={(e) => setDeadline(e.currentTarget.value)}
          />
          <span class="text-xs text-ink-soft">Kosongkan = tanpa batas. Ditegakkan di server.</span>
        </label>
        <label class="block text-sm">
          <span class="font-medium">Template pesan WhatsApp</span>
          <textarea
            class="input mt-1 min-h-48 font-mono text-xs"
            value={template}
            onInput={(e) => setTemplate(e.currentTarget.value)}
          />
          <span class="text-xs text-ink-soft">
            Placeholder: <code>{'{sapaan}'}</code> <code>{'{nama}'}</code> <code>{'{link}'}</code>
          </span>
        </label>
        <details class="text-xs">
          <summary class="cursor-pointer text-ink-soft">Pratinjau</summary>
          <pre class="mt-2 whitespace-pre-wrap rounded-lg bg-paper-deep p-3 font-sans">{preview}</pre>
        </details>
        <button type="submit" class="btn btn-primary">
          Simpan
        </button>
      </form>

      <form class="card space-y-4" onSubmit={saveAkad}>
        <h2 class="text-xl">Detail Akad (privat)</h2>
        <p class="text-xs text-ink-soft">
          Hanya dikirim ke tamu dengan sesi <em>akad</em> atau <em>keduanya</em>. Tidak ada di kode frontend.
          Kosongkan waktu mulai untuk menyembunyikan akad dari semua tamu.
        </p>
        <div class="grid grid-cols-2 gap-3">
          <label class="block text-sm">
            <span class="font-medium">Mulai (WIB)</span>
            <input type="datetime-local" class="input mt-1" value={akadMulai} onInput={(e) => setAkadMulai(e.currentTarget.value)} />
          </label>
          <label class="block text-sm">
            <span class="font-medium">Selesai (WIB)</span>
            <input type="datetime-local" class="input mt-1" value={akadSelesai} onInput={(e) => setAkadSelesai(e.currentTarget.value)} />
          </label>
        </div>
        {(
          [
            ['tempat', 'Nama tempat'],
            ['alamat', 'Alamat'],
            ['maps_url', 'Link Google Maps (https://…)'],
          ] as const
        ).map(([key, label]) => (
          <label key={key} class="block text-sm">
            <span class="font-medium">{label}</span>
            <input
              class="input mt-1"
              value={akad[key] ?? ''}
              onInput={(e) => setAkad({ ...akad, [key]: e.currentTarget.value })}
            />
          </label>
        ))}
        <button type="submit" class="btn btn-primary">
          Simpan Akad
        </button>
      </form>

      <div class="card space-y-3 ring-rose-200 lg:col-span-2">
        <h2 class="text-xl text-rose-800">Privasi data (UU PDP)</h2>
        <p class="text-sm text-ink-soft">
          Setelah acara selesai, hapus nomor WhatsApp tamu yang sudah tidak diperlukan. Saat ini tersimpan{' '}
          <strong>{phoneCount ?? '…'}</strong> nomor.
        </p>
        <button
          type="button"
          class="btn border border-rose-300 text-rose-800 hover:bg-rose-50"
          disabled={!phoneCount}
          onClick={() => void purgePhones()}
        >
          Hapus Semua Nomor WA
        </button>
      </div>
    </div>
  );
}
