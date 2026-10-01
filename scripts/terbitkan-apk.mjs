#!/usr/bin/env node
/**
 * scripts/terbitkan-apk.mjs - terbitkan APK rilis dari CI ke Admin Panel.
 *
 * Padanan otomatis dari Admin Panel -> Aplikasi Android (app/api/android),
 * dengan aturan yang SAMA persis: bucket privat "aplikasi-android", path
 * rilis/<kode>-<12 hex>.apk, satu baris rilis_android, kode versi wajib naik,
 * dan hanya 2 berkas terbaru yang disimpan (baris lama tetap sebagai riwayat).
 *
 * Idempoten: kalau versionCode di android/version.properties tidak lebih besar
 * dari rilis terakhir, skrip berhenti dengan sukses tanpa menerbitkan apa pun.
 * Jadi push ke main yang tidak menaikkan versi tidak pernah menimpa rilis.
 *
 * Tanpa dependensi npm - hanya fetch bawaan Node 20.
 *
 *   SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... \
 *   node scripts/terbitkan-apk.mjs <berkas.apk> [catatan]
 */
import { readFileSync, statSync } from 'node:fs';
import { randomBytes } from 'node:crypto';

const BUCKET = 'aplikasi-android';
const SIMPAN_BERKAS = 2;
const POLA_VERSI = /^[0-9A-Za-z.\-]{1,32}$/;

const [berkas, catatanArg = ''] = process.argv.slice(2);
const URL_DB = (process.env.SUPABASE_URL ?? '').replace(/\/$/, '');
const KUNCI = process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';
if (!berkas || !URL_DB || !KUNCI) {
  console.error('Pakai: SUPABASE_URL=.. SUPABASE_SERVICE_ROLE_KEY=.. node scripts/terbitkan-apk.mjs <apk> [catatan]');
  process.exit(1);
}

const prop = Object.fromEntries(
  readFileSync(new URL('../android/version.properties', import.meta.url), 'utf8')
    .split(/\r?\n/).filter(l => l && !l.startsWith('#') && l.includes('='))
    .map(l => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; }),
);
const versi = String(prop.versionName ?? '').replace(/^v/i, '');
const kode = Number(prop.versionCode);
if (!POLA_VERSI.test(versi) || !Number.isInteger(kode) || kode < 1) {
  console.error(`version.properties tidak sah: versionName=${prop.versionName} versionCode=${prop.versionCode}`);
  process.exit(1);
}

const kepala = { apikey: KUNCI, Authorization: `Bearer ${KUNCI}` };
async function rest(jalur, init = {}) {
  const r = await fetch(`${URL_DB}${jalur}`, { ...init, headers: { ...kepala, ...(init.headers ?? {}) } });
  const teks = await r.text();
  if (!r.ok) throw new Error(`${init.method ?? 'GET'} ${jalur.split('?')[0]} -> ${r.status} ${teks.slice(0, 300)}`);
  return teks ? JSON.parse(teks) : null;
}

const [puncak] = await rest('/rest/v1/rilis_android?select=kode_versi&order=kode_versi.desc&limit=1');
if (puncak && kode <= puncak.kode_versi) {
  console.log(`Tidak diterbitkan: versionCode ${kode} tidak lebih besar dari rilis terakhir (${puncak.kode_versi}).`);
  console.log('Naikkan versionCode & versionName di android/version.properties untuk merilis APK baru.');
  process.exit(0);
}

const ukuran = statSync(berkas).size;
const path = `rilis/${kode}-${randomBytes(6).toString('hex')}.apk`;
await rest(`/storage/v1/object/${BUCKET}/${path}`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/vnd.android.package-archive', 'x-upsert': 'false' },
  body: readFileSync(berkas),
});

const catatan = catatanArg.trim().slice(0, 2000) || null;
try {
  await rest('/rest/v1/rilis_android', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Prefer: 'return=minimal' },
    body: JSON.stringify({ versi, kode_versi: kode, ukuran, path, catatan, wajib: false }),
  });
} catch (e) {
  // Baris gagal dicatat -> jangan tinggalkan berkas yatim di Storage.
  await rest(`/storage/v1/object/${BUCKET}`, {
    method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ prefixes: [path] }),
  }).catch(() => {});
  throw e;
}

// Sisakan SIMPAN_BERKAS berkas terbaru; baris lama tetap (riwayat & catatan).
const lama = await rest(`/rest/v1/rilis_android?select=id,path&path=not.is.null&order=kode_versi.desc&offset=${SIMPAN_BERKAS}&limit=50`);
if (lama.length) {
  await rest(`/storage/v1/object/${BUCKET}`, {
    method: 'DELETE', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ prefixes: lama.map(l => l.path) }),
  });
  await rest(`/rest/v1/rilis_android?id=in.(${lama.map(l => l.id).join(',')})`, {
    method: 'PATCH', headers: { 'Content-Type': 'application/json', Prefer: 'return=minimal' },
    body: JSON.stringify({ path: null }),
  });
}

console.log(`Diterbitkan: v${versi} (kode ${kode}), ${(ukuran / 1048576).toFixed(1)} MB -> ${path}`);
