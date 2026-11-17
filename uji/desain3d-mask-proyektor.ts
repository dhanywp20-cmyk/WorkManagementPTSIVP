import { readFileSync } from 'node:fs';
import {
  arahkanKe, type Benda, bendaBaru, daftarRuang, kunciBidangMask, type Lensa, lensaDari, permukaanBenda, petaMaskBidang, type Ruang,
  templateRuang, terapkanUkuran, type Titik, ujiKenaBidang,
} from '../app/(portal)/tools-team/_components/desain3d/inti';

let lulus = 0, gagal = 0;
function cek(nama: string, syarat: boolean) {
  if (syarat) { lulus++; console.log(`  ok   ${nama}`); } else { gagal++; console.log(`  GAGAL ${nama}`); }
}
const ruang: Ruang = { p: 8, l: 8, t: 3.2, lantai: 'kayu', r2: null };
const k = daftarRuang(ruang)[0];
const satuan = (a: Titik): Titik => { const l = Math.hypot(...a); return [a[0] / l, a[1] / l, a[2] / l]; };

/** Mask acuan: per piksel, sinar dari lensa diuji ke permukaanBenda().kena (fungsi yang sama dengan cakupan proyektor). */
function maskAcuan(L: Lensa, bidang: Benda[], W: number, H: number) {
  const P = bidang.map(b => permukaanBenda(b));
  const hasil = new Uint8Array(W * H);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const fu = ((x + 0.5) / W - 0.5 + L.gH) * L.w1, fv = (1 - (y + 0.5) / H - 0.5 + L.gV) * L.h1;
    const d = satuan([L.D[0] + L.kanan[0] * fu + L.atas[0] * fv, L.D[1] + L.kanan[1] * fu + L.atas[1] * fv, L.D[2] + L.kanan[2] * fu + L.atas[2] * fv]);
    if (P.some(p => p.kena(L.O, d) !== null)) hasil[y * W + x] = 1;
  }
  return hasil;
}
const beda = (a: Uint8Array, b: Uint8Array) => { let n = 0; for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) n++; return n / a.length; };
const isi = (a: Uint8Array) => a.reduce((s, v) => s + v, 0) / a.length;
function proyektorKe(lensa: Titik, sasaran: Titik): Benda {
  const p0 = bendaBaru('proyektor', k, { pasangProyektor: 'plafon' });
  return arahkanKe({ ...p0, x: lensa[0], z: lensa[2], elev: lensa[1] - p0.h / 2, offsetLensa: 0 }, sasaran);
}

console.log('\n1. Mask analitik = permukaan layar (bola / silinder cekung / datar)');
const bola = terapkanUkuran({ ...bendaBaru('bidang', k, { bentukBidang: 'bola', jariBidang: 2.5, busur: 225 }), id: 'b', x: 4, z: 2.5, h: 2.1, elev: 0.33, rot: 0 } as Benda);
const silinder = terapkanUkuran({ ...bendaBaru('bidang', k, { bentukBidang: 'lengkung', jariBidang: 1.5, busur: 225 }), id: 's', x: 4, z: 2, h: 2.5, elev: 0.2, rot: 0 } as Benda);
const W = 160, H = 90;
for (const [nama, b, pusat] of [['bola', bola, [4, 1.38, 2.5 + 2.5 - bola.d / 2]], ['silinder', silinder, [4, 1.45, 2 + 1.5 - silinder.d / 2]]] as [string, Benda, Titik][]) {
  for (const [sudut, ket, y] of [[0, 'tepi atas', b.elev + b.h], [-110, 'tepi kiri', pusat[1]], [108, 'tepi kanan bawah', b.elev]] as [number, string, number][]) {
    const a = (sudut * Math.PI) / 180, R = b.jariBidang ?? 2;
    const p = proyektorKe([pusat[0] - 0.6 * Math.sin(a), 2.4, pusat[2] + 0.6 * Math.cos(a)], [pusat[0] + R * Math.sin(a), y, pusat[2] - R * Math.cos(a)]);
    const L = lensaDari(p), m = petaMaskBidang(L, [ujiKenaBidang(b)], W, H), acuan = maskAcuan(L, [b], W, H);
    cek(`${nama} ke ${ket}: Mask = sinar yang mengenai layar (beda ${(beda(m, acuan) * 100).toFixed(2)}%, isi ${(isi(m) * 100).toFixed(0)}%)`, beda(m, acuan) < 0.002 && isi(m) > 0.15 && isi(m) < 0.9);
  }
}
const datar = { ...bendaBaru('bidang', k, { bentukBidang: 'datar' }), id: 'd', x: 4, z: 1, w: 3, h: 2, elev: 0.5, rot: 0 } as Benda;
const depan = lensaDari(proyektorKe([4, 2.4, 4.5], [4, 1.5, 1])), belakang = lensaDari(proyektorKe([4, 2.4, -2.5], [4, 1.5, 1]));
cek('bidang datar disinari dari depan: Mask = permukaanBenda', beda(petaMaskBidang(depan, [ujiKenaBidang(datar)], W, H), maskAcuan(depan, [datar], W, H)) < 0.002);
cek('bidang datar disinari dari belakang tetap ter-Mask (dua sisi, seperti raycast lama)', isi(petaMaskBidang(belakang, [ujiKenaBidang(datar)], W, H)) > 0.3);

console.log('\n2. Layar digeser / diputar: Mask ikut tepat (tidak bergantung grid sinar)');
const pBola = proyektorKe([4, 2.4, bola.z + 2.5 - bola.d / 2 + 0.6], [4, 1.38, bola.z - bola.d / 2]), Lb = lensaDari(pBola);
for (const [ket, ubah] of [['geser kiri 20 cm', { x: 3.8 }], ['geser maju 30 cm', { z: bola.z - 0.3 }], ['naik 25 cm', { elev: bola.elev + 0.25 }], ['putar 20°', { rot: 20 }]] as [string, Partial<Benda>][]) {
  const b2 = { ...bola, ...ubah };
  const m = petaMaskBidang(Lb, [ujiKenaBidang(b2)], W, H), acuan = maskAcuan(Lb, [b2], W, H);
  cek(`${ket}: Mask = acuan (beda ${(beda(m, acuan) * 100).toFixed(2)}%) & kunci geometri berubah`, beda(m, acuan) < 0.002 && kunciBidangMask([b2]) !== kunciBidangMask([bola]));
}
cek('kunci Mask tidak berubah bila hanya nama / warna bidang berubah', kunciBidangMask([{ ...bola, nama: 'x', warna: '#000' }]) === kunciBidangMask([bola]));

console.log('\n3. Template simulator (4 proyektor Mask ke layar bola)');
const tpl = templateRuang('simulator');
const layar = tpl.benda.filter(b => b.jenis === 'bidang'), proj = tpl.benda.filter(b => b.jenis === 'proyektor');
const uji = layar.map(ujiKenaBidang);
let ms = 0;
for (const p of proj) {
  const L = lensaDari(p), t0 = performance.now(), m = petaMaskBidang(L, uji, 384, 216);
  ms += performance.now() - t0;
  const acuan = maskAcuan(L, layar, 96, 54), kecil = petaMaskBidang(L, uji, 96, 54);
  cek(`${p.nama}: ${(isi(m) * 100).toFixed(0)}% gambar di layar, cocok acuan (beda ${(beda(kecil, acuan) * 100).toFixed(2)}%)`, isi(m) > 0.6 && beda(kecil, acuan) < 0.003);
}
cek(`Mask 384×216 untuk ${proj.length} proyektor cepat (${ms.toFixed(0)} ms < 400 ms)`, ms < 400);

console.log('\n4. Mesin sinar nyata');
const dir = 'app/(portal)/tools-team/_components/desain3d/mesin/';
const sinar = readFileSync(`${dir}sinar.ts`, 'utf8'), nyata = readFileSync(`${dir}proyektorNyata.ts`, 'utf8');
cek('saat diseret (kasar) sel di tepi layar tetap dipecah halus, tidak dibuang (gambar tidak menyusut)', !/if \(kasar\) continue;/.test(sinar) && /if \(kasar\) \{ tepiHalus\(q,/.test(sinar));
cek('garis tepi sinar Mask mengikuti bibir layar (dicari kontinu ke arah tengah + bisection), bukan dibulatkan ke sel grid -> tidak bergerigi',
  /const dalamMask = \(u: number, v: number\)/.test(sinar) && /BAGI_TEPI/.test(sinar) && /K_TEPI = mask \?/.test(sinar) && !/Math\.round\(i \+ \(\(ci - i\)/.test(sinar));
cek('Mask sinar nyata dari bentuk layar (analitik), bukan dari segitiga grid sinar', /mask: bg\.p\.maskBidang \? maskDari\(\) : null/.test(sinar) && !/maskUv/.test(nyata) && /petaMaskBidang\(L, uji, lebar, tinggi\)/.test(nyata));
cek('gambar dasar (konten × profil × blending) tidak digambar ulang tiap frame saat diseret', /kunciIsi !== lampu\.kunciIsi \|\| \(!kasar && kunciBlend !== lampu\.kunciBlend\)/.test(nyata));
cek('ukuran peta berubah (rasio proyektor) -> tekstur dibuat ulang (texStorage three.js tidak bisa diubah ukurannya)', /kanvas\.width = dasar\.width; kanvas\.height = dasar\.height;\s*tex\.dispose\(\);/.test(nyata));

console.log(`\n${lulus} lulus, ${gagal} gagal`);
if (gagal) process.exit(1);
