/**
 * uji/supabase-realtime.mjs - token login tetap terpasang di soket Realtime.
 *
 * Sejak supabase-js 2.117, Realtime meminta token ulang dari opsi `accessToken` di SETIAP heartbeat
 * (~25 dtk). Tanpa opsi itu ia jatuh ke anon key dan menimpa token login yang dipasang setDbToken(),
 * sehingga RLS menolak semua perubahan dan halaman berhenti menyegarkan diri - tanpa galat apa pun.
 * Uji ini memakai soket tiruan (tanpa jaringan) dan heartbeat dipercepat.
 *
 * Jalankan: npm test -- supabase-realtime
 */
import { readFileSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';

let lulus = 0, gagal = 0;
const cek = (nama, syarat) => { if (syarat) { lulus++; console.log(`  ok   ${nama}`); } else { gagal++; console.log(`  GAGAL ${nama}`); } };
const tidur = (ms) => new Promise(r => setTimeout(r, ms));
const T1 = 'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJ1MSJ9.satu';
const T2 = 'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJ1MSJ9.dua';

class SoketPalsu {
  constructor() { this.readyState = 0; setTimeout(() => { this.readyState = 1; this.onopen?.({}); }, 5); }
  send(data) {
    let m; try { m = JSON.parse(data); } catch { return; }
    const [joinRef, ref, topic, event] = Array.isArray(m) ? m : [m.join_ref, m.ref, m.topic, m.event];
    const balas = (payload) => setTimeout(() => this.onmessage?.({
      data: Array.isArray(m) ? JSON.stringify([joinRef, ref, topic, 'phx_reply', payload])
        : JSON.stringify({ join_ref: joinRef, ref, topic, event: 'phx_reply', payload }),
    }), 1);
    if (event === 'phx_join') balas({ status: 'ok', response: { postgres_changes: [] } });
    else if (event === 'heartbeat' || event === 'access_token') balas({ status: 'ok', response: {} });
  }
  close() { this.readyState = 3; this.onclose?.({ code: 1000 }); }
}

async function jalankan(denganAccessToken) {
  let token = T1;
  const opsi = { realtime: { transport: SoketPalsu, heartbeatIntervalMs: 30 } };
  if (denganAccessToken) opsi.accessToken = async () => token;
  else opsi.auth = { persistSession: false, autoRefreshToken: false };
  const klien = createClient('https://contoh.supabase.co', 'anon-key', opsi);
  await klien.realtime.setAuth(token);
  const ch = klien.channel('uji-rt').on('postgres_changes', { event: '*', schema: 'public', table: 'reminders' }, () => {}).subscribe();
  await tidur(250);
  const setelahHeartbeat = klien.realtime.accessTokenValue;
  //  Token diperbarui persis seperti setDbToken(): variabel berganti, lalu setAuth(token baru).
  token = T2;
  await klien.realtime.setAuth(T2);
  await tidur(100);
  const setelahGanti = klien.realtime.accessTokenValue;
  //  Sambungan putus lalu tersambung lagi (HP pindah jaringan / tab tidur).
  klien.realtime.disconnect();
  await tidur(30);
  klien.realtime.connect();
  await tidur(200);
  const setelahSambungUlang = klien.realtime.accessTokenValue;
  await klien.removeChannel(ch);
  klien.realtime.disconnect();
  return { setelahHeartbeat, setelahGanti, setelahSambungUlang };
}

console.log('\n1. Konfigurasi klien utama');
const src = readFileSync('lib/supabase.ts', 'utf8');
const blok = src.slice(src.indexOf('export const supabase = createClient('));
cek('lib/supabase.ts memasang opsi accessToken', /accessToken:\s*tokenAkses/.test(blok.slice(0, 300)));

console.log('\n2. Perilaku soket (soket tiruan, heartbeat 30 ms)');
const dengan = await jalankan(true);
cek('dengan accessToken: token login bertahan setelah heartbeat', dengan.setelahHeartbeat === T1);
cek('dengan accessToken: token baru dari setDbToken terpasang', dengan.setelahGanti === T2);
cek('dengan accessToken: setelah sambung ulang tetap token login terbaru', dengan.setelahSambungUlang === T2);
const tanpa = await jalankan(false);
cek('pembanding - tanpa accessToken token ditimpa anon key (alasan opsi ini wajib)',
  tanpa.setelahHeartbeat === 'anon-key' || tanpa.setelahSambungUlang === 'anon-key');

console.log(`\n${gagal ? 'GAGAL' : 'OK'}: ${lulus} lulus, ${gagal} gagal`);
process.exit(gagal ? 1 : 0);
