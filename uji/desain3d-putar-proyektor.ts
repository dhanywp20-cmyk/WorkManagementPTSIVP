import { readFileSync } from 'node:fs';
import {
  arahSinar, type Benda, bendaBaru, type Blending, blendingPerProyektor, daftarRuang, gulungBadan, keDunia, keGambar, lensaDari, lensaProyektor, namaPendek, pasangKeLayar,
  penghalangBenda, potretDari, proyektorKeLayar, putaranGambar, rollDari, type Ruang, sinarProyektor, sisiTampil, ukuranTampak, uvAsli, uvTampil,
} from '../app/(portal)/tools-team/_components/desain3d/inti';

let lulus = 0, gagal = 0;
function cek(nama: string, syarat: boolean) {
  if (syarat) { lulus++; console.log(`  ok   ${nama}`); } else { gagal++; console.log(`  GAGAL ${nama}`); }
}
const titik = (a: number[], b: number[]) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const ruang: Ruang = { p: 6, l: 5, t: 3, lantai: 'kayu', r2: null };
const k = daftarRuang(ruang)[0];
const layar = bendaBaru('layar', k, { diag: 120 });
const datar = proyektorKeLayar(bendaBaru('proyektor', k, { pasangProyektor: 'plafon' }), layar, k, ruang);
const potret: Benda = { ...datar, roll: 90 };

console.log('\n1. Sudut putar (roll)');
cek('roll dinormalkan ke -180..180: 270° = -90°, -180° = 180°, 450° = 90°', rollDari({ roll: 270 }) === -90 && rollDari({ roll: -180 }) === 180 && rollDari({ roll: 450 }) === 90 && rollDari({}) === 0);
cek('90° & -90° = potret, 0° & 180° = landscape; 80° dibulatkan ke potret', potretDari({ roll: 90 }) && potretDari({ roll: -90 }) && !potretDari({ roll: 180 }) && !potretDari({}) && potretDari({ roll: 80 }) && putaranGambar({ roll: -90 }) === 3);
cek('ukuran tampak: potret menukar lebar & tinggi, 0° tetap', ukuranTampak({ roll: 90 }, 4, 2.25).lebar === 2.25 + 4 * Math.abs(Math.cos(Math.PI / 2)) && Math.abs(ukuranTampak({ roll: 90 }, 4, 2.25).tinggi - 4) < 1e-12
  && ukuranTampak({}, 4, 2.25).lebar === 4 && ukuranTampak({}, 4, 2.25).tinggi === 2.25);

console.log('\n2. Lensa & badan ikut berputar');
const L0 = lensaDari(datar), L90 = lensaDari(potret);
cek('roll 0 tidak mengubah lensa (bawaan lama tetap)', JSON.stringify(lensaDari({ ...datar, roll: 0 })) === JSON.stringify(L0) && L0.putar === 0);
cek('roll +90°: atas gambar menghadap kanan, kanan gambar menghadap bawah (searah jarum jam dari belakang)', titik(L90.atas, L0.kanan) > 0.999 && titik(L90.kanan, L0.atas) < -0.999 && L90.putar === 1);
cek('sumbu lensa tetap sama saat diputar', titik(L90.D, L0.D) > 0.9999);
const gb = gulungBadan(potret), tinggiLensa = (b: Benda) => keDunia(b, lensaProyektor(b))[1];
cek(`badan potret tetap tergantung di plafon: atas badan ${(gb.y + potret.w / 2).toFixed(3)} m = tinggi badan ${potret.h} m`, Math.abs(gb.y + potret.w / 2 - potret.h) < 1e-9 && tinggiLensa(potret) !== tinggiLensa(datar));
const tanpaTilt: Benda = { ...potret, tilt: 0 }, ph = penghalangBenda(tanpaTilt)!, ke = (x: number, y: number) => keDunia(tanpaTilt, [x, y, 0]);
cek('penghalang bayangan ikut bentuk badan yang diputar', ph.dalam(...ke(0, gb.y)) && !ph.dalam(...ke(tanpaTilt.w * 0.4, tanpaTilt.h / 2)) && ph.dalam(...ke(0, tanpaTilt.h - tanpaTilt.w * 0.45)));

console.log('\n3. Gambar di layar & posisikan otomatis');
const sn0 = sinarProyektor(datar, [layar, datar], ruang), sn90 = sinarProyektor(potret, [layar, potret], ruang);
cek(`gambar potret: ${sn90.lebar.toFixed(2)} × ${sn90.tinggi.toFixed(2)} m (landscape ${sn0.lebar.toFixed(2)} × ${sn0.tinggi.toFixed(2)} m)`, Math.abs(sn90.lebar - sn0.tinggi) < 1e-9 && Math.abs(sn90.tinggi - sn0.lebar) < 1e-9);
const pj = sn90.sudut.map(s => keGambar(L90, s));
cek(`pojok gambar potret tepat di tepi sinar & urutannya sama (${pj.map(g => g && `${g.u.toFixed(2)},${g.v.toFixed(2)}`).join(' ')})`,
  pj.every((g, i) => !!g && Math.abs(g.u - [-0.5, 0.5, 0.5, -0.5][i]) < 0.02 && Math.abs(g.v - [-0.5, -0.5, 0.5, 0.5][i]) < 0.02));
const ruangPanjang: Ruang = { p: 8, l: 12, t: 3.5, lantai: 'kayu', r2: null }, kP = daftarRuang(ruangPanjang)[0], layarP = bendaBaru('layar', kP, { diag: 100 });
const pas = pasangKeLayar({ ...proyektorKeLayar(bendaBaru('proyektor', kP, { pasangProyektor: 'plafon' }), layarP, kP, ruangPanjang), roll: 90 }, layarP, kP, ruangPanjang);
const snPas = sinarProyektor(pas.benda, [layarP, pas.benda], ruangPanjang);
cek(`posisikan otomatis potret: lebar gambar ${snPas.lebar.toFixed(3)} m = lebar layar ${layarP.w.toFixed(3)} m, di tengah (${(snPas.selisihV ?? 9).toFixed(3)}, ${(snPas.selisihH ?? 9).toFixed(3)} m)`,
  pas.benda.roll === 90 && pas.kurangJarakM === 0 && Math.abs(snPas.lebar - layarP.w) < 0.02 && Math.abs(snPas.selisihV ?? 9) < 0.02 && Math.abs(snPas.selisihH ?? 9) < 0.02 && (pas.benda.offsetLensa ?? 0) === 0);
const sempit = pasangKeLayar(potret, layar, k, ruang);
cek(`ruang 5 m terlalu pendek untuk potret selebar layar 120": kurang jarak ${sempit.kurangJarakM.toFixed(2)} m dilaporkan`, sempit.kurangJarakM > 1);

console.log('\n4. Isi & label di 3D tetap tegak');
cek('uv tampil & uv asli saling balik untuk 0°, 90°, 180°, -90°', [0, 1, 2, 3].every(q => [[0.1, 0.3], [-0.4, 0.2]].every(([x, y]) => {
  const [u, v] = uvTampil(q, x + 0.5, y + 0.5), [a, b] = uvAsli(q, u - 0.5, v - 0.5);
  return Math.abs(a - x) < 1e-12 && Math.abs(b - y) < 1e-12;
})));
cek('sisi atas panel proyektor potret +90° tampil di kanan (cocok dengan arah lensa)', sisiTampil(L90.putar, { kiri: 0, kanan: 0, atas: 1, bawah: 0 }).kanan === 1 && sisiTampil(0, { kiri: 1, kanan: 0, atas: 0, bawah: 0 }).kiri === 1);
const keArah = (x: number) => arahSinar(L90, ...uvAsli(L90.putar, x, 0));
cek('titik kanan di tampilan = arah kanan dunia pada proyektor potret', titik(keArah(0.4), L0.kanan) > titik(keArah(-0.4), L0.kanan) + 0.1);
const dir = 'app/(portal)/tools-team/_components/desain3d/', baca = (p: string) => readFileSync(dir + p, 'utf8');
cek('adegan 3D: badan diputar di sumbu z, konten & label diputar balik per 90°', /gulung\.rotation\.z = gb\.g/.test(baca('bangun/display.ts')) && /g\.rotate\(\(-L\.putar \* Math\.PI\) \/ 2\)/.test(baca('mesin/proyektorNyata.ts'))
  && /uvTampil\(Lp\.putar/.test(baca('mesin/sinar.ts')) && /sisiTampil\(bg\.L\.putar/.test(baca('mesin/sinar.ts')));
cek('panel Posisi: roll dalam derajat + tombol Landscape / Potret 90° / Potret −90° / Terbalik 180°', /Roll \(putar di sumbu lensa\)/.test(baca('panel/benda/AturProyektor.tsx')) && /Potret 90°/.test(baca('panel/benda/AturProyektor.tsx')));

console.log('\n5. Tabel blending ekspor: satu baris per proyektor');
const A: Benda = { ...datar, id: 'A', nama: 'PT-VMZ7ST 1 (bibir kiri → kanan bawah)' }, LA = lensaDari(A);
const d = 3, lebarDi = d * LA.w1, geser = lebarDi * 0.9;
const B: Benda = { ...A, id: 'B', nama: 'PT-VMZ7ST 2 (bibir kanan → kiri bawah)', x: A.x + LA.kanan[0] * geser, z: A.z + LA.kanan[2] * geser };
const C: Benda = { ...A, id: 'C', nama: 'PT-VMZ7ST 3 (bibir kiri → kanan atas)', elev: A.elev + 1 };
const di = (u: number, v: number) => { const r = arahSinar(LA, u, v); return [LA.O[0] + r[0] * d, LA.O[1] + r[1] * d, LA.O[2] + r[2] * d] as [number, number, number]; };
const info: Blending[] = [
  { a: 'A', b: 'B', namaA: A.nama, namaB: B.nama, arah: 'kiri-kanan', lebarM: 0.4, persenA: 10, persenB: 12, tengah: di(0.45, 0), garis: [], pxA: 1920, pxB: 1920 },
  { a: 'C', b: 'A', namaA: C.nama, namaB: A.nama, arah: 'atas-bawah', lebarM: 0.3, persenA: 15, persenB: 20, tengah: di(0, 0.45), garis: [], pxA: 1200, pxB: 1200 },
];
const baris = blendingPerProyektor([layar, A, B, C], info), bA = baris.find(x => x.p.id === 'A')!, bB = baris.find(x => x.p.id === 'B')!;
cek(`proyektor dengan 2 tetangga hanya 1 baris (${baris.map(x => x.p.id).join(', ')})`, baris.length === 3 && baris.filter(x => x.p.id === 'A').length === 1);
cek('tepi kanan A ↔ B (10% ≈ 192 px), tepi atas A ↔ C (20% ≈ 240 px), tepi kiri B (12%)', bA.sisi.kanan[0]?.dengan === B.nama && bA.sisi.kanan[0].px === 192 && bA.sisi.atas[0]?.persen === 20 && bA.sisi.atas[0].px === 240
  && !bA.sisi.kiri.length && !bA.sisi.bawah.length && bB.sisi.kiri[0]?.persen === 12);
cek('nama pendek tanpa keterangan posisi', namaPendek(A.nama) === 'PT-VMZ7ST 1' && namaPendek('Proyektor') === 'Proyektor');
const ekspor = baca('ekspor/useEkspor.ts');
cek('lembar ekspor: kolom Tepi kiri/kanan/atas/bawah, ukuran gambar tampak & sudut putar', /'Tepi kiri', 'Tepi kanan', 'Tepi atas', 'Tepi bawah'/.test(ekspor) && /blendingPerProyektor\(benda, infoBlending\)/.test(ekspor)
  && /ukuranTampak\(p, g\.lebar, g\.tinggi\)/.test(ekspor) && /putar \$\{fm\(roll, 0\)\}°/.test(ekspor));

console.log(`\n${lulus} lulus, ${gagal} gagal`);
if (gagal) process.exit(1);
