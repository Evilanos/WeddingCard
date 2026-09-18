# Undangan Pernikahan Digital

Web undangan satu halaman, mobile-first, dengan personalisasi per tamu (`/?to={slug}`), RSVP, dan ucapan bergaya bubble chat. Dioptimalkan untuk dibuka dari in-app browser WhatsApp.

| Layer | Teknologi |
|---|---|
| Frontend | Astro 7 (static) + Tailwind 4, island Preact untuk form/list ucapan & admin |
| Hosting | Cloudflare Pages (semua aset: foto, musik, OG) |
| Database | Supabase Postgres + RLS + Realtime (broadcast) + Edge Function |
| Anti-spam | Cloudflare Turnstile → rate limit per IP-hash → validasi → filter kata kasar |
| Admin | `/admin`, login magic link Supabase Auth, role dari tabel `admins` |

```
Tamu (WA) ─► Cloudflare Pages (HTML statis + CDN)
              ├─ RPC get_guest(slug)          nama, sapaan, sesi, max_pax, akad*, rsvp
              ├─ RPC get_public_settings()    wishes_frozen, rsvp_deadline
              ├─ RPC list_wishes(cursor)      feed ucapan (tanpa ip_hash / guest_id)
              ├─ Edge Fn submit-wish          Turnstile → rate limit → validasi → filter → submit_entry()
              └─ Realtime broadcast "wishes"  hanya saat section ucapan terlihat; fallback polling 30 dtk
Admin ─► /admin (Supabase Auth + RLS is_admin())
* akad hanya dikembalikan untuk tamu sesi akad/keduanya
```

Tabel `guests`, `wishes`, dan `rsvp` **tidak bisa dibaca anon**. Semua akses publik lewat RPC `security definer`.

---

## Struktur

```
src/
  config/event.ts        ← DATA ACARA PUBLIK (placeholder; lihat checklist konten)
  pages/index.astro      halaman undangan
  pages/admin.astro      halaman admin
  pages/resepsi.ics.ts   file kalender resepsi (statis)
  components/            section-section (Astro, tanpa JS kecuali kecil)
  islands/               RsvpWishForm, WishList, Turnstile (Preact)
  admin/                 AdminApp + tab Tamu / Rekap / Ucapan / Pengaturan
  scripts/invite.ts      cover & scroll lock, personalisasi, countdown, copy
  lib/                   api (fetch RPC), realtime (lazy supabase-js), waktu WIB, kalender
  assets/                foto (dikompres otomatis saat build)
public/
  og.jpg                 thumbnail WhatsApp 1200×630 (< 300KB)
  music/backsound.mp3    musik latar (belum ada, lihat checklist)
  contoh-tamu.csv        template import
  _headers               header Cloudflare (cache, CSP, noindex)
supabase/
  migrations/…_init.sql  schema, index, RLS, RPC, trigger
  seed.sql               data contoh (dev saja)
  functions/submit-wish  Edge Function
  functions/_shared/profanity.ts  filter kata kasar
tests/                   uji SQL (PGlite) & filter kata
docs/CONTENT_CHECKLIST.md
```

---

## Setup lokal

Prasyarat: **Node ≥ 22.12**. Untuk Supabase lokal juga perlu **Docker Desktop**.

```bash
npm install
cp .env.example .env
cp supabase/functions/.env.example supabase/functions/.env
npm run placeholders        # buat foto placeholder (sekali; tidak menimpa foto asli)
```

### Opsi A: Supabase lokal (Docker)

```bash
npm run db:start            # menampilkan API URL & anon key → isi ke .env
npm run db:reset            # jalankan migrasi + seed.sql
npm run fn:serve            # Edge Function submit-wish (terminal terpisah)
npm run dev                 # http://localhost:4321
```

Coba buka:
- `http://localhost:4321/?to=budi-santoso-a1b2c3` → tamu akad + resepsi
- `http://localhost:4321/?to=siti-rahma-d4e5f6` → tamu resepsi saja
- `http://localhost:4321/?to=pak-rt-p7q8r9` → tamu akad saja
- `http://localhost:4321/` → fallback "Bapak/Ibu/Saudara/i", tanpa RSVP

Email magic link lokal bisa dilihat di Inbucket/Mailpit (URL-nya tampil di output `db:start`).

### Opsi B: langsung ke project Supabase cloud

Isi `.env` dengan URL & anon key project, lalu jalankan `npm run dev`. Deploy migrasi & function seperti di bagian Deploy.

### Environment variables

| Variabel | Di mana | Keterangan |
|---|---|---|
| `PUBLIC_SITE_URL` | `.env` / Cloudflare | URL produksi **https absolut**, dipakai OG tags & link tamu |
| `PUBLIC_SUPABASE_URL` | `.env` / Cloudflare | Project Settings → API |
| `PUBLIC_SUPABASE_ANON_KEY` | `.env` / Cloudflare | Anon/publishable key (aman di-bundle) |
| `PUBLIC_TURNSTILE_SITE_KEY` | `.env` / Cloudflare | Turnstile site key. Test key: `1x00000000000000000000AA` |
| `TURNSTILE_SECRET` | Supabase secrets | Turnstile secret. Test: `1x0000000000000000000000000000000AA` |
| `IP_HASH_SALT` | Supabase secrets | String acak panjang. IP mentah tidak pernah disimpan |
| `ALLOWED_ORIGINS` | Supabase secrets | Origin yang boleh submit, dipisah koma |

`SUPABASE_URL` dan `SUPABASE_SERVICE_ROLE_KEY` otomatis tersedia di Edge Function.

---

## Deploy

### 1. Supabase

```bash
npx supabase login
npx supabase link --project-ref <ref>
npm run db:push                                   # migrasi (TANPA seed)
npx supabase secrets set --env-file supabase/functions/.env
npm run fn:deploy                                 # submit-wish, verify_jwt = false
```

Di dashboard Supabase:
1. **Authentication → Sign In / Providers**: matikan *Allow new users to sign up*.
2. **Authentication → URL Configuration**: Site URL = `https://domain-anda`, tambahkan `https://domain-anda/admin` ke Redirect URLs.
3. **Authentication → Users → Invite user**: undang email admin.
4. Jadikan admin (SQL Editor):
   ```sql
   insert into public.admins (user_id)
   select id from auth.users where email = 'admin@contoh.com';
   ```
5. Buka `/admin → Pengaturan`: isi batas RSVP, template WA, dan **detail akad**.

### 2. Cloudflare Turnstile

Dashboard Cloudflare → Turnstile → Add widget (mode *Managed*), domain = domain produksi (+ `localhost` untuk dev). Site key masuk ke env Pages, secret key masuk ke Supabase secrets.

### 3. Cloudflare Pages

Hubungkan repo di *Workers & Pages → Create → Pages → Connect to Git*:
- Build command: `npm run build`
- Output directory: `dist`
- Environment variables: semua `PUBLIC_*` di atas, plus `NODE_VERSION=22`

Setelah domain aktif, update `PUBLIC_SITE_URL` dan `ALLOWED_ORIGINS`, lalu deploy ulang.

### 4. Cegah Supabase free tier di-pause

Workflow [`.github/workflows/supabase-keepalive.yml`](.github/workflows/supabase-keepalive.yml) melakukan ping setiap 2 hari. Isi secrets repo `SUPABASE_URL` & `SUPABASE_ANON_KEY`. Workflow hanya jalan jika folder ini adalah **root repo** di GitHub.
Alternatif yang lebih aman: upgrade ke **Supabase Pro** selama periode blast sampai hari-H (koneksi realtime juga lebih banyak).

---

## Import tamu (CSV)

1. Siapkan sheet dengan kolom `nama, sapaan, sesi, max_pax, no_wa, grup` (lihat [`public/contoh-tamu.csv`](public/contoh-tamu.csv) dan [checklist](docs/CONTENT_CHECKLIST.md#7-daftar-tamu-csv)).
2. Google Sheets: *File → Download → CSV*. Excel: *Save As → CSV* (pemisah `;` juga didukung).
3. `/admin → Tamu → Import CSV` → pilih file. Periksa pratinjau (baris error & duplikat ditandai) → **Impor**.
4. Slug `nama-tamu-xxxxxx` dibuat otomatis oleh database.

Kirim undangan dari tab **Tamu**:
- **WA**: buka WhatsApp dengan pesan dari template (ke nomor tamu, atau pilih kontak jika nomor kosong).
- **Link / Pesan**: salin link atau pesan lengkap.
- Centang **Kirim** setelah benar-benar terkirim.

Blast dilakukan manual lewat tombol WA. Hindari tools blast otomatis karena nomor bisa diblokir WhatsApp.

## Admin

| Tab | Fungsi |
|---|---|
| Tamu | Import CSV, cari/filter grup & status kirim, link personal, tombol WA, tandai terkirim, hapus |
| Rekap | Hadir / ragu / tidak + total pax, belum RSVP / dibuka / dikirim, rekap per grup, ekspor CSV |
| Ucapan | Sembunyikan/tampilkan, hapus permanen, **mode moderasi**, **tutup form ucapan (darurat)** |
| Pengaturan | Batas RSVP (WIB), template WA, detail akad (privat), **hapus semua nomor WA** (UU PDP, setelah acara) |

Saat ada serangan spam:
1. Aktifkan **Mode moderasi**. Ucapan baru tersembunyi sampai disetujui.
2. Jika parah, aktifkan **Tutup form ucapan**. RSVP tetap berjalan.
3. Sembunyikan ucapan spam yang sudah terlanjur tampil.

---

## Pengujian

```bash
npm run check          # type-check Astro/TS
npm run test:sql       # migrasi + seed + RLS + RPC di PGlite (tanpa Docker)
npm run test:filter    # filter kata kasar
npm run build
```

### Checklist sebelum blast
- [ ] Semua placeholder di `src/config/event.ts` & foto sudah diganti (`grep -ri placeholder src`)
- [ ] Nomor rekening dicek ulang oleh pemiliknya
- [ ] Detail akad terisi di admin; buka link tamu *resepsi saja* dan pastikan akad **tidak** muncul
- [ ] `og.jpg` final. Cek preview dengan kirim link ke diri sendiri di WA (cache WA sulit direset)
- [ ] Turnstile & `ALLOWED_ORIGINS` memakai domain produksi (bukan test key)
- [ ] Lighthouse mobile ≥ 90 (PageSpeed Insights pada URL produksi)
- [ ] Uji di perangkat nyata:

| Skenario | WA Android | WA iOS | Chrome Android | Safari iOS |
|---|---|---|---|---|
| Nama tamu tampil, fallback tanpa `?to=` | ☐ | ☐ | ☐ | ☐ |
| Tidak bisa scroll sebelum "Buka Undangan" | ☐ | ☐ | ☐ | ☐ |
| Musik mulai setelah dibuka, tombol play/pause | ☐ | ☐ | ☐ | ☐ |
| Layar penuh tanpa "loncat" saat address bar muncul/hilang | ☐ | ☐ | ☐ | ☐ |
| Lihat Maps & Save the Date (Google Calendar) | ☐ | ☐ | ☐ | ☐ |
| Salin nomor rekening | ☐ | ☐ | ☐ | ☐ |
| RSVP + ucapan terkirim, bubble muncul | ☐ | ☐ | ☐ | ☐ |
| Ucapan dari HP lain muncul tanpa reload | ☐ | ☐ | ☐ | ☐ |
| Galeri: foto bisa diperbesar & ditutup | ☐ | ☐ | ☐ | ☐ |

### Soft launch
1. Kirim 10–20 link ke keluarga dekat (campur Android/iOS, sesi akad & resepsi).
2. Pantau `/admin → Rekap` (kolom *Dibuka*) & `/admin → Ucapan`, lalu kumpulkan temuan.
3. Perbaiki temuan, finalisasi OG, baru blast.

## Catatan teknis
- **Waktu**: semua ISO 8601 dengan `+07:00`; tampilan dipaksa `Asia/Jakarta` + label "WIB".
- **XSS**: ucapan disimpan sebagai teks dan selalu dirender sebagai text node (tanpa `innerHTML` / `set:html`); link Maps dari DB hanya diterima jika `http(s)`.
- **Realtime**: trigger DB mengirim payload yang sudah disanitasi via `realtime.send` ke topic publik `wishes`, jadi tabel `wishes` tetap tertutup untuk anon. supabase-js (±55KB gzip) hanya dimuat saat section ucapan terlihat.
- **Performa**: konten di balik cover `display:none` sampai dibuka; CSS di-inline; font cover di-preload; foto AVIF/WebP + srcset + lazy.
- **Rate limit**: 3 kiriman / 10 menit per IP-hash (`RATE_MAX` di Edge Function). Tamu satu kantor/NAT yang sama berbagi kuota; naikkan jika perlu.
- **Filter kata**: daftar di `supabase/functions/_shared/profanity.ts`. Tidak sempurna (mis. "fvck" lolos), jadi andalkan juga mode moderasi.
