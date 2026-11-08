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
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: true });
  process.stdout.write(teks);
  if (rahasia) rl._writeToOutput = () => {};
  rl.question('', j => { rl.close(); if (rahasia) process.stdout.write('\n'); selesai(j.trim()); });
});

const jalankan = (perintah, argumen, opsi = {}) => execFileSync(perintah, argumen, { encoding: 'utf8', maxBuffer: 1 << 30, ...opsi });
const kepala = judul => `-- ${judul}\n-- Diekspor ${new Date().toISOString().slice(0, 16)}Z dari basis data sumber. Jalankan berurutan: 00, 01, 02, 03, 04.\n\n`;
const kueri = n => path.join(akar, 'scripts/master/kueri', n);
const psql = (url, berkas) => jalankan(alat('psql'), [url, '-X', '-At', '-v', 'ON_ERROR_STOP=1', '-f', berkas]);

function eksporSkema(url, folder) {
  fs.mkdirSync(folder, { recursive: true });
  fs.writeFileSync(path.join(folder, '00-ekstensi.sql'), kepala('Ekstensi yang dipakai platform') + psql(url, kueri('00-ekstensi.sql')));
  const skema = jalankan(alat('pg_dump'), [url, '--schema-only', '--no-owner', '--no-privileges', '--schema=public']);
  fs.writeFileSync(path.join(folder, '01-skema-public.sql'), kepala('Skema public: tabel, fungsi, trigger, index, RLS') + skema);
  fs.writeFileSync(path.join(folder, '02-storage.sql'), kepala('Bucket & kebijakan Supabase Storage') + psql(url, kueri('02-storage.sql')));
  fs.writeFileSync(path.join(folder, '03-realtime.sql'), kepala('Tabel yang memakai Realtime') + psql(url, kueri('03-realtime.sql')));
  let cron;
  try { cron = psql(url, kueri('04-cron.sql')); } catch { cron = '-- pg_cron tidak aktif di basis data sumber.\n'; }
  fs.writeFileSync(path.join(folder, '04-cron.sql'), kepala('Jadwal pg_cron (cek & ganti placeholder sebelum dijalankan)') + cron);
}

function dumpData(url, berkas) {
  jalankan(alat('pg_dump'), [url, '--schema=public', '--no-owner', '--no-privileges', '-Fc', '-f', berkas]);
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

const refProject = url => (url.match(/postgres\.([a-z0-9]{20})[:@]/) || url.match(/db\.([a-z0-9]{20})\.supabase\.co/) || [])[1];

async function tarikStorage(url, folder) {
  const ref = refProject(url);
  if (!ref) { console.log('  Storage dilewati: ref project tidak terbaca dari connection string'); return; }
  const kunci = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
  const publik = new Set(jalankan(alat('psql'), [url, '-X', '-At', '-c', 'select id from storage.buckets where public']).split('\n').filter(Boolean));
  const daftar = jalankan(alat('psql'), [url, '-X', '-At', '-F', '\t', '-c',
    "select bucket_id, name from storage.objects where name not like '%.emptyFolderPlaceholder' order by 1, 2"]).split('\n').filter(Boolean).map(b => b.split('\t'));
  const catatan = ['bucket\tberkas\tstatus'];
  let ok = 0, lewat = 0, gagal = 0, bita = 0, i = 0;
  const unduh = async () => {
    while (i < daftar.length) {
      const [bucket, nama] = daftar[i++];
      const jalur = nama.split('/').map(encodeURIComponent).join('/');
      const pub = publik.has(bucket);
      if (!pub && !kunci) { lewat++; catatan.push(`${bucket}\t${nama}\tdilewati (bucket privat, isi SUPABASE_SERVICE_ROLE_KEY)`); continue; }
      const alamat = `https://${ref}.supabase.co/storage/v1/object/${pub ? 'public/' : ''}${bucket}/${jalur}`;
      try {
        const r = await fetch(alamat, { headers: !pub ? { Authorization: `Bearer ${kunci}`, apikey: kunci } : {} });
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        const isi = Buffer.from(await r.arrayBuffer());
        const tujuan = path.join(folder, bucket, ...nama.split('/'));
        fs.mkdirSync(path.dirname(tujuan), { recursive: true });
        fs.writeFileSync(tujuan, isi);
        ok++; bita += isi.length; catatan.push(`${bucket}\t${nama}\tok`);
      } catch (e) { gagal++; catatan.push(`${bucket}\t${nama}\tgagal ${e.message}`); }
      if ((ok + lewat + gagal) % 50 === 0) process.stdout.write(`  ${ok + lewat + gagal}/${daftar.length} berkas\r`);
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

const urlUtama = process.env.DB_URL || await tanya('Connection string Session pooler basis data UTAMA: ', true);
if (!/^postgres(ql)?:\/\//.test(urlUtama)) { console.error('Connection string harus diawali postgresql://'); process.exit(1); }
const urlServices = process.env.DB_URL_SERVICES ?? await tanya('Connection string basis data TEAM SERVICES (Enter = lewati): ', true);

fs.mkdirSync(keluar, { recursive: true });
const komit = jalankan('git', ['rev-parse', '--short', 'HEAD'], { cwd: akar }).trim();

console.log('\n1/3 Backup penuh basis data asli');
const tahap = path.join(keluar, `backup-asli-${tgl}`);
fs.rmSync(tahap, { recursive: true, force: true });
fs.mkdirSync(tahap, { recursive: true });
dumpData(urlUtama, path.join(tahap, 'db-utama.dump'));
if (/^postgres(ql)?:\/\//.test(urlServices)) dumpData(urlServices, path.join(tahap, 'db-services.dump'));
eksporSkema(urlUtama, path.join(tahap, 'skema-utama'));
await tarikStorage(urlUtama, path.join(tahap, 'storage'));
jalankan('git', ['archive', '--format=zip', '-o', path.join(tahap, 'kode-sumber.zip'), 'HEAD'], { cwd: akar });
fs.writeFileSync(path.join(tahap, 'PULIHKAN.txt'), PULIHKAN);
const zipAsli = path.join(keluar, `wm-backup-asli-${tgl}.zip`);
kemas(tahap, zipAsli);

console.log('\n2/3 Ekspor skema untuk file master (tanpa data)');
const skemaMaster = path.join(keluar, `skema-${tgl}`);
fs.rmSync(skemaMaster, { recursive: true, force: true });
eksporSkema(urlUtama, skemaMaster);

console.log('\n3/3 File master untuk pelanggan');
jalankan(process.execPath, [path.join(akar, 'scripts/master/buat-master.mjs'), '--skema', skemaMaster, '--versi', tgl], { cwd: akar, stdio: 'inherit' });
fs.rmSync(skemaMaster, { recursive: true, force: true });

const ukuran = f => `${(fs.statSync(f).size / 1048576).toFixed(1)} MB`;
const zipMaster = path.join(keluar, `work-management-master-${tgl}.zip`);
console.log(`\nSelesai (komit ${komit}):`);
console.log(`  Backup asli pemilik : ${zipAsli} (${ukuran(zipAsli)})`);
if (fs.existsSync(zipMaster)) console.log(`  File master pelanggan: ${zipMaster} (${ukuran(zipMaster)})`);
