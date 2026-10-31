/**
 * uji/desain3d-jarak-proyeksi.ts - Projection distance (L) Desain 3D seperti kalkulator Panasonic (inti/jarakProyeksi.ts):
 * diukur dari UJUNG LENSA (bukan tengah badan), bisa diatur, dan posisi lensa X / Y / Z bisa diisi langsung.
 *
 * Jalankan: npx tsx uji/desain3d-jarak-proyeksi.ts
 */
import {
  aturJarakProyeksi, bendaBaru, daftarRuang, jarakProyeksi, keDunia, lebarGambarDi, LENSA_MZ882, lensaMZ882, lensaProyektor,
  posisiDariLensa, sinarProyektor, type Benda, type Ruang,
} from '../app/(portal)/tools-team/_components/desain3d/inti';

let lulus = 0, gagal = 0;
function cek(nama: string, syarat: boolean, info = '') {
  if (syarat) { lulus++; console.log(`  ok   ${nama}`); } else { gagal++; console.log(`  GAGAL ${nama}${info ? ` - ${info}` : ''}`); }
}
const dekat = (a: number, b: number, t = 1e-6) => Math.abs(a - b) <= t;
const ruang: Ruang = { p: 12, l: 12, t: 4, lantai: 'polos', r2: null };
const K = daftarRuang(ruang)[0];
const lensa = (b: Benda) => keDunia(b, lensaProyektor(b));

//  Layar di dinding depan (muka layar menghadap +z), PT-MZ882 + ET-ELS20 lurus menghadap layar.
const layar: Benda = { ...bendaBaru('layar', K), id: 'layar', x: 6, z: 0.05, elev: 0.8, rot: 0, w: 2.751, h: 1.719, d: 0.04 };
const mukaZ = layar.z + layar.d / 2;
const p0: Benda = { ...bendaBaru('proyektor', K, { pasangProyektor: 'plafon' }), id: 'p', x: 6, z: 6, elev: 2.6, rot: 180, tilt: 0, offsetLensa: 0, ...lensaMZ882(LENSA_MZ882.ELS20, LENSA_MZ882.ELS20.trMin) };

console.log('\n1. Diukur dari ujung lensa, bukan tengah badan');
const j0 = jarakProyeksi(p0, [layar, p0], ruang);
cek(`L = jarak tegak lurus ujung lensa ke muka layar (${j0.jarak?.toFixed(3)} m)`, j0.cara === 'tegak' && j0.sasaran?.id === 'layar' && dekat(j0.jarak!, lensa(p0)[2] - mukaZ));
cek('bukan jarak dari tengah badan (selisih = setengah badan + tonjolan lensa)', !dekat(j0.jarak!, p0.z - mukaZ, 0.05), `tengah badan ${(p0.z - mukaZ).toFixed(3)}`);
cek('sama dengan jarak sinar di kanvas saat lurus', dekat(j0.jarak!, sinarProyektor(p0, [layar, p0], ruang).jarak, 1e-9));

console.log('\n2. Mengatur projection distance (L Panasonic 127,71" ET-ELS20 wide = 4,454 m)');
const pos = aturJarakProyeksi(p0, [layar, p0], ruang, 4.454)!;
const p1 = { ...p0, ...pos };
const j1 = jarakProyeksi(p1, [layar, p1], ruang);
cek(`L tepat 4,454 m (${j1.jarak?.toFixed(4)})`, dekat(j1.jarak!, 4.454, 1e-9));
cek('lensa tidak bergeser kiri-kanan & tinggi', dekat(lensa(p1)[0], lensa(p0)[0], 1e-9) && dekat(lensa(p1)[1], lensa(p0)[1], 1e-9));
const lebar = lebarGambarDi(p1, j1.jarak!);
cek(`gambar ${lebar.toFixed(3)} m = 127,71" 16:10 (2,751 m) seperti kalkulator Panasonic`, dekat(lebar, 2.751, 0.002));

console.log('\n3. Posisi lensa X / Y / Z diisi langsung');
const p2 = { ...p0, ...posisiDariLensa(p0, { x: 5, y: 3.1, z: 4 }) };
const l2 = lensa(p2);
cek('ujung lensa tepat di (5 ; 3,1 ; 4)', dekat(l2[0], 5, 1e-9) && dekat(l2[1], 3.1, 1e-9) && dekat(l2[2], 4, 1e-9));
cek('sumbu yang tidak diisi tetap', dekat(lensa({ ...p0, ...posisiDariLensa(p0, { z: 4 }) })[0], lensa(p0)[0], 1e-9));
const miring = { ...p0, tilt: -15 };
const l3 = lensa({ ...miring, ...posisiDariLensa(miring, { y: 3 }) });
cek('tetap tepat saat proyektor menunduk (tilt -15°)', dekat(l3[1], 3, 1e-9));

console.log('\n4. Bidang lengkung & dinding: sepanjang sumbu, titik bidik tetap');
const cembung: Benda = { ...bendaBaru('bidang', K, { bentukBidang: 'cembung', busur: 60, jariBidang: 5 }), id: 'cb', x: 6, z: 1, elev: 0.5, rot: 0 };
const pc = { ...p0, x: 6, z: 7 };
const jc = jarakProyeksi(pc, [cembung, pc], ruang);
cek(`bidang cembung: cara sumbu (${jc.jarak?.toFixed(3)} m)`, jc.cara === 'sumbu' && jc.sasaran?.id === 'cb' && (jc.jarak ?? 0) > 0);
const pc2 = { ...pc, ...aturJarakProyeksi(pc, [cembung, pc], ruang, (jc.jarak ?? 0) + 0.75)! };
cek('diatur +0,75 m tepat', dekat(jarakProyeksi(pc2, [cembung, pc2], ruang).jarak!, (jc.jarak ?? 0) + 0.75, 1e-6));
const jd = jarakProyeksi({ ...p0, rot: 90 }, [layar], ruang);
cek('tidak ada layar di depan lensa -> dinding, cara sumbu', jd.sasaran === null && jd.cara === 'sumbu' && (jd.jarak ?? 0) > 0);
const membelakangi = { ...p0, rot: 0 };
cek('proyektor membelakangi layar: layar tidak dihitung', jarakProyeksi(membelakangi, [layar, membelakangi], ruang).sasaran?.id !== 'layar');

console.log(`\n${lulus}/${lulus + gagal} lulus`);
process.exit(gagal ? 1 : 0);
