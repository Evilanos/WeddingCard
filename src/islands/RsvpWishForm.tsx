import { useEffect, useState } from 'preact/hooks';
import {
  ERROR_MESSAGES,
  backendConfigured,
  getGuest,
  getPublicSettings,
  patchGuestRsvp,
  submitEntry,
  type Guest,
  type PublicSettings,
  type RsvpStatus,
} from '../lib/api';
import { STATUS_LABEL, STATUS_OPTIONS } from '../lib/labels';
import { formatDateTime } from '../lib/time';
import { emit, nextTempId } from '../lib/wishBus';
import Turnstile from './Turnstile';

const MAX_MESSAGE = 500;
const MAX_NAME = 60;

type Loaded = { guest: Guest | null; settings: PublicSettings };
type Notice = { kind: 'ok' | 'error'; text: string } | null;

export default function RsvpWishForm() {
  const [data, setData] = useState<Loaded | null>(null);
  const [nama, setNama] = useState('');
  const [status, setStatus] = useState<RsvpStatus | null>(null);
  const [jumlah, setJumlah] = useState(1);
  const [pesan, setPesan] = useState('');
  const [token, setToken] = useState<string | null>(null);
  const [captchaError, setCaptchaError] = useState(false);
  const [resetKey, setResetKey] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [notice, setNotice] = useState<Notice>(null);

  useEffect(() => {
    void Promise.all([getGuest(), getPublicSettings()]).then(([guest, settings]) => {
      setData({ guest, settings });
      if (guest) {
        setNama(guest.nama.slice(0, MAX_NAME));
        if (guest.rsvp) {
          setStatus(guest.rsvp.status);
          setJumlah(Math.max(1, Math.min(guest.rsvp.jumlah_orang || 1, guest.max_pax)));
        }
      }
    });
  }, []);

  if (!backendConfigured) {
    return <p class="card text-center text-sm text-ink-soft">Form belum aktif (backend belum dikonfigurasi).</p>;
  }
  if (!data) {
    return (
      <div class="card space-y-3" aria-busy="true">
        {[0, 1, 2].map((i) => (
          <div key={i} class="h-11 animate-pulse rounded-xl bg-ink/5" />
        ))}
      </div>
    );
  }

  const { guest, settings } = data;
  const deadline = settings.rsvp_deadline ? new Date(settings.rsvp_deadline) : null;
  const rsvpOpen = !deadline || Date.now() <= deadline.getTime();
  const canRsvp = Boolean(guest) && rsvpOpen;
  const canWish = !settings.wishes_frozen;

  if (!canRsvp && !canWish) {
    return (
      <p class="card text-center text-sm text-ink-soft">
        {guest && !rsvpOpen ? 'Konfirmasi kehadiran sudah ditutup. ' : ''}
        Pengiriman ucapan sedang ditutup. Terima kasih atas doa dan perhatiannya 🙏
      </p>
    );
  }

  const maxPax = guest?.max_pax ?? 1;
  const trimmedPesan = pesan.trim();
  const needsMessage = !canRsvp;
  const hasSomething = (canRsvp && status !== null) || (canWish && trimmedPesan.length > 0);

  async function onSubmit(e: Event) {
    e.preventDefault();
    if (submitting) return;
    setNotice(null);

    const cleanName = nama.trim();
    if (!cleanName) return setNotice({ kind: 'error', text: ERROR_MESSAGES.invalid_name });
    if (canRsvp && status === null && !trimmedPesan) {
      return setNotice({ kind: 'error', text: 'Pilih status kehadiran atau tulis ucapan.' });
    }
    if (needsMessage && !trimmedPesan) return setNotice({ kind: 'error', text: ERROR_MESSAGES.empty });
    if (trimmedPesan.length > MAX_MESSAGE) return setNotice({ kind: 'error', text: ERROR_MESSAGES.message_too_long });
    if (!token) return setNotice({ kind: 'error', text: 'Mohon tunggu verifikasi keamanan selesai.' });

    const sendStatus = canRsvp ? status : null;
    const sendJumlah = sendStatus && sendStatus !== 'tidak' ? jumlah : sendStatus === 'tidak' ? 0 : null;
    const sendPesan = canWish ? trimmedPesan : '';

    // Optimistic bubble
    const tempId = nextTempId();
    if (sendPesan) {
      emit('wish:optimistic', {
        tempId,
        wish: {
          id: tempId,
          nama: cleanName,
          pesan: sendPesan,
          created_at: new Date().toISOString(),
          is_guest: Boolean(guest),
          rsvp_status: sendStatus ?? guest?.rsvp?.status ?? null,
          pending: true,
        },
      });
    }

    setSubmitting(true);
    const result = await submitEntry({
      token,
      slug: guest?.slug ?? null,
      nama: cleanName,
      pesan: sendPesan,
      status: sendStatus,
      jumlah: sendJumlah,
    });
    setSubmitting(false);
    setResetKey((k) => k + 1); // token Turnstile sekali pakai

    if (!result.ok) {
      if (sendPesan) emit('wish:failed', { tempId });
      setNotice({ kind: 'error', text: ERROR_MESSAGES[result.error] ?? ERROR_MESSAGES.server_error });
      return;
    }

    if (sendPesan) emit('wish:confirmed', { tempId, wish: result.wish, hidden: result.hidden });
    if (result.rsvp) {
      patchGuestRsvp(result.rsvp);
      setData({ guest: guest ? { ...guest, rsvp: result.rsvp } : guest, settings });
    }
    setPesan('');

    const parts: string[] = [];
    if (result.rsvp) {
      parts.push(
        result.rsvp.status === 'tidak'
          ? 'Konfirmasi tersimpan. Terima kasih atas kabarnya.'
          : `Konfirmasi tersimpan: ${STATUS_LABEL[result.rsvp.status]}, ${result.rsvp.jumlah_orang} orang.`,
      );
    }
    if (result.wish) {
      parts.push(result.hidden ? 'Ucapan Anda akan tampil setelah ditinjau.' : 'Terima kasih atas ucapan dan doanya!');
    }
    setNotice({ kind: 'ok', text: parts.join(' ') });
  }

  return (
    <form class="card space-y-5 text-left" onSubmit={onSubmit} noValidate>
      <div>
        <label for="f-nama" class="mb-1.5 block text-sm font-medium">
          Nama
        </label>
        <input
          id="f-nama"
          class="input"
          value={nama}
          maxLength={MAX_NAME}
          autoComplete="name"
          required
          onInput={(e) => setNama(e.currentTarget.value)}
        />
      </div>

      {canRsvp && guest && (
        <fieldset>
          <legend class="mb-1.5 text-sm font-medium">Konfirmasi Kehadiran</legend>
          {guest.rsvp && (
            <p class="mb-2 text-xs text-ink-soft">
              Tercatat: <strong>{STATUS_LABEL[guest.rsvp.status]}</strong>
              {guest.rsvp.status !== 'tidak' && ` (${guest.rsvp.jumlah_orang} orang)`}. Anda dapat mengubahnya.
            </p>
          )}
          <div class="grid grid-cols-3 gap-2">
            {STATUS_OPTIONS.map((opt) => (
              <label
                key={opt.value}
                class={`flex min-h-11 cursor-pointer items-center justify-center rounded-xl border px-2 text-center text-sm transition ${
                  status === opt.value ? 'border-ink bg-ink text-paper' : 'border-ink/15 bg-white'
                }`}
              >
                <input
                  type="radio"
                  name="status"
                  value={opt.value}
                  class="sr-only"
                  checked={status === opt.value}
                  onChange={() => setStatus(opt.value)}
                />
                {opt.label}
              </label>
            ))}
          </div>
          {deadline && (
            <p class="mt-2 text-xs text-ink-soft">Mohon konfirmasi sebelum {formatDateTime(deadline)}.</p>
          )}
        </fieldset>
      )}

      {canRsvp && status && status !== 'tidak' && (
        <div>
          <label for="f-jumlah" class="mb-1.5 block text-sm font-medium">
            Jumlah Tamu
          </label>
          <select
            id="f-jumlah"
            class="input"
            value={jumlah}
            onChange={(e) => setJumlah(Number(e.currentTarget.value))}
          >
            {Array.from({ length: maxPax }, (_, i) => i + 1).map((n) => (
              <option key={n} value={n}>
                {n} orang
              </option>
            ))}
          </select>
        </div>
      )}

      {!guest && (
        <p class="rounded-xl bg-paper-deep px-4 py-3 text-xs text-ink-soft">
          Konfirmasi kehadiran hanya tersedia melalui link undangan pribadi. Anda tetap dapat mengirim ucapan.
        </p>
      )}
      {guest && !rsvpOpen && (
        <p class="rounded-xl bg-paper-deep px-4 py-3 text-xs text-ink-soft">
          Batas konfirmasi kehadiran sudah lewat. Anda tetap dapat mengirim ucapan.
        </p>
      )}

      {canWish ? (
        <div>
          <label for="f-pesan" class="mb-1.5 block text-sm font-medium">
            Ucapan &amp; Doa {needsMessage ? '' : <span class="font-normal text-ink-soft">(opsional)</span>}
          </label>
          <textarea
            id="f-pesan"
            class="input min-h-28 resize-y"
            value={pesan}
            maxLength={MAX_MESSAGE}
            rows={4}
            placeholder="Tulis ucapan dan doa untuk kedua mempelai…"
            onInput={(e) => setPesan(e.currentTarget.value)}
          />
          <p class={`mt-1 text-right text-xs ${pesan.length >= MAX_MESSAGE ? 'text-rose-700' : 'text-ink-soft'}`}>
            {pesan.length}/{MAX_MESSAGE}
          </p>
        </div>
      ) : (
        <p class="rounded-xl bg-paper-deep px-4 py-3 text-xs text-ink-soft">Pengiriman ucapan sedang ditutup.</p>
      )}

      <Turnstile
        resetKey={resetKey}
        onToken={(t) => {
          setToken(t);
          if (t) setCaptchaError(false);
        }}
        onError={() => setCaptchaError(true)}
      />
      {captchaError && (
        <p class="text-center text-xs text-rose-700">
          Verifikasi keamanan gagal dimuat. Periksa koneksi, lalu muat ulang halaman.
        </p>
      )}

      <button type="submit" class="btn btn-primary w-full" disabled={submitting || !hasSomething}>
        {submitting ? 'Mengirim…' : !token ? 'Memverifikasi…' : 'Kirim'}
      </button>

      {notice && (
        <p
          role={notice.kind === 'error' ? 'alert' : 'status'}
          class={`rounded-xl px-4 py-3 text-sm ${
            notice.kind === 'error' ? 'bg-rose-50 text-rose-800' : 'bg-emerald-50 text-emerald-800'
          }`}
        >
          {notice.text}
        </p>
      )}
    </form>
  );
}
