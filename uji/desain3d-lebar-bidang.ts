import { readFileSync } from 'node:fs';
import {
  type Benda, bendaBaru, bolaBidang, daftarRuang, kedalamanBidang, mataPilot, type Ruang, templateRuang, terapkanUkuran, ubahLebarBidang, ukuranBidang,
} from '../app/(portal)/tools-team/_components/desain3d/inti';

let lulus = 0, gagal = 0;
function cek(nama: string, syarat: boolean) {
  if (syarat) { lulus++; console.log(`  ok   ${nama}`); } else { gagal++; console.log(`  GAGAL ${nama}`); }
}
const dekat = (a: number, b: number, t = 0.005) => Math.abs(a - b) <= t;
const ruang: Ruang = { p: 8, l: 8, t: 3.2, lantai: 'kayu', r2: null };
const k = daftarRuang(ruang)[0];
const lebarJadi = (b: Benda, w: number) => terapkanUkuran({ ...b, ...ubahLebarBidang(b, w) });
const pusatBola = (b: Benda) => {
  const q = bolaBidang(b), r = (b.rot * Math.PI) / 180;
  return [b.x + q.zP * Math.sin(r), b.elev + q.yP, b.z + q.zP * Math.cos(r)];
};

console.log('\n1. Lebar layar simulator bola 225° bisa diubah');
const t = templateRuang('simulator');
const bola = t.benda.find(b => b.jenis === 'bidang')!, mata = mataPilot(t.benda.find(b => b.bentukObjek === 'pesawat')!);
cek(`template simulator (contoh Opsi 3) layar bola 225° Ø ${bola.w} m, atas tertutup`, bola.bentukBidang === 'bola' && bola.busur === 225 && dekat(bola.w, 4) && bola.atasBola === 90);
for (const w of [3.5, 4, 6]) {
  const b = lebarJadi(bola, w), c = pusatBola(b);
  cek(`lebar ${w} m -> Ø ${b.w} m, jari-jari ${b.jariBidang} m, busur tetap ${b.busur}°, pusat bola tetap di mata pilot (geser ${(Math.hypot(c[0] - mata[0], c[1] - mata[1], c[2] - mata[2]) * 100).toFixed(1)} cm)`,
    dekat(b.w, w) && b.busur === 225 && Math.hypot(c[0] - mata[0], c[1] - mata[1], c[2] - mata[2]) < 0.01);
}
const diputar = { ...bola, rot: 90, x: 3, z: 3.5 } as Benda, pd = pusatBola(diputar), pd2 = pusatBola(lebarJadi(diputar, 3.5));
cek('layar bola diputar 90°: pusat tetap saat lebar diubah', Math.hypot(pd[0] - pd2[0], pd[1] - pd2[1], pd[2] - pd2[2]) < 0.01);
const sin75 = Math.sin((75 * Math.PI) / 180), kecil = lebarJadi(bola, 2);
cek(`bola atas tertutup dikecilkan Ø 2 m: tetap tertutup, bawah dijepit -75° (tinggi ${kecil.h} m) & pusat tetap di tinggi mata`,
  kecil.atasBola === 90 && kecil.h <= 1 + sin75 + 1e-3 && dekat(pusatBola(kecil)[1], mata[1], 0.01));
const pita = terapkanUkuran({ ...bola, atasBola: undefined, h: 2.1 } as Benda), pitaKecil = lebarJadi(pita, 2);
cek(`bola pita (atas terbuka) dikecilkan Ø 2 m: tinggi dijepit ${pitaKecil.h} m (maks ±75°) & pusat tetap`, pitaKecil.h <= 2 * sin75 + 1e-3 && dekat(pusatBola(pitaKecil)[1], pusatBola(pita)[1], 0.01));

console.log('\n2. Bentuk lain');
const cekung = terapkanUkuran({ ...bendaBaru('bidang', k, { bentukBidang: 'lengkung', jariBidang: 4, busur: 90 }), id: 'c' } as Benda);
const cekung6 = lebarJadi(cekung, 6);
cek('layar cekung < 180°: lebar diubah, kedalaman lengkung tetap', dekat(cekung6.w, 6) && dekat(cekung6.d, cekung.d));
const silinder = terapkanUkuran({ ...bendaBaru('bidang', k, { bentukBidang: 'lengkung', jariBidang: 1.5, busur: 225 }), id: 's' } as Benda);
const silinder4 = lebarJadi(silinder, 4);
cek(`layar cekung 225°: lebar 4 m -> jari-jari ${silinder4.jariBidang} m, busur tetap`, dekat(silinder4.w, 4) && silinder4.busur === 225);
const pilar = terapkanUkuran({ ...bendaBaru('bidang', k, { bentukBidang: 'cembung', busur: 360, jariBidang: 0.8 }), id: 'p' } as Benda);
cek('pilar 360°: lebar = diameter', dekat(lebarJadi(pilar, 2).w, 2) && lebarJadi(pilar, 2).busur === 360);
const datar = { ...bendaBaru('bidang', k, { bentukBidang: 'datar' }), id: 'd' } as Benda;
cek('layar datar: lebar langsung', dekat(lebarJadi(datar, 3.2).w, 3.2));
const dalam = terapkanUkuran({ ...cekung, ...kedalamanBidang(cekung, 0.5) });
cek(`kedalaman lengkung 50 cm, lebar tetap ${dalam.w} m`, dekat(dalam.d, 0.5) && dekat(dalam.w, cekung.w));
const dalamBola = terapkanUkuran({ ...bola, ...kedalamanBidang(bola, 3) });
cek(`kedalaman > setengah lebar (bola melingkar): busur ${dalamBola.busur}°, lebar tetap`, dekat(dalamBola.d, 3, 0.01) && dekat(dalamBola.w, bola.w));
cek('ukuranBidang konsisten setelah diubah', dekat(ukuranBidang(lebarJadi(bola, 3.5)).w, 3.5));

console.log('\n3. Panel');
const umum = readFileSync('app/(portal)/tools-team/_components/desain3d/panel/benda/BagianUmum.tsx', 'utf8');
const panel = readFileSync('app/(portal)/tools-team/_components/desain3d/panel/benda/AturBidang.tsx', 'utf8');
cek('Ukuran produk: Lebar (mm) layar lengkung / bola mengubah bentuk layar (dulu hanya angka w, model tidak berubah)', /ubahLebarBidang\(b, x\.w\)/.test(umum) && /kedalamanBidang\(b, v \/ 1000\)/.test(umum));
cek('panel layar: Lebar layar selalu tampil, juga untuk busur >= 180° (layar bola 225°)', !/busurPenuh/.test(panel) && /setUkuran\(ubahLebarBidang\(b, v\)\)/.test(panel));

console.log('\n4. Sinar nyata di udara');
const sinar = readFileSync('app/(portal)/tools-team/_components/desain3d/mesin/sinar.ts', 'utf8');
const udara = readFileSync('app/(portal)/tools-team/_components/desain3d/mesin/sinarUdara.ts', 'utf8');
cek('cahaya di udara putih lembut (bukan kipas kaca berwarna): additive, memudar dari lensa ke layar, tepi frustum melembut',
  /blending: THREE\.AdditiveBlending, toneMapped: false/.test(udara) && /vWarna\.a \* hadap \* hadap/.test(udara) && /nyata \? bahanSinarUdara\(THREE\)/.test(sinar)
  && /CAHAYA_UDARA = \{ lensa: 0\.12, layar: 0\.01/.test(udara));
cek('tanpa garis rusuk berwarna di mode sinar nyata', !/pojokG/.test(sinar));
cek('mode penanda (sinar nyata mati) tetap kerucut berwarna per proyektor', /0\.45 \* redam, warna\.r, warna\.g, warna\.b, 0\.08 \* redam/.test(sinar));

console.log(`\n${lulus} lulus, ${gagal} gagal`);
if (gagal) process.exit(1);
