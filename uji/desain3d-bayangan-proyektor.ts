import { readFileSync } from 'node:fs';
import {
  arahkanKe, bayanganProyektor, type Benda, bendaBaru, bomDesain, cakupanProyektor, cekRuangGerak, daftarRuang, dalamPesawatAcuan, KATEGORI_RUANG, mataPilot, permukaanBenda,
  type Ruang, tandaBentuk, templateRuang,
} from '../app/(portal)/tools-team/_components/desain3d/inti';

let lulus = 0, gagal = 0;
function cek(nama: string, syarat: boolean) {
  if (syarat) { lulus++; console.log(`  ok   ${nama}`); } else { gagal++; console.log(`  GAGAL ${nama}`); }
}
const persen = (x: number) => `${(x * 100).toFixed(1)}%`;
const ruang: Ruang = { p: 8, l: 8, t: 3.2, lantai: 'kayu', r2: null };
const k = daftarRuang(ruang)[0];

console.log('\n1. Bentuk penghalang pesawat');
cek('titik di sumbu badan = di dalam badan', dalamPesawatAcuan(0, 0.8, 0));
cek('ujung sayap & sirip tegak = penghalang', dalamPesawatAcuan(0.85, 0.6, 0.3) && dalamPesawatAcuan(0, 1.6, 1.4));
cek('mata pilot & ruang kanopi kaca bukan penghalang (kaca tembus sinar)', !dalamPesawatAcuan(0, 1.38, -0.25) && !dalamPesawatAcuan(0, 1.55, -0.25));
cek('udara di samping badan bukan penghalang', !dalamPesawatAcuan(0.7, 1.1, -0.8));

console.log('\n2. Bayangan antar proyektor & tiang plafon');
const layar = { ...bendaBaru('bidang', k, { bentukBidang: 'datar' }), id: 'l', x: 4, z: 0.5, w: 3, h: 2, elev: 0.6, rot: 0 } as Benda;
const proyektor = (id: string, x: number, z: number, elev: number, ubah: Partial<Benda> = {}) =>
  ({ ...arahkanKe({ ...bendaBaru('proyektor', k, { pasangProyektor: 'plafon' }), id, nama: id, x, z, elev, offsetLensa: 0 }, [4, 1.6, 0.5]), ...ubah }) as Benda;
const A = proyektor('A', 4, 6, 1.55), B = proyektor('B', 4, 3.5, 1.55);
const hasil = (b: Benda[]) => bayanganProyektor([layar, ...b])[0];
cek(`proyektor B tepat di depan lensa A -> gambar A terhalang B (${persen(hasil([A, B]).terhalang[0]?.porsi ?? 0)})`, (hasil([A, B]).terhalang[0]?.porsi ?? 0) > 0.03);
cek('B digeser ke samping keluar sinar A -> tanpa bayangan', hasil([A, { ...B, x: 6.6 }]).terhalang.length === 0);
const bawah = proyektor('C', 4, 3.5, 0.6, { tilt: 0 });
const pakaiTiang = hasil([A, bawah]).terhalang[0]?.porsi ?? 0, melayang = hasil([A, { ...bawah, tanpaTiang: true }]).terhalang[0]?.porsi ?? 0;
cek(`tiang plafon proyektor lain memotong sinar -> bayangan (${persen(pakaiTiang)}); melayang tanpa tiang -> ${persen(melayang)}`, pakaiTiang > 0 && melayang < pakaiTiang);

console.log('\n3. Template simulator: proyektor di luar bola, tanpa bayangan');
const t = templateRuang('simulator');
const bidang = t.benda.find(b => b.jenis === 'bidang')!, pesawat = t.benda.find(b => b.bentukObjek === 'pesawat')!, mata = mataPilot(pesawat);
const proj = t.benda.filter(b => b.jenis === 'proyektor');
const bay = bayanganProyektor(t.benda, { mata });
for (const h of bay) {
  const antar = h.terhalang.filter(x => proj.some(p => p.nama === x.nama)).reduce((s, x) => s + x.porsi, 0);
  const olehPesawat = h.terhalang.find(x => x.nama === pesawat.nama)?.porsi ?? 0;
  cek(`${h.nama}: ${persen(h.keLayar)} gambar sampai di layar; bayangan proyektor lain ${persen(antar)}, punggung layar ${persen(h.balikLayar)}, bayangan pesawat ${persen(olehPesawat)} (terlihat pilot ${persen(h.terlihatPilot)})`,
    antar === 0 && h.balikLayar === 0 && h.terlihatPilot === 0 && h.keLayar > 0.94);
}
const c = cakupanProyektor(proj, permukaanBenda(bidang));
cek(`3 proyektor menutup layar bola ${persen(c.tertutup)} dengan blending ${persen(c.tumpang)}`, proj.length === 3 && c.tertutup >= 0.99 && c.tumpang >= 0.08 && c.tumpang <= 0.3);
const masalah = cekRuangGerak(t.benda, t.ruang).filter(x => x.kode === 'tumpang' || x.kode === 'keluar');
cek(`proyektor tidak bertumpuk dengan layar / pesawat & di dalam ruangan${masalah.length ? ` (${masalah.map(x => x.pesan).join('; ')})` : ''}`,
  !masalah.length && proj.every(p => p.x > 0.3 && p.x < t.ruang.p - 0.3 && p.z < t.ruang.l - 0.3 && p.elev + p.h < t.ruang.t));

console.log('\n4. Opsi "Melayang (tanpa tiang)"');
const semuaTemplate = KATEGORI_RUANG.flatMap(x => templateRuang(x.id).benda.filter(b => b.jenis === 'proyektor'));
cek(`semua proyektor template immersive / mapping / simulator melayang tanpa tiang (${semuaTemplate.length} proyektor)`, semuaTemplate.length > 10 && semuaTemplate.every(p => p.tanpaTiang));
const baru = bendaBaru('proyektor', k, { pasangProyektor: 'plafon' });
cek('proyektor baru dari katalog tetap memakai tiang (bawaan)', !baru.tanpaTiang);
cek('ganti melayang <-> tiang membangun ulang model 3D (masuk tanda bentuk)', tandaBentuk(baru) !== tandaBentuk({ ...baru, tanpaTiang: true }));
const bom = (b: Benda[]) => bomDesain(b, []).map(x => x.item);
cek('BOM: tiang -> bracket plafon; melayang -> bracket ke rangka / truss',
  bom([baru]).includes('Bracket plafon proyektor') && bom([{ ...baru, tanpaTiang: true }]).includes('Bracket proyektor ke rangka / truss') && !bom([{ ...baru, tanpaTiang: true }]).includes('Bracket plafon proyektor'));
const D = 'app/(portal)/tools-team/_components/desain3d/';
const display = readFileSync(`${D}bangun/display.ts`, 'utf8'), panel = readFileSync(`${D}panel/benda/AturProyektor.tsx`, 'utf8');
cek('model 3D: tiang, sendi & pelat plafon tidak digambar saat melayang', /if \(!meja && !b\.tanpaTiang\) \{/.test(display) && /\} else if \(!b\.tanpaTiang\) \{/.test(display));
cek('panel Pemasangan: Gantung plafon / Melayang / Portabel meja', /\{ v: 'melayang', l: 'Melayang' \}/.test(panel));
cek('tersimpan di Objek saya & produk tim', /tanpaTiang: 'bool'/.test(readFileSync('lib/objek-saya.ts', 'utf8')) && /hasil\.tanpaTiang = a\.tanpaTiang/.test(readFileSync('lib/tools-team.ts', 'utf8')));

console.log(`\n${lulus} lulus, ${gagal} gagal`);
if (gagal) process.exit(1);
