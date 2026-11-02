/**
 * uji/services-putus.ts - basis data Services yang tidak terjangkau tidak boleh menahan Ticketing.
 *
 * Bug: daftar ticket menunggu log dari basis Services. Saat domain Services mati, postgrest-js
 * mengulang tiap GET (jeda 1s, 2s, 4s) sehingga halaman tertahan "Loading..." belasan detik di
 * setiap muat & polling. Pemutus di lib/supabase.ts (fetchServices) menolak kegagalan tanpa
 * pengulangan, lalu menolak langsung selama jedanya, dan mencoba lagi sesudahnya.
 *
 * Jalankan: npx tsx uji/services-putus.ts
 */
let lulus = 0, gagal = 0;
function cek(nama: string, syarat: boolean) {
  if (syarat) { lulus++; console.log(`  ok   ${nama}`); } else { gagal++; console.log(`  GAGAL ${nama}`); }
}

process.env.NEXT_PUBLIC_SUPABASE_URL ??= 'https://x.supabase.co';
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??= 'dummy';
process.env.NEXT_PUBLIC_SUPABASE_SERVICES_URL ??= 'https://y.supabase.co';
process.env.NEXT_PUBLIC_SUPABASE_SERVICES_ANON_KEY ??= 'dummy';

//  fetch tiruan: perilakunya diganti per langkah, jumlah panggilannya dihitung.
let panggil = 0;
let perilaku: (init?: RequestInit) => Promise<Response> = async () => { throw new TypeError('fetch failed'); };
globalThis.fetch = (async (_input: unknown, init?: RequestInit) => { panggil++; return perilaku(init); }) as typeof fetch;

const jamAsli = Date.now;

(async () => {
  const { supabaseServices } = await import('../lib/supabase');
  const ambil = () => supabaseServices.from('activity_logs').select('id').in('ticket_id', ['a']);

  console.log('\n1. Domain mati: gagal sekali, tanpa pengulangan');
  let mulai = jamAsli();
  let r = await ambil();
  cek('mengembalikan error, tidak melempar', !!r.error && r.data === null);
  cek('fetch hanya dipanggil 1x (postgrest tidak mengulang)', panggil === 1);
  cek('selesai < 900 ms (tanpa jeda retry 1s)', jamAsli() - mulai < 900);

  console.log('\n2. Selama jeda: langsung ditolak tanpa menyentuh jaringan');
  mulai = jamAsli();
  r = await ambil();
  cek('error menyebut Services tidak terjangkau', (r.error?.message ?? '').includes('tidak terjangkau'));
  cek('fetch tidak dipanggil lagi', panggil === 1);
  cek('instan (< 100 ms)', jamAsli() - mulai < 100);

  console.log('\n3. Sesudah jeda: mencoba lagi, dan pulih bila Services kembali');
  Date.now = () => jamAsli() + 61_000;
  perilaku = async () => new Response('[{"id":1}]', { status: 200, headers: { 'content-type': 'application/json' } });
  r = await ambil();
  cek('fetch dipanggil lagi', panggil === 2);
  cek('data kembali normal', !r.error && Array.isArray(r.data) && r.data.length === 1);
  r = await ambil();
  cek('permintaan berikutnya juga lewat', panggil === 3 && !r.error);

  console.log('\n4. Dibatalkan pemanggil sendiri: bukan tanda Services putus');
  perilaku = async () => { const e = new Error('dibatalkan'); e.name = 'AbortError'; throw e; };
  const ac = new AbortController(); ac.abort();
  await supabaseServices.from('activity_logs').select('id').abortSignal(ac.signal);
  perilaku = async () => new Response('[]', { status: 200, headers: { 'content-type': 'application/json' } });
  const sebelum = panggil;
  r = await ambil();
  cek('permintaan sesudahnya tetap sampai ke jaringan', panggil === sebelum + 1 && !r.error);

  Date.now = jamAsli;
  console.log(`\n${lulus} lulus, ${gagal} gagal`);
  if (gagal) process.exit(1);
})();
