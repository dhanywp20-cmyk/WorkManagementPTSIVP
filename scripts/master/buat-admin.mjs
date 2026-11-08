import fs from 'node:fs';
import readline from 'node:readline/promises';
import bcrypt from 'bcryptjs';
import { createClient } from '@supabase/supabase-js';

for (const berkas of ['.env.local', '.env']) {
  if (!fs.existsSync(berkas)) continue;
  for (const baris of fs.readFileSync(berkas, 'utf8').split(/\r?\n/)) {
    const m = baris.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^['"]|['"]$/g, '');
  }
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL, kunci = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !kunci) {
  console.error('Isi NEXT_PUBLIC_SUPABASE_URL dan SUPABASE_SERVICE_ROLE_KEY di .env.local terlebih dahulu.');
  process.exit(1);
}

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
const tanya = async (t, awal = '') => (await rl.question(t)).trim() || awal;
const username = (process.env.WM_ADMIN_USERNAME || await tanya('Username admin [admin]: ', 'admin')).toLowerCase();
const nama = process.env.WM_ADMIN_NAMA || await tanya('Nama lengkap [Administrator]: ', 'Administrator');
const sandi = process.env.WM_ADMIN_SANDI || await tanya('Kata sandi (min. 10 karakter): ');
rl.close();
if (!/^[a-z0-9._-]{3,40}$/.test(username)) { console.error('Username hanya huruf kecil, angka, titik, garis bawah atau minus (3-40 karakter).'); process.exit(1); }
if (sandi.length < 10) { console.error('Kata sandi minimal 10 karakter.'); process.exit(1); }

const db = createClient(url, kunci, { auth: { persistSession: false } });
const { data: ada, error: galatCek } = await db.from('users').select('id').eq('username', username).maybeSingle();
if (galatCek) { console.error(`Tidak bisa membaca tabel users: ${galatCek.message}. Sudahkah skema dipasang?`); process.exit(1); }
if (ada) { console.error(`Username ${username} sudah ada.`); process.exit(1); }

const { data: user, error: galatUser } = await db.from('users')
  .insert({ username, full_name: nama, role: 'admin', access_level: 'full', allowed_menus: null })
  .select('id').single();
if (galatUser) { console.error(`Gagal membuat user: ${galatUser.message}`); process.exit(1); }

const { error: galatSandi } = await db.from('user_credentials')
  .insert({ user_id: user.id, password_hash: await bcrypt.hash(sandi, 12), algorithm: 'bcrypt' });
if (galatSandi) {
  await db.from('users').delete().eq('id', user.id);
  console.error(`Gagal menyimpan kata sandi: ${galatSandi.message}`);
  process.exit(1);
}
console.log(`Admin ${username} dibuat. Masuk lewat halaman /dashboard.`);
