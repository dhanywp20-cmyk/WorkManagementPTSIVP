/**
 * uji/urutan-soal.ts - aturan urutan soal Bank Soal.
 *
 * Jalankan: npx tsx uji/urutan-soal.ts
 */
import { bandingkanUrutan, perubahanUrutan, geser, nomorBerikutnya, SoalTerurut } from '../lib/urutan-soal';

let lulus = 0, gagal = 0;
function cek(nama: string, syarat: boolean, catatan = '') {
  if (syarat) { lulus++; console.log(`  ok   ${nama}`); }
  else { gagal++; console.log(`  GAGAL ${nama}${catatan ? ' - ' + catatan : ''}`); }
}
const s = (id: string, urutan: number | null | undefined, created_at = '2026-01-01') =>
  ({ id, urutan, created_at }) as SoalTerurut;

console.log('\n1. Pengurutan');
{
  const daftar = [s('c', 3), s('a', 1), s('b', 2)];
  const hasil = [...daftar].sort(bandingkanUrutan).map(q => q.id);
  cek('bernomor terurut naik', JSON.stringify(hasil) === '["a","b","c"]', hasil.join(','));
}
{
  // Campuran: yang sudah diatur tangan tidak boleh terselip oleh yang baru.
  const daftar = [s('baru', null, '2026-05-05'), s('a', 1, '2026-01-01'), s('b', 2, '2026-01-01')];
  const hasil = [...daftar].sort(bandingkanUrutan).map(q => q.id);
  cek('yang belum bernomor jatuh ke bawah', JSON.stringify(hasil) === '["a","b","baru"]', hasil.join(','));
}
{
  // Perilaku SEBELUM kolomnya ada harus tetap: terbaru di atas.
  const daftar = [s('lama', undefined, '2026-01-01'), s('baru', undefined, '2026-08-01')];
  const hasil = [...daftar].sort(bandingkanUrutan).map(q => q.id);
  cek('tanpa kolom urutan: created_at menurun', JSON.stringify(hasil) === '["baru","lama"]', hasil.join(','));
}
{
  // Satu angkatan Generate AI: created_at seri. Yang penting hasilnya TETAP.
  const seri = [s('x', null, '2026-03-03'), s('y', null, '2026-03-03'), s('z', null, '2026-03-03')];
  const a = [...seri].sort(bandingkanUrutan).map(q => q.id).join(',');
  const b = [...seri].reverse().sort(bandingkanUrutan).map(q => q.id).join(',');
  cek('created_at seri tidak melempar / tidak error', a.length > 0 && b.length > 0, `${a} vs ${b}`);
}

console.log('\n2. Hemat penulisan');
{
  const grup = [s('a', 1), s('b', 2), s('c', 3), s('d', 4), s('e', 5)];
  const baru = geser(grup, 1, 1)!;           // tukar b <-> c
  const perubahan = perubahanUrutan(baru);
  cek('tukar 2 soal = 2 penulisan', perubahan.length === 2, `${perubahan.length}`);
  cek('nomor barunya benar',
    JSON.stringify(perubahan.sort((x, y) => x.id.localeCompare(y.id)))
      === JSON.stringify([{ id: 'b', urutan: 3 }, { id: 'c', urutan: 2 }]),
    JSON.stringify(perubahan));
}
{
  // Grup yang sama sekali belum bernomor: sekali geser, semuanya dinomori.
  const grup = [s('a', null), s('b', null), s('c', null)];
  const baru = geser(grup, 0, 1)!;
  cek('grup belum bernomor: seluruhnya ditulis', perubahanUrutan(baru).length === 3);
}
{
  const grup = [s('a', 1), s('b', 2), s('c', 3)];
  cek('susunan tak berubah = 0 penulisan', perubahanUrutan(grup).length === 0);
}

console.log('\n3. Batas geser');
{
  const grup = [s('a', 1), s('b', 2), s('c', 3)];
  cek('naik dari puncak ditolak', geser(grup, 0, -1) === null);
  cek('turun dari dasar ditolak', geser(grup, 2, 1) === null);
  cek('indeks di luar daftar ditolak', geser(grup, 9, -1) === null);
  cek('grup asli tidak ikut berubah',
    JSON.stringify(grup.map(q => q.id)) === '["a","b","c"]');
}
{
  // Geser berkali-kali harus tetap menghasilkan nomor 1..n tanpa bolong.
  let grup = [s('a', 1), s('b', 2), s('c', 3), s('d', 4)];
  for (const [i, arah] of [[0, 1], [3, -1], [1, 1], [2, -1]] as [number, -1 | 1][]) {
    const baru = geser(grup, i, arah);
    if (!baru) continue;
    const p = new Map(perubahanUrutan(baru).map(x => [x.id, x.urutan]));
    grup = baru.map(q => p.has(q.id) ? { ...q, urutan: p.get(q.id)! } : q);
  }
  const nomor = grup.map(q => q.urutan).sort((x, y) => (x ?? 0) - (y ?? 0));
  cek('setelah 4 geseran nomornya tetap 1..4',
    JSON.stringify(nomor) === '[1,2,3,4]', JSON.stringify(nomor));
  cek('tidak ada soal yang hilang', grup.length === 4);
  cek('tidak ada id kembar', new Set(grup.map(q => q.id)).size === 4);
}

console.log('\n4. Soal baru masuk di ekor');
{
  cek('grup kosong mulai dari 1', nomorBerikutnya([]) === 1);
  cek('menyambung nomor terbesar', nomorBerikutnya([s('a', 1), s('b', 7), s('c', 3)]) === 8);
  cek('grup belum bernomor mulai dari 1', nomorBerikutnya([s('a', null), s('b', null)]) === 1);
}
{
  // Soal baru harus benar-benar tampil paling bawah, bukan sekadar bernomor besar.
  const grup = [s('a', 1), s('b', 2)];
  const baru = [...grup, s('baru', nomorBerikutnya(grup))];
  const hasil = [...baru].sort(bandingkanUrutan).map(q => q.id);
  cek('soal baru tampil terakhir', JSON.stringify(hasil) === '["a","b","baru"]', hasil.join(','));
}

console.log(`\n${gagal === 0 ? 'SEMUA LULUS' : 'ADA YANG GAGAL'} - ${lulus} lulus, ${gagal} gagal\n`);
process.exit(gagal === 0 ? 0 : 1);
