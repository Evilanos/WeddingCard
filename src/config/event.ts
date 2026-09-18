// =====================================================================
// DATA ACARA PUBLIK — semua nilai di bawah masih PLACEHOLDER.
// Ganti sesuai checklist konten (docs/CONTENT_CHECKLIST.md).
//
// ⚠️ Jangan taruh data privat di sini (file ini ikut ke bundle publik):
//    - detail akad → tabel event_private (diisi lewat /admin → Pengaturan)
//    - daftar tamu  → tabel guests (import CSV di /admin)
//    - deadline RSVP → tabel settings (supaya ditegakkan server)
//
// Semua waktu WAJIB ISO 8601 dengan offset WIB eksplisit: +07:00
// =====================================================================

export type Person = {
  panggilan: string;
  namaLengkap: string;
  anakKe: string;
  ayah: string;
  ibu: string;
  instagram?: string;
};

export type BankAccount = { bank: string; nomor: string; atasNama: string };

export const event = {
  site: {
    title: 'The Wedding of Raka & Nadia',
    description: 'Dengan penuh sukacita, kami mengundang Anda untuk hadir di hari bahagia kami.',
    // Gambar OG: 1200×630, < 300KB, di /public (URL absolut dibentuk dari PUBLIC_SITE_URL)
    ogImage: '/og.jpg',
    themeColor: '#f6f1e9',
  },

  groom: {
    panggilan: 'Raka',
    namaLengkap: 'Raka Aditya Pratama, S.T.',
    anakKe: 'Putra pertama dari',
    ayah: 'Bapak Hendra Pratama',
    ibu: 'Ibu Sri Wahyuni',
    instagram: 'raka.placeholder',
  } satisfies Person,

  bride: {
    panggilan: 'Nadia',
    namaLengkap: 'Nadia Putri Maharani, S.Ds.',
    anakKe: 'Putri kedua dari',
    ayah: 'Bapak Agus Setiawan',
    ibu: 'Ibu Rina Kartika',
    instagram: 'nadia.placeholder',
  } satisfies Person,

  // Urutan nama di cover/hero
  coupleOrder: ['bride', 'groom'] as const,

  // Resepsi = publik & menjadi target countdown hari-H.
  resepsi: {
    judul: 'Resepsi',
    mulai: '2026-12-12T11:00:00+07:00',
    selesai: '2026-12-12T14:00:00+07:00',
    tempat: 'Gedung Contoh Ballroom (placeholder)',
    alamat: 'Jl. Placeholder No. 123, Jakarta Selatan',
    mapsUrl: 'https://maps.google.com/?q=-6.2,106.8',
  },

  // Tampilkan pesan terima kasih setelah waktu ini.
  selesaiSemua: '2026-12-12T14:00:00+07:00',

  quote: {
    teks:
      'Dan di antara tanda-tanda kekuasaan-Nya ialah Dia menciptakan untukmu pasangan hidup dari jenismu sendiri, supaya kamu merasa tenteram kepadanya, dan dijadikan-Nya di antaramu rasa kasih dan sayang.',
    sumber: 'QS. Ar-Rum: 21',
  },

  // Love story — kosongkan array untuk menyembunyikan section.
  story: [
    { tahun: '2019', judul: 'Pertama Bertemu', teks: 'Placeholder: cerita singkat pertemuan pertama.' },
    { tahun: '2022', judul: 'Menjalin Hubungan', teks: 'Placeholder: cerita singkat masa pacaran.' },
    { tahun: '2026', judul: 'Lamaran', teks: 'Placeholder: cerita singkat lamaran.' },
  ],

  gift: {
    intro:
      'Doa restu Anda merupakan karunia yang sangat berarti bagi kami. Namun jika Anda ingin memberikan tanda kasih, dapat melalui:',
    accounts: [
      { bank: 'BCA', nomor: '1234567890', atasNama: 'Nadia Putri Maharani' },
      { bank: 'Mandiri', nomor: '0987654321', atasNama: 'Raka Aditya Pratama' },
    ] satisfies BankAccount[],
    alamat: {
      penerima: 'Nadia Putri Maharani',
      teks: 'Jl. Placeholder No. 45, RT 01/RW 02, Kebayoran Baru, Jakarta Selatan 12110',
    },
  },

  music: {
    // Taruh file di /public/music/. Target 1–2MB (mp3 96–128kbps).
    src: '/music/backsound.mp3',
    judul: 'Backsound (placeholder)',
  },

  // Teks sapaan per kategori di cover: "Dear, {label} {nama}".
  // Kosongkan string kalau nama tamu di CSV sudah memuat gelar (mis. "Bapak Budi").
  sapaanLabel: {
    formal: 'Bapak/Ibu',
    informal: '',
  },
  fallbackGuestName: 'Bapak/Ibu/Saudara/i',

  footer: {
    penutup:
      'Merupakan suatu kehormatan dan kebahagiaan bagi kami apabila Bapak/Ibu/Saudara/i berkenan hadir dan memberikan doa restu.',
    salam: 'Kami yang berbahagia',
  },
} as const;

export type EventConfig = typeof event;
