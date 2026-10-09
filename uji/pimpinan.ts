/**
 * uji/pimpinan.ts - penanda akun pimpinan (lihat semua, hanya baca).
 *
 * Jalankan: npx tsx uji/pimpinan.ts
 */
import { isPimpinan, muatIdPimpinan } from '../lib/pimpinan';
import { canAccessAnalytics, canSeeTeamMonitoring, hasMenu } from '../app/(portal)/dashboard/_components/widgets/permissions';
import { akunAdmin, akunBacaSemua, akunLihatSemua } from '../lib/checklist-server';

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
console.log('\n3. Dashboard pimpinan = seperti TEAM (bukan ringkas Sales)');
const guest = { id: 'g', username: 'g', full_name: 'G', role: 'guest', allowed_menus: ['learning-center'] } as never;
const direktur = { id: 'd', username: 'd', full_name: 'D', role: 'guest', team_type: 'Marketing', jabatan: 'Direktur', pimpinan: true, allowed_menus: ['learning-center'] } as never;
cek('guest biasa: dashboard ringkas (tanpa analytics)', !canAccessAnalytics(guest) && !canSeeTeamMonitoring(guest));
cek('pimpinan: Analytics penuh seperti team', canAccessAnalytics(direktur));
cek('pimpinan: Team Monitoring seperti team', canSeeTeamMonitoring(direktur));
cek('pimpinan tetap tidak punya menu yang tidak dicentang', !hasMenu(direktur, 'incentive-pts') && hasMenu(direktur, 'learning-center'));

console.log('\n4. Project Progress (server): pimpinan membaca semua proyek, tanpa hak admin / fitur tim');
const akunPim = { id: 'd', nama: 'Jonny', role: 'guest', pimpinan: true };
const akunSales = { id: 's', nama: 'Sales', role: 'guest' };
cek('pimpinan: boleh membaca semua proyek', akunBacaSemua(akunPim));
cek('sales biasa: tidak membaca semua (hanya proyek atas namanya)', !akunBacaSemua(akunSales));
cek('team & admin tetap membaca semua', akunBacaSemua({ id: 't', nama: 'T', role: 'team' }) && akunBacaSemua({ id: 'a', nama: 'A', role: 'admin' }));
cek('pimpinan bukan admin (tidak bisa buat/ubah/hapus proyek)', !akunAdmin(akunPim));
cek('pimpinan tidak mendapat fitur tim (AI checklist)', !akunLihatSemua(akunPim));

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
