/**
 * uji/desain3d-presisi.ts - presisi Desain 3D (inti/presisi.ts): snap grid, kerapatan grid yang digambar,
 * dan penggaris (panjang, rincian datar / tinggi, format mm, penyaring data tersimpan).
 *
 * Jalankan: npm test -- desain3d-presisi
 */
import {
  bulatkanKe, formatPanjang, jarakGrid, MAKS_PENGGARIS, panjangGaris, penggarisSah, rincianGaris, snapSah, titikSnap,
} from '../app/(portal)/tools-team/_components/desain3d/inti';

let lulus = 0, gagal = 0;
function cek(nama: string, syarat: boolean) {
  if (syarat) { lulus++; console.log(`  ok   ${nama}`); } else { gagal++; console.log(`  GAGAL ${nama}`); }
}

console.log('\n1. Snap');
cek('pengaturan rusak -> bawaan (mati, 10 cm, 15°)', JSON.stringify(snapSah({ aktif: 'ya', langkah: 0.07, sudut: 33 })) === JSON.stringify({ aktif: false, langkah: 0.1, sudut: 15 }));
cek('pengaturan sah dipertahankan', snapSah({ aktif: true, langkah: 0.05, sudut: 45 }).langkah === 0.05);
cek('bulatkan 1,234 ke 5 cm = 1,25 (tanpa sisa desimal aneh)', bulatkanKe(1.234, 0.05) === 1.25 && bulatkanKe(0.3, 0.1) === 0.3);
cek('titik penggaris ikut grid saat snap aktif', titikSnap([1.234, 0.76, 2.01], { aktif: true, langkah: 0.1, sudut: 15 }).join() === '1.2,0.8,2');
cek('snap mati -> dibulatkan ke mm saja', titikSnap([1.23456, 0, 0], { aktif: false, langkah: 0.1, sudut: 15 })[0] === 1.235);

console.log('\n2. Grid yang digambar');
cek('ruang 8 m, langkah 10 cm -> tetap 10 cm (80 garis)', jarakGrid(0.1, 8) === 0.1);
cek('ruang 20 m, langkah 1 cm -> direnggangkan (<= 120 garis)', 20 / jarakGrid(0.01, 20) <= 120);
cek('jarak grid tetap kelipatan rapi', [0.02, 0.05, 0.1, 0.2, 0.25, 0.5].includes(jarakGrid(0.01, 20)));

console.log('\n3. Penggaris');
const g = { a: [0, 1.2, 0] as [number, number, number], b: [3, 1.2, 4] as [number, number, number] };
cek('panjang 3-4-5 = 5 m', Math.abs(panjangGaris(g) - 5) < 1e-9);
cek('format mm dengan pemisah ribuan', formatPanjang(2.35) === '2.350 mm');
const r = rincianGaris({ a: [0, 1.1, 0], b: [0, 2.5, 4] });
cek('rincian: datar 4 m & tinggi 1,4 m (mata penonton ke layar)', Math.abs(r.datar - 4) < 1e-9 && Math.abs(r.tinggi - 1.4) < 1e-9);
cek('data rusak dibuang', penggarisSah([{ id: 'a', a: [0, 0], b: [1, 1, 1] }, { id: 'b', a: [0, 0, 0], b: [1, 1, 1] }, 'x']).length === 1);
cek(`maks ${MAKS_PENGGARIS} garis`, penggarisSah(Array.from({ length: 50 }, (_, i) => ({ id: `g${i}`, a: [0, 0, 0], b: [1, 0, 0] }))).length === MAKS_PENGGARIS);
cek('bukan array -> kosong', penggarisSah(null).length === 0 && penggarisSah({}).length === 0);

console.log(`\n${lulus} lulus, ${gagal} gagal`);
if (gagal) process.exit(1);
