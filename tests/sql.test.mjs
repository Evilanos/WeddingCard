// Uji migrasi + seed di PGlite (Postgres in-process, tanpa Docker).
// Skema auth/realtime & role Supabase di-stub seperlunya.
// Jalankan dari root repo: npm run test:sql
import { readFileSync } from 'node:fs';

const root = process.cwd();
const { PGlite } = await import('@electric-sql/pglite');
const db = new PGlite();

const stub = `
create role anon nologin; create role authenticated nologin; create role service_role nologin bypassrls;
create schema auth; create table auth.users (id uuid primary key);
create table auth.claims (uid uuid);
create function auth.uid() returns uuid language sql stable as $$ select uid from auth.claims limit 1 $$;
grant usage on schema auth to anon, authenticated, service_role;
grant select on auth.claims to anon, authenticated, service_role;
grant execute on function auth.uid() to anon, authenticated, service_role;
create schema realtime; create table realtime.sent (payload jsonb, event text, topic text, private boolean);
create function realtime.send(payload jsonb, event text, topic text, private boolean default true) returns void
  language sql as $$ insert into realtime.sent values (payload, event, topic, private) $$;
grant usage on schema public to anon, authenticated, service_role;
alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
`;
await db.exec(stub);
await db.exec(readFileSync(`${root}/supabase/migrations/20260917000000_init.sql`, 'utf8'));
await db.exec(`grant all on all tables in schema public to service_role;`);
await db.exec(readFileSync(`${root}/supabase/seed.sql`, 'utf8'));

let fails = 0;
const q = async (sql, params) => (await db.query(sql, params)).rows;
const ok = (cond, msg) => { console.log(cond ? 'PASS' : 'FAIL', msg); if (!cond) fails++; };
const asRole = async (role, fn) => { await db.exec(`set role ${role}`); try { return await fn(); } finally { await db.exec('reset role'); } };
const fails_with = async (fn, msg) => { try { await fn(); ok(false, msg); } catch (e) { ok(true, `${msg} (${e.message})`); } };

// slug
const dewi = (await q(`select slug from guests where nama='Dewi Lestari'`))[0].slug;
ok(/^dewi-lestari-[0-9a-f]{6}$/.test(dewi), `slug otomatis: ${dewi}`);
ok((await q(`select public.slugify('  Bpk. H. Ahmad   (Keluarga) ')`))[0].slugify === 'bpk-h-ahmad-keluarga', 'slugify');

// get_guest as anon
await asRole('anon', async () => {
  const g1 = (await q(`select get_guest('budi-santoso-a1b2c3') g`))[0].g;
  ok(g1.nama === 'Budi Santoso' && g1.akad?.tempat && g1.rsvp?.status === 'hadir', 'get_guest keduanya → akad + rsvp');
  const g2 = (await q(`select get_guest('SITI-RAHMA-d4e5f6') g`))[0].g;
  ok(g2.nama === 'Siti Rahma' && g2.akad === null, 'get_guest resepsi → tanpa akad, case-insensitive');
  ok((await q(`select get_guest('ngawur') g`))[0].g === null, 'get_guest slug salah → null');
  ok((await q(`select get_guest(null) g`))[0].g === null, 'get_guest null → null');
  await fails_with(() => q(`select * from guests`), 'anon tidak bisa SELECT guests');
  await fails_with(() => q(`select * from wishes`), 'anon tidak bisa SELECT wishes');
  await fails_with(() => q(`select * from event_private`), 'anon tidak bisa SELECT event_private');
  await fails_with(() => q(`select submit_entry('x','x','x',null,null,null)`), 'anon tidak bisa submit_entry langsung');
  await fails_with(() => q(`select hit_rate_limit('x',3,600)`), 'anon tidak bisa hit_rate_limit');
  const s = (await q(`select get_public_settings() s`))[0].s;
  ok(s.wishes_frozen === false && s.rsvp_deadline, 'get_public_settings');
  const page1 = await q(`select * from list_wishes(null, null, 2)`);
  ok(page1.length === 2 && page1[0].nama === 'Andi' && page1[0].rsvp_status === 'tidak' && page1[0].is_guest, 'list_wishes halaman 1 + badge');
  const last = page1[1];
  const page2 = await q(`select * from list_wishes($1, $2, 10)`, [last.created_at, last.id]);
  ok(page2.length === 2 && page2.every(w => w.nama !== 'Spammer') && !page2[0].is_guest, 'list_wishes cursor, hidden tidak tampil');
});
ok((await q(`select opened_at from guests where slug='budi-santoso-a1b2c3'`))[0].opened_at !== null, 'opened_at terisi');

// submit_entry as service_role
await asRole('service_role', async () => {
  const call = async (...a) => (await q(`select submit_entry($1,$2,$3,$4,$5,$6) r`, a))[0].r;
  let r = await call(null, 'Anon', 'Selamat ya', 'hadir', 2, 'h1');
  ok(r.ok && r.wish && !r.rsvp && r.wish.is_guest === false, 'tanpa slug: ucapan masuk, RSVP diabaikan');
  r = await call(null, 'Anon', '   ', 'hadir', 2, 'h1');
  ok(!r.ok && r.error === 'empty', 'tanpa slug & tanpa pesan → empty');
  r = await call('siti-rahma-d4e5f6', 'Siti', '', 'hadir', 3, 'h2');
  ok(!r.ok && r.error === 'invalid_pax', 'jumlah > max_pax ditolak');
  r = await call('siti-rahma-d4e5f6', 'Siti', '', 'hadir', 2, 'h2');
  ok(r.ok && r.rsvp.jumlah_orang === 2 && !r.wish, 'RSVP saja tanpa pesan');
  r = await call('siti-rahma-d4e5f6', 'Siti R', 'Doa terbaik', 'tidak', 2, 'h2');
  ok(r.ok && r.rsvp.jumlah_orang === 0 && r.wish.rsvp_status === 'tidak' && r.wish.is_guest, 'upsert RSVP + badge dari join');
  r = await call('siti-rahma-d4e5f6', 'x'.repeat(61), 'hai', null, null, 'h2');
  ok(!r.ok && r.error === 'invalid_name', 'nama terlalu panjang ditolak');
  r = await call(null, 'A', 'x'.repeat(501), null, null, 'h2');
  ok(!r.ok && r.error === 'message_too_long', 'pesan > 500 ditolak');
  const rsvpCount = (await q(`select count(*)::int c from rsvp r join guests g on g.id=r.guest_id where g.slug='siti-rahma-d4e5f6'`))[0].c;
  ok(rsvpCount === 1, 'RSVP satu baris per tamu');

  await q(`update settings set moderation_mode = true`);
  r = await call(null, 'Mod', 'Masuk moderasi', null, null, 'h3');
  ok(r.ok && r.hidden === true, 'moderation_mode → is_hidden');
  await q(`update settings set moderation_mode = false, wishes_frozen = true`);
  r = await call(null, 'Frz', 'Ditolak', null, null, 'h3');
  ok(!r.ok && r.error === 'wishes_frozen', 'wishes_frozen menolak ucapan');
  r = await call('budi-santoso-a1b2c3', 'Budi', '', 'ragu', 1, 'h3');
  ok(r.ok, 'wishes_frozen tetap izinkan RSVP');
  await q(`update settings set wishes_frozen = false, rsvp_deadline = now() - interval '1 minute'`);
  r = await call('budi-santoso-a1b2c3', 'Budi', '', 'hadir', 1, 'h3');
  ok(!r.ok && r.error === 'rsvp_closed', 'lewat deadline → rsvp_closed');

  const rl = [];
  for (let i = 0; i < 4; i++) rl.push((await q(`select hit_rate_limit('ipx', 3, 600) b`))[0].b);
  ok(JSON.stringify(rl) === '[true,true,true,false]', `rate limit 3/10 menit: ${rl}`);
  await q(`update rate_limits set window_start = now() - interval '11 minutes' where key='ipx'`);
  ok((await q(`select hit_rate_limit('ipx', 3, 600) b`))[0].b === true, 'rate limit reset setelah window');
});

// realtime broadcast
const sent = await q(`select * from realtime.sent`);
ok(sent.some(s => s.event === 'wish_new' && s.payload.nama === 'Siti R' && !('ip_hash' in s.payload) && s.private === false), 'broadcast wish_new tanpa ip_hash');
ok(!sent.some(s => s.payload.nama === 'Mod'), 'ucapan hidden tidak di-broadcast');
await q(`update wishes set is_hidden = true where nama = 'Siti R'`);
ok((await q(`select * from realtime.sent where event='wish_hidden'`)).length === 1, 'broadcast wish_hidden saat disembunyikan');

// admin RLS
const uid = '00000000-0000-0000-0000-000000000001';
const other = '00000000-0000-0000-0000-000000000002';
await q(`insert into auth.users values ($1), ($2)`, [uid, other]);
await q(`insert into admins values ($1)`, [uid]);
await q(`insert into auth.claims values ($1)`, [other]);
await asRole('authenticated', async () => {
  ok((await q(`select count(*)::int c from guests`))[0].c === 0, 'user non-admin melihat 0 tamu');
  ok((await q(`select is_admin() a`))[0].a === false, 'is_admin false untuk non-admin');
});
await q(`update auth.claims set uid = $1`, [uid]);
await asRole('authenticated', async () => {
  ok((await q(`select count(*)::int c from guests`))[0].c === 7, 'admin melihat semua tamu');
  await q(`insert into guests (nama, grup) values ('Import CSV', 'Tes')`);
  ok(/^import-csv-/.test((await q(`select slug from guests where nama='Import CSV'`))[0].slug), 'admin insert → slug otomatis');
  await q(`update guests set no_wa = null where no_wa is not null`);
  ok((await q(`select count(*)::int c from guests where no_wa is not null`))[0].c === 0, 'admin bisa hapus semua no_wa');
  await q(`update settings set moderation_mode = true`);
  ok((await q(`select * from event_private`)).length === 1, 'admin baca event_private');
  await fails_with(() => q(`insert into admins values ($1)`, [other]), 'admin tidak bisa menambah admin dari client');
  await fails_with(() => q(`select * from rate_limits`), 'authenticated tidak bisa baca rate_limits');
});

console.log(fails ? `\n${fails} FAIL` : '\nSEMUA PASS');
process.exit(fails ? 1 : 0);
