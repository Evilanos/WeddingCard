// Filter kata kasar sederhana (Indonesia + Inggris + beberapa bahasa daerah).
// Tidak akan pernah sempurna — ini lapis pertama; moderation_mode & tombol
// sembunyikan di admin adalah lapis berikutnya. Silakan tambah kata di BLOCKLIST.
//
// Normalisasi: huruf kecil, buang aksen, angka/simbol leet → huruf,
// huruf berulang diringkas (anjiiing → anjing), huruf yang dipisah spasi
// digabung (a n j i n g → anjing).

type Mode = 'sub' | 'word';

// 'sub'  = cocok jika muncul di dalam satu kata (bangsatt, dasarbangsat)
// 'word' = cocok hanya jika kata utuh (hindari "asu" di "asuransi")
const BLOCKLIST: Array<[string, Mode]> = [
  ['anjing', 'sub'], ['anjg', 'word'], ['anj', 'word'], ['ajg', 'word'],
  ['bangsat', 'sub'], ['bgst', 'word'],
  ['bajingan', 'sub'], ['brengsek', 'sub'], ['keparat', 'sub'], ['kampret', 'sub'],
  ['goblok', 'sub'], ['goblog', 'sub'], ['gblk', 'word'],
  ['tolol', 'sub'], ['idiot', 'word'],
  // Catatan: kata dengan huruf dobel ikut diringkas ("mmk" → "mk"), jadi hindari singkatan seperti itu.
  // "setan"/"iblis" sengaja tidak dimasukkan: wajar muncul di doa ("dijauhkan dari godaan setan").
  ['kontol', 'sub'], ['kntl', 'word'], ['memek', 'sub'],
  ['ngentot', 'sub'], ['ngewe', 'sub'], ['entot', 'sub'], ['jembut', 'sub'], ['pepek', 'sub'],
  ['lonte', 'sub'], ['pelacur', 'sub'], ['perek', 'word'], ['jablay', 'sub'],
  ['babi', 'word'], ['monyet', 'word'], ['asu', 'word'], ['tai', 'word'], ['taik', 'word'],
  ['jancok', 'sub'], ['jancuk', 'sub'], ['dancok', 'sub'], ['cok', 'word'], ['cuk', 'word'],
  ['bacot', 'word'],
  ['fuck', 'sub'], ['shit', 'sub'], ['bitch', 'sub'], ['asshole', 'sub'], ['dick', 'word'],
  ['porn', 'sub'], ['bokep', 'sub'], ['judol', 'sub'], ['slot', 'word'], ['gacor', 'sub'],
];

const LEET: Record<string, string> = {
  '0': 'o', '1': 'i', '2': 'z', '3': 'e', '4': 'a', '5': 's', '6': 'g', '7': 't', '8': 'b', '9': 'g',
  '@': 'a', '$': 's', '!': 'i', '|': 'i', '+': 't', '€': 'e',
};

const collapseRepeats = (s: string) => s.replace(/([a-z])\1+/g, '$1');

/** Ubah teks jadi daftar token yang sudah dinormalisasi. */
export function normalizeTokens(text: string): string[] {
  const lowered = text
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '');

  let mapped = '';
  for (const ch of lowered) mapped += LEET[ch] ?? ch;

  // Tanda baca di tengah kata (a.n.j.i.n.g, b*ngsat) dibuang, bukan dijadikan spasi.
  const raw = mapped
    .replace(/(?<=[a-z])[._*\-'`~^]+(?=[a-z])/g, '')
    .replace(/[^a-z]+/g, ' ')
    .trim()
    .split(' ')
    .filter(Boolean)
    .map(collapseRepeats);

  // Gabungkan deretan huruf tunggal: "a n j i n g" → "anjing".
  const tokens: string[] = [];
  let run = '';
  for (const t of raw) {
    if (t.length === 1) {
      run += t;
      continue;
    }
    if (run) {
      tokens.push(run.length > 1 ? collapseRepeats(run) : run);
      run = '';
    }
    tokens.push(t);
  }
  if (run) tokens.push(run.length > 1 ? collapseRepeats(run) : run);
  return tokens;
}

const LIST = BLOCKLIST.map(([w, mode]) => [collapseRepeats(w), mode] as const);

/** Kembalikan kata terlarang pertama yang ditemukan, atau null. */
export function findProfanity(text: string): string | null {
  const tokens = normalizeTokens(text);
  for (const token of tokens) {
    for (const [word, mode] of LIST) {
      if (mode === 'word' ? token === word : token.includes(word)) return word;
    }
  }
  return null;
}
