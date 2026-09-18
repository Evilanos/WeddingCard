-- Seed data CONTOH untuk development lokal (`npx supabase db reset`).
-- Jangan dijalankan di produksi.

update public.settings
set rsvp_deadline = '2026-12-05 23:59:59+07'
where id = 1;

update public.event_private
set akad = jsonb_build_object(
  'mulai',    '2026-12-12T08:00:00+07:00',
  'selesai',  '2026-12-12T10:00:00+07:00',
  'tempat',   'Masjid Contoh (placeholder)',
  'alamat',   'Jl. Contoh No. 1, Jakarta Selatan',
  'maps_url', 'https://maps.google.com/?q=-6.2,106.8'
)
where id = 1;

-- Slug ditulis eksplisit supaya mudah dites: /?to=budi-santoso-a1b2c3
insert into public.guests (slug, nama, sapaan, sesi, max_pax, no_wa, grup) values
  ('budi-santoso-a1b2c3',   'Budi Santoso',        'formal',   'keduanya', 2, '081200000001', 'Keluarga Pria'),
  ('siti-rahma-d4e5f6',     'Siti Rahma',          'formal',   'resepsi',  2, '081200000002', 'Keluarga Wanita'),
  ('andi-pratama-g7h8i9',   'Andi Pratama',        'informal', 'resepsi',  1, '081200000003', 'Teman Kantor'),
  ('keluarga-hartono-j1k2l3','Keluarga Hartono',   'formal',   'keduanya', 4, '081200000004', 'Keluarga Pria'),
  ('rina-melati-m4n5o6',    'Rina Melati',         'informal', 'resepsi',  2, '081200000005', 'Teman Kuliah'),
  ('pak-rt-p7q8r9',         'Bapak Ketua RT 05',   'formal',   'akad',     1, null,           'Tetangga');

-- Tamu ke-7 tanpa slug eksplisit → trigger membuat slug acak.
insert into public.guests (nama, sapaan, sesi, max_pax, grup)
values ('Dewi Lestari', 'informal', 'resepsi', 2, 'Teman Kuliah');

insert into public.rsvp (guest_id, status, jumlah_orang)
select id, 'hadir', 2 from public.guests where slug = 'budi-santoso-a1b2c3';
insert into public.rsvp (guest_id, status, jumlah_orang)
select id, 'tidak', 0 from public.guests where slug = 'andi-pratama-g7h8i9';
insert into public.rsvp (guest_id, status, jumlah_orang)
select id, 'ragu', 1 from public.guests where slug = 'rina-melati-m4n5o6';

insert into public.wishes (guest_id, nama, pesan, created_at)
select id, 'Budi Santoso', 'Selamat menempuh hidup baru! Semoga menjadi keluarga sakinah, mawaddah, warahmah.', now() - interval '3 hours'
from public.guests where slug = 'budi-santoso-a1b2c3';
insert into public.wishes (guest_id, nama, pesan, created_at)
select id, 'Andi', 'Maaf belum bisa hadir, doa terbaik untuk kalian berdua 🙏', now() - interval '50 minutes'
from public.guests where slug = 'andi-pratama-g7h8i9';
insert into public.wishes (nama, pesan, created_at) values
  ('Teman SMA', 'Happy wedding! Langgeng terus ya ✨', now() - interval '2 days'),
  ('Tante Yuli', 'Barakallahu lakuma wa baraka alaikuma wa jamaa bainakuma fii khair.', now() - interval '1 day');
insert into public.wishes (nama, pesan, is_hidden) values
  ('Spammer', 'Contoh ucapan yang disembunyikan admin', true);
