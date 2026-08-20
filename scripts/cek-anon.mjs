/**
 * scripts/cek-anon.mjs - membuktikan apa yang benar-benar bisa diambil orang
 * dengan anon key, tanpa lewat aplikasi.
 *
 * sql/cek-jangkauan-anon.sql menjawab pertanyaan yang sama dari sisi basis
 * data. Berkas ini menjawabnya dari sisi jaringan: ia memanggil PostgREST
 * persis seperti orang luar akan memanggilnya, memakai anon key yang memang
 * sudah ikut terkirim ke setiap browser. Keduanya saling memeriksa - kalau SQL
 * bilang "tertutup" tapi skrip ini berhasil menarik baris, yang benar adalah
 * skrip ini.
 *
 * Pakai:
 *   NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co \
 *   NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ... \
 *   node scripts/cek-anon.mjs
 *
 * Bisa juga membaca .env.local sendiri bila dijalankan dari akar proyek.
 *
 * HANYA MEMBACA. Tidak ada satu pun permintaan yang menulis.
 */
import { readFileSync } from 'node:fs';

function bacaEnvLokal() {
  try {
    const isi = readFileSync('.env.local', 'utf8');
    for (const baris of isi.split('\n')) {
      const m = baris.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
      if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
    }
  } catch {
    // tidak ada .env.local - andalkan environment
  }
}
bacaEnvLokal();

const URL_DB = process.env.NEXT_PUBLIC_SUPABASE_URL;
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
if (!URL_DB || !ANON) {
  console.error('NEXT_PUBLIC_SUPABASE_URL dan NEXT_PUBLIC_SUPABASE_ANON_KEY wajib diisi.');
  process.exit(1);
}

/**
 * Tabel yang dipakai platform. Yang bertanda rahasia:true tidak pernah
 * disentuh dari browser sama sekali - seluruh pemakaiannya lewat route server
 * dengan service-role key. Kalau salah satunya menjawab 200, anon key yang
 * beredar di browser bisa membacanya juga.
 */
const TABEL = [
  { nama: 'user_credentials',    rahasia: true },
  { nama: 'user_sessions',       rahasia: true },
  { nama: 'login_attempts',      rahasia: true },
  { nama: 'password_reset_otps', rahasia: true },
  { nama: 'users' },
  { nama: 'app_settings' },
  { nama: 'audit_trail' },
  { nama: 'tickets' },
  { nama: 'reminders' },
  { nama: 'project_requests' },
  { nama: 'daily_reports' },
  { nama: 'incentive_splits' },
  { nama: 'incentive_projects' },
  { nama: 'incentive_tranches' },
  { nama: 'progress_projects' },
  { nama: 'progress_locations' },
  { nama: 'notifications' },
  { nama: 'kpi_global_settings' },
  { nama: 'form_reviews' },
  { nama: 'movement_logs' },
  { nama: 'tech_notes' },
  { nama: 'piket_schedules' },
  { nama: 'lc_quiz_attempts' },
  { nama: 'division_ivp_mappings' },
];

async function coba(tabel) {
  try {
    const res = await fetch(`${URL_DB}/rest/v1/${tabel}?select=*&limit=1`, {
      headers: { apikey: ANON, Authorization: `Bearer ${ANON}` },
    });
    if (res.status !== 200) return { status: res.status, baris: 0 };
    const data = await res.json().catch(() => []);
    return { status: 200, baris: Array.isArray(data) ? data.length : 0 };
  } catch (e) {
    return { status: 0, galat: e?.message ?? 'gagal menghubungi' };
  }
}

async function jumlah(tabel) {
  try {
    const res = await fetch(`${URL_DB}/rest/v1/${tabel}?select=*&limit=1`, {
      headers: {
        apikey: ANON,
        Authorization: `Bearer ${ANON}`,
        Prefer: 'count=exact',
        Range: '0-0',
      },
    });
    const cr = res.headers.get('content-range');
    return cr ? cr.split('/')[1] : '?';
  } catch {
    return '?';
  }
}

console.log(`Basis data : ${URL_DB}`);
console.log('Memanggil PostgREST langsung dengan anon key, tanpa lewat aplikasi.\n');

let bocorRahasia = 0;
let terbaca = 0;
let gagalJaringan = 0;

for (const t of TABEL) {
  const r = await coba(t.nama);
  if (r.status === 200) {
    const n = await jumlah(t.nama);
    terbaca++;
    const tanda = t.rahasia ? 'BOCOR  ' : 'terbaca';
    if (t.rahasia) bocorRahasia++;
    console.log(`${tanda}  ${t.nama.padEnd(24)} ${String(n).padStart(7)} baris terbaca anon`);
  } else if (r.status === 401 || r.status === 403) {
    console.log(`tertutup ${t.nama.padEnd(24)} ${r.status}`);
  } else if (r.status === 404) {
    console.log(`tak ada  ${t.nama.padEnd(24)} 404`);
  } else if (r.status === 0) {
    console.log(`gagal    ${t.nama.padEnd(24)} ${r.galat}`);
    gagalJaringan++;
  } else {
    console.log(`?        ${t.nama.padEnd(24)} ${r.status}`);
  }
}

if (gagalJaringan === TABEL.length) {
  console.log('\nTidak satu pun permintaan sampai ke basis data. Periksa nilai');
  console.log('NEXT_PUBLIC_SUPABASE_URL - hasil di atas tidak berarti apa-apa.');
  process.exit(1);
}

console.log(`\n${terbaca} dari ${TABEL.length} tabel terbaca dengan anon key.`);
if (bocorRahasia > 0) {
  console.log(
    `\n${bocorRahasia} tabel rahasia masih terbuka. Pasang SUPABASE_SERVICE_ROLE_KEY di\n` +
    'Vercel, deploy ulang, uji login, lalu jalankan sql/lock-credentials-rls.sql.',
  );
} else {
  console.log('\nTidak ada tabel kredensial/sesi yang terbaca anon.');
}
