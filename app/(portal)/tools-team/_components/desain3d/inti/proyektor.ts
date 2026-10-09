/**
 * desain3d/inti/proyektor.ts - Proyektor: lensa (throw ratio, zoom, lens shift), arah pan/tilt, sinar ke layar, kecerahan.
 * Murni: tanpa three.js / React / DOM (diuji di uji/desain3d.ts).
 */
import { bulat2, daftarRuang, ruangDari } from './ruang';
import { type Benda, type Kotak, type Ruang, type Titik, warnaSah } from './tipe';

/** Titik lokal benda (alas y = 0, +z = arah hadap) ke koordinat dunia. */
export function keDunia(b: Benda, [lx, ly, lz]: Titik): Titik {
  const r = (b.rot * Math.PI) / 180, c = Math.cos(r), s = Math.sin(r);
  return [b.x + lx * c + lz * s, b.elev + ly, b.z - lx * s + lz * c];
}
/** Ujung kaca lensa sebelum tilt (lokal) - lensa di samping kanan muka, seperti produk umumnya. */
export const lensaDatar = (b: Benda): Titik => [b.w * 0.22, b.h * 0.5, b.d / 2 + 0.035];
/** Engsel tilt (lokal): plafon = sendi bola bracket di atas badan, meja = kaki belakang. */
export const engselProyektor = (b: Benda): Titik => (b.pasangProyektor === 'meja' ? [0, 0, -b.d / 2 + 0.04] : [0, b.h + 0.04, 0]);
/** Tilt proyektor (derajat, negatif = menunduk): -90° (tegak lurus ke lantai, immersive) .. +45°. */
export const tiltDari = (b: Benda) => Math.max(-90, Math.min(45, b.tilt ?? 0));
/** Rentang zoom lensa: [terlebar, terpanjang]. Tanpa isian = lensa tetap (rentang = throw ratio sekarang). */
export function zoomLensa(b: Benda): [number, number] {
  const tr = throwRatioDari(b);
  const lo = Math.max(0.1, b.trMin ?? tr), hi = Math.max(lo, b.trMax ?? tr);
  return [Math.min(lo, hi), Math.max(lo, hi)];
}
/**
 * Arahkan proyektor ke titik dunia (pan = rot, tilt). Lens shift dinolkan dulu oleh
 * pemanggil bila ingin pusat gambar tepat di titik itu (template mapping/immersive).
 */
export function arahkanKe(p: Benda, [tx, ty, tz]: Titik): Benda {
  const dx = tx - p.x, dz = tz - p.z, dy = ty - (p.elev + p.h / 2), datar = Math.hypot(dx, dz);
  const rot = datar > 1e-3 ? ((Math.atan2(dx, dz) * 180) / Math.PI + 360) % 360 : p.rot;
  const tilt = Math.max(-90, Math.min(45, (Math.atan2(dy, Math.max(1e-6, datar)) * 180) / Math.PI));
  return { ...p, rot: Math.round(rot * 10) / 10, tilt: Math.round(tilt * 10) / 10 };
}
/** Putar titik lokal di sekitar engsel sebesar tilt (sama dengan rotation.x = -tilt pada model). */
function miringkan(b: Benda, [x, y, z]: Titik): Titik {
  const t = (tiltDari(b) * Math.PI) / 180;
  if (!t) return [x, y, z];
  const [, py, pz] = engselProyektor(b);
  const dy = y - py, dz = z - pz;
  return [x, py + dy * Math.cos(t) + dz * Math.sin(t), pz - dy * Math.sin(t) + dz * Math.cos(t)];
}
/** Ujung lensa (lokal) setelah tilt. */
export const lensaProyektor = (b: Benda): Titik => miringkan(b, lensaDatar(b));
/** Arah sumbu lensa di dunia: pan = rot, tilt = naik/turun. */
export function arahProyektor(b: Benda): Titik {
  const r = (b.rot * Math.PI) / 180, t = (tiltDari(b) * Math.PI) / 180;
  return [Math.sin(r) * Math.cos(t), Math.sin(t), Math.cos(r) * Math.cos(t)];
}
export const throwRatioDari = (b: Benda) => Math.max(0.1, b.throwRatio ?? 1.5);
/** Offset vertikal lensa proyektor (pecahan tinggi gambar). */
export const offsetLensaDari = (p: Benda) => Math.min(1.5, Math.max(-0.5, p.offsetLensa ?? OFFSET_GAMBAR));
/** Lens shift horizontal (pecahan lebar gambar). */
export const geserLensaDari = (p: Benda) => Math.min(0.6, Math.max(-0.6, p.geserLensaH ?? 0));
/** Lumen bawaan bila tidak diisi. */
export const lumenDari = (p: Benda) => Math.max(100, p.lumen ?? (p.pasangProyektor === 'meja' ? 3500 : 5000));
/**
 * Perkiraan kecerahan gambar: iluminansi (lux = lumen / luas gambar) dan luminans layar
 * gain 1 (nits = lux / pi). Panduan kasar ruang rapat: < 150 lux hanya ruang gelap,
 * 150-300 lampu diredupkan, >= 300 lampu menyala.
 */
export function kecerahanProyektor(p: Benda, luasM2: number) {
  const lux = lumenDari(p) / Math.max(0.05, luasM2);
  return { lux, nits: lux / Math.PI, nada: (lux >= 300 ? 'baik' : lux >= 150 ? 'awas' : 'buruk') as 'baik' | 'awas' | 'buruk' };
}
/**
 * Offset vertikal lensa: proyektor memancarkan gambar di atas sumbu lensanya
 * (meja) atau di bawahnya (gantung plafon, terbalik). 0,5 = tepi gambar tepat
 * di sumbu lensa (offset 100%, umum pada proyektor tanpa lens shift).
 */
export const OFFSET_GAMBAR = 0.5;
export interface Sinar {
  /** Lensa (dunia). */ asal: Titik;
  /** Pojok gambar (dunia): kiri-bawah, kanan-bawah, kanan-atas, kiri-atas. */ sudut: [Titik, Titik, Titik, Titik];
  /** Layar sasaran; null = gambar jatuh di dinding/lantai/plafon. */ layar: Benda | null;
  /** Jarak lempar lensa ke bidang gambar sepanjang sumbu lensa (m). */ jarak: number;
  lebar: number; tinggi: number;
  /** Throw ratio agar gambar tepat selebar layar sasaran. */ trPas: number | null;
  /** Pusat gambar - pusat layar: + = terlalu tinggi / terlalu ke kanan (m). null tanpa layar. */
  selisihV: number | null; selisihH: number | null;
}
/**
 * Sinar satu proyektor. Sasaran = layar proyektor terdekat di ruang yang sama
 * yang berada di depan lensa (maks 50° dari arah hadap) dan menghadap balik
 * ke proyektor. Gambar jatuh di titik sumbu lensa (pan & tilt) mengenai bidang
 * layar, digeser offset vertikal; lebar = jarak lempar / throw ratio. Jadi
 * gambar terlihat melebihi/kurang dari layar bila jaraknya tidak pas, dan
 * terlalu tinggi/rendah bila tilt-nya tidak pas. Tanpa layar, gambar jatuh di
 * permukaan ruang yang dituju lensa.
 */
/** HSL (0..1) -> #rrggbb. */
function hslKeHex(h: number, s: number, l: number): string {
  const f = (n: number) => {
    const k = (n + h * 12) % 12, a = s * Math.min(l, 1 - l);
    return Math.round((l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1))) * 255).toString(16).padStart(2, '0');
  };
  return `#${f(0)}${f(8)}${f(4)}`;
}

/** Rona warna proyektor ke-`urutan` (0..1) - sama dengan garis tepi gambarnya di kanvas. */
export const ronaProyektor = (urutan: number) => (0.1 + urutan * 0.17) % 1;

/**
 * Warna sinar proyektor di kanvas (#rrggbb): pilihan engineer (panel Atur), atau otomatis - satu proyektor
 * putih hangat; dua atau lebih: warna pastel berbeda per urutan, supaya cakupan tiap bidang mudah dibedakan
 * (tumpang tindih tampak sebagai campuran warna).
 */
export function warnaSinarProyektor(p: Benda, urutan: number, jumlah: number): string {
  const pilihan = warnaSah(p.warnaSinar);
  if (pilihan) return pilihan;
  return jumlah < 2 ? '#fff1c2' : hslKeHex(ronaProyektor(urutan), 0.85, 0.72);
}

export function sinarProyektor(p: Benda, semua: Benda[], ruang: Ruang): Sinar {
  const asal = keDunia(p, lensaProyektor(p));
  const D = arahProyektor(p);
  const r = (p.rot * Math.PI) / 180;
  const maju = [Math.sin(r), Math.cos(r)];
  const ri = ruangDari(ruang, p.x);
  const tr = throwRatioDari(p);
  const naikTurun = p.pasangProyektor === 'meja' ? 1 : -1;
  const offV = offsetLensaDari(p), geserH = geserLensaDari(p);
  /** Kanan proyektor (dilihat dari belakang proyektor) di dunia. */
  const kananP: Titik = [-Math.cos(r), 0, Math.sin(r)];
  const persegi = (pusat: Titik, kanan: Titik, lebar: number, tinggi: number): Sinar['sudut'] => {
    const t = (u: number, v: number): Titik => [pusat[0] + kanan[0] * u, pusat[1] + v, pusat[2] + kanan[2] * u];
    return [t(-lebar / 2, -tinggi / 2), t(lebar / 2, -tinggi / 2), t(lebar / 2, tinggi / 2), t(-lebar / 2, tinggi / 2)];
  };

  let sasaran: { l: Benda; tegak: number; t: number; pusat: Titik } | null = null;
  for (const l of semua) {
    if (l.jenis !== 'layar' || ruangDari(ruang, l.x) !== ri) continue;
    const rl = (l.rot * Math.PI) / 180, n = [Math.sin(rl), 0, Math.cos(rl)];
    const pusat = keDunia(l, [0, l.h / 2, l.d / 2]);
    const dx = asal[0] - pusat[0], dz = asal[2] - pusat[2];
    const tegak = dx * n[0] + dz * n[2];
    if (tegak < 0.3) continue;
    const cos = (-dx * maju[0] - dz * maju[1]) / Math.max(1e-6, Math.hypot(dx, dz));
    if (cos < Math.cos((50 * Math.PI) / 180)) continue;
    const dn = D[0] * n[0] + D[2] * n[2];
    if (dn > -0.2) continue;
    const t = -tegak / dn;
    if (!sasaran || tegak < sasaran.tegak) sasaran = { l, tegak, t, pusat };
  }
  if (sasaran) {
    const { l, t, pusat: S } = sasaran;
    const rl = (l.rot * Math.PI) / 180;
    const lebar = t / tr, tinggi = lebar * (l.h / Math.max(0.01, l.w));
    const kanan: Titik = [Math.cos(rl), 0, -Math.sin(rl)];
    //  Sedikit di depan kain layar supaya tidak berkedip (z-fighting).
    const pusat: Titik = [
      asal[0] + D[0] * t + Math.sin(rl) * 0.004 + kananP[0] * lebar * geserH,
      asal[1] + D[1] * t + naikTurun * tinggi * offV,
      asal[2] + D[2] * t + Math.cos(rl) * 0.004 + kananP[2] * lebar * geserH,
    ];
    const selisihH = (pusat[0] - S[0]) * kanan[0] + (pusat[2] - S[2]) * kanan[2];
    return {
      asal, sudut: persegi(pusat, kanan, lebar, tinggi), layar: l, jarak: t, lebar, tinggi,
      trPas: t / Math.max(0.01, l.w), selisihV: pusat[1] - S[1], selisihH,
    };
  }
  const k = daftarRuang(ruang)[ri] ?? daftarRuang(ruang)[0];
  const ke = (v: number, a: number, lo: number, hi: number) => (a > 1e-6 ? (hi - v) / a : a < -1e-6 ? (lo - v) / a : Infinity);
  const jarak = Math.min(15, Math.max(0.3, Math.min(ke(asal[0], D[0], k.x0, k.x0 + k.p), ke(asal[2], D[2], 0, k.l), ke(asal[1], D[1], 0, k.t)) - 0.005));
  const lebar = jarak / tr, tinggi = (lebar * 9) / 16;
  const pusat: Titik = [asal[0] + D[0] * jarak + kananP[0] * lebar * geserH, asal[1] + D[1] * jarak + naikTurun * tinggi * offV, asal[2] + D[2] * jarak + kananP[2] * lebar * geserH];
  return { asal, sudut: persegi(pusat, [Math.cos(r), 0, -Math.sin(r)], lebar, tinggi), layar: null, jarak, lebar, tinggi, trPas: null, selisihV: null, selisihH: null };
}
/** Layar proyektor terdekat di ruang yang sama (tanpa syarat arah). */
export function layarTerdekat(p: Benda, semua: Benda[], ruang: Ruang): Benda | null {
  const ri = ruangDari(ruang, p.x);
  return semua.filter(l => l.jenis === 'layar' && ruangDari(ruang, l.x) === ri)
    .reduce<Benda | null>((m, l) => (!m || Math.hypot(l.x - p.x, l.z - p.z) < Math.hypot(m.x - p.x, m.z - p.z) ? l : m), null);
}
/**
 * Tilt agar pusat gambar tepat setinggi pusat layar (posisi & pan tidak
 * diubah). Dicari bertahap (bisection) karena tinggi pusat gambar naik
 * monoton bersama tilt.
 */
export function tiltKeLayar(p: Benda, l: Benda, ruang: Ruang): Benda {
  let lo = -60, hi = 45;
  for (let i = 0; i < 40; i++) {
    const mid = (lo + hi) / 2;
    const coba = { ...p, tilt: mid };
    const sv = sinarProyektor(coba, [l, coba], ruang).selisihV;
    if (sv === null) break;
    if (sv > 0) hi = mid; else lo = mid;
  }
  return { ...p, tilt: Math.round(((lo + hi) / 2) * 10) / 10 };
}
/**
 * Pindahkan proyektor ke jarak lempar ideal (throw ratio x lebar layar) di
 * garis tengah layar, menghadap layar (pan), lalu atur tilt supaya gambar
 * tepat di tengah layar. Ketinggian pemasangan tidak diubah.
 */
export function proyektorKeLayar(p: Benda, l: Benda, k: Kotak, ruang: Ruang): Benda {
  const rl = (l.rot * Math.PI) / 180;
  const n = [Math.sin(rl), Math.cos(rl)];
  const ideal = throwRatioDari(p) * l.w;
  const S = keDunia(l, [0, l.h / 2, l.d / 2]);
  const rot = (((l.rot + 180) % 360) + 360) % 360;
  const taruh = (q: Benda, jarak: number): Benda => {
    //  Titik benda = posisi lensa yang diinginkan - offset lensa (dengan tilt q) pada rotasi ini.
    const [ox, , oz] = keDunia({ ...q, rot, x: 0, z: 0, elev: 0 }, lensaProyektor(q));
    return { ...q, rot, x: S[0] + n[0] * jarak - ox, z: S[2] + n[1] * jarak - oz };
  };
  let q = taruh({ ...p, tilt: 0 }, ideal);
  let jarakTegak = ideal;
  for (let i = 0; i < 4; i++) {
    q = tiltKeLayar(q, l, ruang);
    const sn = sinarProyektor(q, [l, q], ruang);
    if (!sn.layar) break;
    //  Jarak sepanjang sumbu lensa sedikit lebih panjang bila menunduk - koreksi jarak tegaknya.
    jarakTegak += (ideal - sn.jarak) * Math.cos((tiltDari(q) * Math.PI) / 180);
    q = taruh(q, jarakTegak);
  }
  q = tiltKeLayar(q, l, ruang);
  return { ...q, x: bulat2(Math.min(k.x0 + k.p - 0.1, Math.max(k.x0 + 0.1, q.x))), z: bulat2(Math.min(k.l - 0.1, Math.max(0.1, q.z))) };
}
