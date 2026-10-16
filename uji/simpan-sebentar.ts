/**
 * uji/simpan-sebentar.ts - simpanan singkat di memori server (dipakai Kuis Live untuk 100+ HP).
 *
 *   npx tsx uji/simpan-sebentar.ts
 */
import { kosongkanSimpanan, simpanSebentar } from '../lib/simpan-sebentar';

let lulus = 0, gagal = 0;
const cek = (n: string, ok: boolean, c = '') => {
  if (ok) { lulus++; console.log(`  ok    ${n}`); }
  else { gagal++; console.log(`  GAGAL ${n}${c ? ' - ' + c : ''}`); }
};

async function main() {
  console.log('\n1. Permintaan bersamaan cukup satu pengambilan');
  {
    kosongkanSimpanan();
    let dipanggil = 0;
    const ambil = () => new Promise<number>(r => { dipanggil++; setTimeout(() => r(42), 20); });
    const hasil = await Promise.all(Array.from({ length: 100 }, () => simpanSebentar('papan', 1000, ambil, 1_000)));
    cek('100 permintaan bersamaan = 1 query', dipanggil === 1, String(dipanggil));
    cek('semua mendapat nilai yang sama', hasil.every(x => x === 42));
  }

  console.log('\n2. Kedaluwarsa');
  {
    kosongkanSimpanan();
    let dipanggil = 0;
    const ambil = async () => ++dipanggil;
    await simpanSebentar('k', 1000, ambil, 10_000);
    const masih = await simpanSebentar('k', 1000, ambil, 10_999);
    cek('sebelum batas masih nilai lama', masih === 1 && dipanggil === 1);
    const baru = await simpanSebentar('k', 1000, ambil, 11_000);
    cek('sesudah batas diambil ulang', baru === 2 && dipanggil === 2);
  }

  console.log('\n3. Gagal tidak ikut disimpan');
  {
    kosongkanSimpanan();
    let dipanggil = 0;
    const gagalSekali = async () => { dipanggil++; if (dipanggil === 1) throw new Error('putus'); return 'ok'; };
    const pertama = await simpanSebentar('g', 5000, gagalSekali, 1).catch(e => (e as Error).message);
    await new Promise(r => setTimeout(r, 0));
    const kedua = await simpanSebentar('g', 5000, gagalSekali, 2);
    cek('galat diteruskan ke pemanggil', pertama === 'putus');
    cek('pemanggil berikutnya mencoba lagi', kedua === 'ok' && dipanggil === 2);
  }

  console.log('\n4. Kunci berbeda tidak saling menimpa');
  {
    kosongkanSimpanan();
    const a = await simpanSebentar('soal:1', 1000, async () => 'A', 1);
    const b = await simpanSebentar('soal:2', 1000, async () => 'B', 1);
    cek('dua kunci, dua nilai', a === 'A' && b === 'B');
  }

  console.log(`\n${gagal === 0 ? 'SEMUA LULUS' : 'ADA YANG GAGAL'} - ${lulus} lulus, ${gagal} gagal\n`);
  process.exit(gagal === 0 ? 0 : 1);
}
void main();
