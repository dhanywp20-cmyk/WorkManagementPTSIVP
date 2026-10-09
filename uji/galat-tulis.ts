/**
 * uji/galat-tulis.ts - penjaga "gagal diam-diam": hanya PENULISAN tabel yang gagal yang diumumkan,
 * dan kegagalan yang sengaja ditangani pemanggilnya (kolom belum ada, data kembar) tidak.
 *
 * Jalankan: npx tsx uji/galat-tulis.ts
 */
import { tabelPenulisan, pesanGalatTulis, periksaJawabanTulis, NAMA_EVENT_GALAT_TULIS } from '../lib/galat-tulis';

let lulus = 0, gagal = 0;
function cek(nama: string, syarat: boolean) {
  if (syarat) { lulus++; console.log(`  ok   ${nama}`); } else { gagal++; console.log(`  GAGAL ${nama}`); }
}

const U = 'https://x.supabase.co/rest/v1';
(async () => {
  console.log('\nMana yang dijaga');
  cek('POST ke tabel -> nama tabelnya', tabelPenulisan('POST', `${U}/daily_reports?columns=a`) === 'daily_reports');
  cek('PATCH & DELETE ikut', tabelPenulisan('patch', `${U}/tickets?id=eq.1`) === 'tickets' && tabelPenulisan('DELETE', `${U}/tickets?id=eq.1`) === 'tickets');
  cek('GET (bacaan) tidak', tabelPenulisan('GET', `${U}/tickets`) === null && tabelPenulisan(undefined, `${U}/tickets`) === null);
  cek('RPC tidak (sebagian sengaja dicoba lalu jatuh ke cadangan)', tabelPenulisan('POST', `${U}/rpc/rekap_lc_tahunan`) === null);
  cek('storage / API sendiri tidak', tabelPenulisan('POST', 'https://x.supabase.co/storage/v1/object/a') === null && tabelPenulisan('POST', '/api/notifikasi') === null);

  console.log('\nPesan');
  cek('berhasil -> tidak ada pesan', pesanGalatTulis(201, null) === null);
  cek('kolom belum ada (PGRST204/42703) -> diam, pemanggil mencoba ulang', pesanGalatTulis(400, { code: 'PGRST204' }) === null && pesanGalatTulis(400, { code: '42703' }) === null);
  cek('data kembar (23505) -> diam, pemanggil memberi pesan sendiri', pesanGalatTulis(409, { code: '23505' }) === null);
  cek('RLS menolak (42501) -> pesan izin', (pesanGalatTulis(403, { code: '42501', message: 'new row violates row-level security' }) ?? '').includes('izin'));
  cek('401 -> pesan izin', (pesanGalatTulis(401, null) ?? '').includes('izin'));
  cek('isian wajib kosong (23502) -> pesan isian', (pesanGalatTulis(400, { code: '23502' }) ?? '').includes('Isian'));
  cek('500 -> pesan server', (pesanGalatTulis(503, null) ?? '').includes('Server'));
  cek('lainnya membawa pesan aslinya', (pesanGalatTulis(400, { code: 'X', message: 'aneh' }) ?? '').endsWith('aneh'));

  console.log('\nPengumuman');
  const diterima: any[] = [];
  (globalThis as any).window = { dispatchEvent: (e: any) => { diterima.push(e); return true; } };
  (globalThis as any).CustomEvent = class { type: string; detail: unknown; constructor(t: string, o: any) { this.type = t; this.detail = o?.detail; } };
  await periksaJawabanTulis('POST', `${U}/daily_reports`, new Response(JSON.stringify({ code: '42501', message: 'rls' }), { status: 403 }));
  cek('penulisan ditolak -> satu event dengan nama tabel', diterima.length === 1 && diterima[0].type === NAMA_EVENT_GALAT_TULIS && diterima[0].detail.tabel === 'daily_reports');
  await periksaJawabanTulis('POST', `${U}/daily_reports`, new Response('[]', { status: 201 }));
  await periksaJawabanTulis('GET', `${U}/daily_reports`, new Response('{}', { status: 500 }));
  cek('berhasil / bacaan gagal -> tidak ada event baru', diterima.length === 1);
  await periksaJawabanTulis('PATCH', `${U}/tickets`, null);
  cek('putus jaringan saat menulis -> event koneksi', diterima.length === 2 && diterima[1].detail.pesan.includes('Koneksi'));
  await periksaJawabanTulis('POST', `${U}/x`, new Response('bukan json', { status: 400 }));
  cek('isi bukan JSON tidak melempar, tetap diumumkan', diterima.length === 3);

  console.log(`\n${lulus} lulus, ${gagal} gagal`);
  if (gagal) process.exit(1);
})();
