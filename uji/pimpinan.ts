/**
 * uji/pimpinan.ts - penanda akun pimpinan (lihat semua, hanya baca).
 *
 * Jalankan: npx tsx uji/pimpinan.ts
 */
import { isPimpinan, muatIdPimpinan } from '../lib/pimpinan';

let lulus = 0, gagal = 0;
function cek(nama: string, syarat: boolean) {
  if (syarat) { lulus++; console.log(`  ok   ${nama}`); } else { gagal++; console.log(`  GAGAL ${nama}`); }
}

console.log('\n1. isPimpinan: hanya nilai true yang sah');
cek('pimpinan true', isPimpinan({ role: 'guest', pimpinan: true }));
cek('bawaan (tanpa field) bukan pimpinan', !isPimpinan({ role: 'guest' }));
cek('false / null bukan pimpinan', !isPimpinan({ pimpinan: false }) && !isPimpinan({ pimpinan: null }));
cek('string "true" / angka 1 TIDAK dianggap hak', !isPimpinan({ pimpinan: 'true' }) && !isPimpinan({ pimpinan: 1 }));
cek('tanpa pengguna: bukan pimpinan', !isPimpinan(null) && !isPimpinan(undefined));

console.log('\n2. muatIdPimpinan: daftar id, toleran terhadap kolom yang belum ada');
const klien = (hasil: { data: unknown; error: unknown } | 'lempar') => ({
  from: (_t: string) => ({
    select: (_c: string) => ({
      eq: async (_k: string, _v: unknown) => { if (hasil === 'lempar') throw new Error('jaringan'); return hasil; },
    }),
  }),
});
(async () => {
  const ada = await muatIdPimpinan(klien({ data: [{ id: 'a' }, { id: 'b' }], error: null }));
  cek('mengumpulkan id pimpinan', ada.size === 2 && ada.has('a') && ada.has('b'));
  const kosong = await muatIdPimpinan(klien({ data: [], error: null }));
  cek('tanpa pimpinan: set kosong', kosong.size === 0);
  const tanpaKolom = await muatIdPimpinan(klien({ data: null, error: { message: 'column users.pimpinan does not exist' } }));
  cek('kolom belum ada (migrasi 034 belum jalan): kosong, tidak error', tanpaKolom.size === 0);
  const putus = await muatIdPimpinan(klien('lempar'));
  cek('jaringan putus: kosong, tidak error', putus.size === 0);

  console.log(`\n${lulus} lulus, ${gagal} gagal`);
  if (gagal) process.exit(1);
})();
