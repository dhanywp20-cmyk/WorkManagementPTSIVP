#!/usr/bin/env node
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import readline from 'node:readline';

const akar = execFileSync('git', ['rev-parse', '--show-toplevel'], { encoding: 'utf8' }).trim();
const win = process.platform === 'win32';
const binPg = process.env.PG_BIN || ['C:/Program Files/PostgreSQL/18/bin', 'C:/Program Files/PostgreSQL/17/bin'].find(d => fs.existsSync(d)) || '';
const alat = n => (binPg ? path.join(binPg, win ? `${n}.exe` : n) : n);
const tgl = new Date(Date.now() + 7 * 3600e3).toISOString().slice(0, 10).replace(/-/g, '');
const keluar = path.join(akar, 'hasil-master');

const tanya = (teks, rahasia) => new Promise(selesai => {
  const stdin = process.stdin;
  if (!rahasia || !stdin.isTTY) {
    const rl = readline.createInterface({ input: stdin, output: process.stdout });
    rl.question(teks, j => { rl.close(); selesai(j.trim()); });
    return;
  }
  process.stdout.write(teks);
  let isi = '';
  const baca = potong => {
    for (const c of potong) {
      if (c === '\r' || c === '\n') {
        stdin.off('data', baca); stdin.setRawMode(false); stdin.pause();
        process.stdout.write(`[${isi.length} karakter diterima]\n`);
        return selesai(isi);
      }
      if (c === '\u0003') { stdin.setRawMode(false); process.exit(130); }
      if (c === '\u007f' || c === '\b') isi = isi.slice(0, -1);
      else if (c >= ' ') isi += c;
    }
  };
  stdin.setRawMode(true); stdin.setEncoding('utf8'); stdin.resume(); stdin.on('data', baca);
});

function uraiKoneksi(teks) {
  const awal = teks.indexOf('postgres');
  if (awal < 0) return null;
  let s = teks.slice(awal).replace(/^postgres(ql)?:\/\//, '');
  const ulang = s.search(/postgres(ql)?:\/\//);
  if (ulang > 0) s = s.slice(0, ulang);
  s = s.trim();
  const at = s.lastIndexOf('@');
  if (at < 0) return null;
  const info = s.slice(0, at);
  const m = s.slice(at + 1).match(/^([^:/?]+)(?::(\d+))?\/([^?\s]+)/);
  if (!m) return null;
  const titik = info.indexOf(':');
  const user = titik < 0 ? info : info.slice(0, titik);
  let sandi = titik < 0 ? '' : info.slice(titik + 1);
  if (/^\[.*\]$/.test(sandi)) sandi = '';
  try { sandi = decodeURIComponent(sandi); } catch {}
  return { user, sandi, host: m[1], port: m[2] || '5432', db: m[3] };
}

async function mintaKoneksi(judul, wajib) {
  const teks = await tanya(`Tempel connection string ${judul} dari Supabase (boleh masih berisi [YOUR-PASSWORD])${wajib ? '' : ', Enter = lewati'}: `);
  if (!teks && !wajib) return null;
  const k = uraiKoneksi(teks);
  if (!k) { console.error('Format tidak dikenali. Contoh: postgresql://postgres.<ref>:[YOUR-PASSWORD]@aws-1-ap-south-1.pooler.supabase.com:5432/postgres'); process.exit(1); }
  if (!k.sandi) k.sandi = await tanya(`Password database ${judul} (tidak tampil): `, true);
  if (!k.sandi) { console.error('Password kosong.'); process.exit(1); }
  const ref = (k.user.match(/^postgres\.([a-z0-9]{20})$/) || k.host.match(/^db\.([a-z0-9]{20})\.supabase\.co$/) || [])[1];
  console.log(`  -> ${k.user} @ ${k.host}:${k.port}/${k.db}`);
  return { ref, env: { ...process.env, PGHOST: k.host, PGPORT: k.port, PGUSER: k.user, PGPASSWORD: k.sandi, PGDATABASE: k.db, PGSSLMODE: 'require' } };
}

const jalankan = (perintah, argumen, opsi = {}) => execFileSync(perintah, argumen, { encoding: 'utf8', maxBuffer: 1 << 30, stdio: ['ignore', 'pipe', 'pipe'], ...opsi });
const pg = (k, alatPg, argumen) => jalankan(alat(alatPg), argumen, { env: k.env });
const kepala = judul => `-- ${judul}\n-- Diekspor ${new Date().toISOString().slice(0, 16)}Z dari basis data sumber. Jalankan berurutan: 00, 01, 02, 03, 04.\n\n`;
const kueri = n => path.join(akar, 'scripts/master/kueri', n);
const psql = (k, berkas) => pg(k, 'psql', ['-X', '-At', '-v', 'ON_ERROR_STOP=1', '-f', berkas]);

function eksporSkema(k, folder) {
  fs.mkdirSync(folder, { recursive: true });
  fs.writeFileSync(path.join(folder, '00-ekstensi.sql'), kepala('Ekstensi yang dipakai platform') + psql(k, kueri('00-ekstensi.sql')));
  const skema = pg(k, 'pg_dump', ['--schema-only', '--no-owner', '--no-privileges', '--schema=public']);
  fs.writeFileSync(path.join(folder, '01-skema-public.sql'), kepala('Skema public: tabel, fungsi, trigger, index, RLS') + skema);
  fs.writeFileSync(path.join(folder, '02-storage.sql'), kepala('Bucket & kebijakan Supabase Storage') + psql(k, kueri('02-storage.sql')));
  fs.writeFileSync(path.join(folder, '03-realtime.sql'), kepala('Tabel yang memakai Realtime') + psql(k, kueri('03-realtime.sql')));
  let cron;
  try { cron = psql(k, kueri('04-cron.sql')); } catch { cron = '-- pg_cron tidak aktif di basis data sumber.\n'; }
  fs.writeFileSync(path.join(folder, '04-cron.sql'), kepala('Jadwal pg_cron (cek & ganti placeholder sebelum dijalankan)') + cron);
}

function dumpData(k, berkas) {
  pg(k, 'pg_dump', ['--schema=public', '--no-owner', '--no-privileges', '-Fc', '-f', berkas]);
  const isi = jalankan(alat('pg_restore'), ['--list', berkas]).split('\n').filter(b => / TABLE DATA public /.test(b)).length;
  console.log(`  ${path.basename(berkas)}: ${(fs.statSync(berkas).size / 1048576).toFixed(1)} MB, ${isi} tabel berisi data`);
}

function kemas(folder, zip) {
  fs.rmSync(zip, { force: true });
  const tarWin = 'C:/Windows/System32/tar.exe';
  if (win && fs.existsSync(tarWin)) jalankan(tarWin, ['-a', '-c', '-f', zip, '-C', folder, '.']);
  else if (win) jalankan('powershell', ['-NoProfile', '-Command', `Compress-Archive -Path '${folder}\\*' -DestinationPath '${zip}' -Force`]);
  else jalankan('zip', ['-qr', zip, '.'], { cwd: folder });
  fs.rmSync(folder, { recursive: true, force: true });
}

async function tarikStorage(k, folder) {
  if (!k.ref) { console.log('  Storage dilewati: ref project tidak terbaca dari connection string'); return; }
  const kunci = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
  const publik = new Set(pg(k, 'psql', ['-X', '-At', '-c', 'select id from storage.buckets where public']).split('\n').map(x => x.trim()).filter(Boolean));
  const daftar = pg(k, 'psql', ['-X', '-At', '-F', '\t', '-c',
    "select bucket_id, name from storage.objects where name not like '%.emptyFolderPlaceholder' order by 1, 2"]).split('\n').map(x => x.replace(/\r$/, '')).filter(Boolean).map(b => b.split('\t'));
  const catatan = ['bucket\tberkas\tstatus'];
  let ok = 0, lewat = 0, gagal = 0, bita = 0, i = 0;
  const unduh = async () => {
    while (i < daftar.length) {
      const [bucket, nama] = daftar[i++];
      const jalur = nama.split('/').map(encodeURIComponent).join('/');
      const pub = publik.has(bucket);
      if (!pub && !kunci) { lewat++; catatan.push(`${bucket}\t${nama}\tdilewati (bucket privat, isi SUPABASE_SERVICE_ROLE_KEY)`); continue; }
      const alamat = `https://${k.ref}.supabase.co/storage/v1/object/${pub ? 'public/' : ''}${bucket}/${jalur}`;
      try {
        const r = await fetch(alamat, { headers: !pub ? { Authorization: `Bearer ${kunci}`, apikey: kunci } : {} });
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        const isi = Buffer.from(await r.arrayBuffer());
        const tujuan = path.join(folder, bucket, ...nama.split('/'));
        fs.mkdirSync(path.dirname(tujuan), { recursive: true });
        fs.writeFileSync(tujuan, isi);
        ok++; bita += isi.length; catatan.push(`${bucket}\t${nama}\tok`);
      } catch (e) { gagal++; catatan.push(`${bucket}\t${nama}\tgagal ${e.message}`); }
      if ((ok + lewat + gagal) % 25 === 0) process.stdout.write(`  ${ok + lewat + gagal}/${daftar.length} berkas\r`);
    }
  };
  await Promise.all(Array.from({ length: 6 }, unduh));
  fs.mkdirSync(folder, { recursive: true });
  fs.writeFileSync(path.join(folder, 'daftar-berkas.tsv'), catatan.join('\n') + '\n');
  console.log(`  Storage: ${ok} berkas (${(bita / 1048576).toFixed(1)} MB) diunduh, ${lewat} dilewati, ${gagal} gagal - lihat storage/daftar-berkas.tsv`);
}

const PULIHKAN = `Backup penuh platform Work Management (server pemilik) - ${tgl}

Isi:
  db-utama.dump          skema public + SELURUH DATA basis data utama (format pg_dump custom)
  db-services.dump       basis data Team Services (bila ada)
  skema-utama/           SQL ekstensi, skema, storage, realtime, cron (asli, tanpa placeholder)
  storage/<bucket>/      semua foto & berkas Supabase Storage, susunan folder sama dengan bucket
  kode-sumber.zip        kode sumber lengkap + migration SQL (sql/, supabase/migrations/) pada komit saat backup

Memulihkan ke project Supabase baru yang kosong (PostgreSQL client 17+):
  1. psql "$DB_URL" -v ON_ERROR_STOP=1 -f skema-utama/00-ekstensi.sql
  2. pg_restore --no-owner --no-privileges -d "$DB_URL" db-utama.dump
  3. psql "$DB_URL" -f skema-utama/02-storage.sql -f skema-utama/03-realtime.sql -f skema-utama/04-cron.sql
  4. Storage: buat bucket lewat langkah 3, lalu unggah isi storage/<bucket>/ ke bucket yang sama
     (Supabase Dashboard -> Storage -> bucket -> Upload folder, atau rclone ke koneksi S3 Supabase).
  5. Deploy kode-sumber.zip, isi ulang environment variable (lihat .env.example).

File ini berisi data pribadi & hash password. Jangan diunggah tanpa enkripsi.
`;

try {
  const utama = await mintaKoneksi('basis data UTAMA', true);
  process.stdout.write('  Mengecek koneksi... ');
  pg(utama, 'psql', ['-X', '-At', '-c', 'select 1']);
  console.log('tersambung');
  const services = await mintaKoneksi('basis data TEAM SERVICES', false);

  fs.mkdirSync(keluar, { recursive: true });
  const komit = jalankan('git', ['rev-parse', '--short', 'HEAD'], { cwd: akar }).trim();

  console.log('\n1/3 Backup penuh server pemilik (data + foto + kode)');
  const tahap = path.join(keluar, `backup-asli-${tgl}`);
  fs.rmSync(tahap, { recursive: true, force: true });
  fs.mkdirSync(tahap, { recursive: true });
  dumpData(utama, path.join(tahap, 'db-utama.dump'));
  if (services) dumpData(services, path.join(tahap, 'db-services.dump'));
  eksporSkema(utama, path.join(tahap, 'skema-utama'));
  await tarikStorage(utama, path.join(tahap, 'storage'));
  jalankan('git', ['archive', '--format=zip', '-o', path.join(tahap, 'kode-sumber.zip'), 'HEAD'], { cwd: akar });
  fs.writeFileSync(path.join(tahap, 'PULIHKAN.txt'), PULIHKAN);
  const zipAsli = path.join(keluar, `wm-backup-asli-${tgl}.zip`);
  kemas(tahap, zipAsli);

  console.log('\n2/3 Ekspor struktur database untuk kloning (tanpa data)');
  const skemaMaster = path.join(keluar, `skema-${tgl}`);
  fs.rmSync(skemaMaster, { recursive: true, force: true });
  eksporSkema(utama, skemaMaster);

  console.log('\n3/3 File master kloning untuk pelanggan (+ data demo)');
  jalankan(process.execPath, [path.join(akar, 'scripts/master/buat-master.mjs'), '--skema', skemaMaster, '--versi', tgl], { cwd: akar, stdio: 'inherit' });
  fs.rmSync(skemaMaster, { recursive: true, force: true });

  const ukuran = f => `${(fs.statSync(f).size / 1048576).toFixed(1)} MB`;
  const zipMaster = path.join(keluar, `work-management-master-${tgl}.zip`);
  console.log(`\nSelesai (komit ${komit}):`);
  console.log(`  Backup server pemilik : ${zipAsli} (${ukuran(zipAsli)})`);
  if (fs.existsSync(zipMaster)) console.log(`  Kloning untuk pelanggan: ${zipMaster} (${ukuran(zipMaster)})`);
} catch (e) {
  const pesan = String(e.stderr || e.message || e).split('\n').filter(b => b.trim()).slice(0, 4).join('\n');
  console.error(`\nGAGAL: ${pesan}`);
  if (/password authentication failed|Authentication error/i.test(pesan)) console.error('Periksa password database (Supabase -> Project Settings -> Database -> Reset database password).');
  process.exit(1);
}
