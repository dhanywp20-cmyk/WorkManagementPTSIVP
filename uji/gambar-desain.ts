/**
 * uji/gambar-desain.ts - gambar Desain 3D disimpan SEKALI per isi (lib/gambar-desain-server.ts, migrasi 044):
 * gambar kembar = satu baris, data desain hanya membawa ref:<hash>, ref yang hilang ditolak, kuota total dijaga.
 * Basis data diganti tiruan di memori (tanpa jaringan).
 *
 * Jalankan: npm test -- gambar-desain
 */
import { hashGambar, MAKS_TOTAL_GAMBAR_DESAIN, rujukGambarDesain } from '../lib/gambar-desain-server';
import { periksaDesain, POLA_REF_GAMBAR } from '../lib/tools-team';

let lulus = 0, gagal = 0;
function cek(nama: string, syarat: boolean) {
  if (syarat) { lulus++; console.log(`  ok   ${nama}`); } else { gagal++; console.log(`  GAGAL ${nama}`); }
}

/** Tiruan tabel tools_gambar_desain: select(..).in(..), select('ukuran'), upsert(..). */
function dbTiruan(awal: { hash: string; ukuran: number }[] = []) {
  const baris = [...awal];
  const disisip: { hash: string; data: string }[] = [];
  const db = {
    from: () => ({
      select: (kolom: string) => {
        const semua = Promise.resolve({ data: kolom === 'ukuran' ? baris.map(b => ({ ukuran: b.ukuran })) : baris.map(b => ({ hash: b.hash })), error: null });
        return Object.assign(semua, {
          in: (_k: string, daftar: string[]) => Promise.resolve({ data: baris.filter(b => daftar.includes(b.hash)).map(b => ({ hash: b.hash })), error: null }),
        });
      },
      upsert: (isi: { hash: string; data: string; ukuran: number }[]) => {
        for (const r of isi) if (!baris.some(b => b.hash === r.hash)) { baris.push({ hash: r.hash, ukuran: r.ukuran }); disisip.push(r); }
        return Promise.resolve({ error: null });
      },
    }),
  };
  return { db: db as unknown as Parameters<typeof rujukGambarDesain>[0], baris, disisip };
}

const A = 'data:image/jpeg;base64,' + 'A'.repeat(900);
const B = 'data:image/jpeg;base64,' + 'B'.repeat(900);

async function jalan() {
  console.log('\n1. Simpan pertama');
  const t = dbTiruan();
  const r = await rujukGambarDesain(t.db, { ruang: {}, benda: [], layar: { v1: A, v2: A }, tekstur: { 'tx-lantai01': A, 'tx-dinding1': B } }, 'u1');
  cek('berhasil', r.ok);
  cek('4 gambar, 2 isi berbeda -> hanya 2 baris tersimpan', t.disisip.length === 2);
  cek('semua nilai di data desain menjadi ref:<hash>', r.ok && [...Object.values(r.data.layar!), ...Object.values(r.data.tekstur!)].every(v => POLA_REF_GAMBAR.test(v)));
  cek('gambar sama -> ref sama', r.ok && r.data.layar!.v1 === r.data.tekstur!['tx-lantai01'] && r.data.layar!.v1 === `ref:${hashGambar(A)}`);

  console.log('\n2. Simpan ulang (versi baru) & desain lain');
  const r2 = await rujukGambarDesain(t.db, { ruang: {}, benda: [], tekstur: { 'tx-lantai01': `ref:${hashGambar(A)}` } }, 'u2');
  cek('ref yang sudah ada diterima tanpa menyimpan ulang', r2.ok && t.disisip.length === 2);
  const r3 = await rujukGambarDesain(t.db, { ruang: {}, benda: [], layar: { x: B } }, 'u3');
  cek('gambar yang sama dari desain lain tidak tersalin lagi', r3.ok && t.disisip.length === 2);
  const r4 = await rujukGambarDesain(t.db, { ruang: {}, benda: [], tekstur: { 'tx-lantai01': `ref:${'f'.repeat(40)}` } }, 'u1');
  cek('ref yang tidak ada di server ditolak', !r4.ok);
  const kosong = await rujukGambarDesain(t.db, { ruang: {}, benda: [] }, 'u1');
  cek('desain tanpa gambar tidak menyentuh tabel', kosong.ok);

  console.log('\n3. Kuota total');
  const penuh = dbTiruan([{ hash: 'a'.repeat(40), ukuran: MAKS_TOTAL_GAMBAR_DESAIN - 100 }]);
  cek('gambar baru ditolak saat ruang gambar tim penuh', !(await rujukGambarDesain(penuh.db, { ruang: {}, benda: [], layar: { v: A } }, 'u1')).ok);
  cek('...tapi ref lama tetap boleh dipakai', (await rujukGambarDesain(penuh.db, { ruang: {}, benda: [], layar: { v: `ref:${'a'.repeat(40)}` } }, 'u1')).ok);

  console.log('\n4. Validasi desain menerima ref');
  const benda = [{ id: 'v1', jenis: 'tv' }];
  cek('layar & tekstur berupa ref diterima', periksaDesain({ ruang: { p: 8 }, benda, layar: { v1: `ref:${hashGambar(A)}` }, tekstur: { 'tx-lantai01': `ref:${hashGambar(B)}` } }).ok);
  cek('ref cacat ditolak', !periksaDesain({ ruang: { p: 8 }, benda, layar: { v1: 'ref:../../x' } }).ok);

  console.log(`\n${lulus} lulus, ${gagal} gagal`);
  process.exit(gagal ? 1 : 0);
}
jalan();
