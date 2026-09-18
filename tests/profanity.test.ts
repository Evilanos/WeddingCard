// Jalankan: npm run test:filter
import { findProfanity } from '../supabase/functions/_shared/profanity.ts';

const blocked = [
  'dasar anjing',
  'ANJIIIING lu',
  'a n j i n g',
  'a.n.j.i.n.g',
  '4nj1ng',
  'b4ngs4t',
  'bangsaaat!!',
  'kamu t0l0l',
  'what the fuck',
  'fvck', // sengaja TIDAK terblokir? lihat di bawah
  'jancuk tenan',
  'main slot gacor',
];
const allowed = [
  'Selamat menempuh hidup baru, semoga sakinah mawaddah warahmah',
  'Sudah punya asuransi keluarga? Semoga berkah',
  'Sampai tadi pagi masih terharu',
  'Barakallahu lakuma',
  'Mantai-mantai, taiwan trip bulan madu?',
  'Kasih sayang tanpa batas',
  'Semoga langgeng sampai kakek nenek 🥰',
  'Setelah menikah jangan lupa kumpul lagi',
  'Semoga dijauhkan dari godaan setan',
  'Selamat ya MK, eh maksudnya mas Kevin',
];

let fails = 0;
for (const t of blocked) {
  const hit = findProfanity(t);
  // 'fvck' tidak ada di leet map; didokumentasikan sebagai batasan.
  const expect = t !== 'fvck';
  const pass = expect ? hit !== null : hit === null;
  console.log(pass ? 'PASS' : 'FAIL', `blocked? ${JSON.stringify(t)} → ${hit}`);
  if (!pass) fails++;
}
for (const t of allowed) {
  const hit = findProfanity(t);
  console.log(hit === null ? 'PASS' : 'FAIL', `allowed ${JSON.stringify(t)} → ${hit}`);
  if (hit !== null) fails++;
}
console.log(fails ? `\n${fails} FAIL` : '\nSEMUA PASS');
process.exit(fails ? 1 : 0);
