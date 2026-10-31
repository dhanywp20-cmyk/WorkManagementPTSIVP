/**
 * desain3d/inti/jarakProyeksi.ts - Projection distance (L) proyektor seperti kalkulator Panasonic: diukur dari UJUNG
 * LENSA (bukan tengah badan) ke permukaan yang dituju lensa, dan bisa DIATUR - badan digeser supaya jaraknya tepat.
 *
 *  - Layar / bidang mapping DATAR: jarak TEGAK LURUS lensa ke bidang (= L Panasonic). Mengatur jarak menggeser proyektor
 *    tegak lurus bidang itu - posisi kiri-kanan & tinggi lensa tidak berubah.
 *  - Bidang lengkung / cembung, atau dinding & lantai ruang: jarak SEPANJANG SUMBU lensa ke titik yang dikenai. Mengatur
 *    jarak menggeser proyektor maju-mundur searah sumbunya - titik bidik di permukaan tetap.
 *
 * Murni (diuji di uji/desain3d-jarak-proyeksi.ts). Modul terpisah (bukan di proyektor.ts) supaya tidak membuat impor
 * melingkar proyektor -> cakupanProyektor -> blending -> proyektor.
 */
import { permukaanBenda } from './cakupanProyektor';
import { arahProyektor, keDunia, lensaProyektor, sinarProyektor } from './proyektor';
import { ruangDari } from './ruang';
import type { Benda, Ruang, Titik } from './tipe';

export interface JarakProyeksi {
  /** Meter dari ujung lensa; null = sumbu lensa tidak mengenai permukaan apa pun. */ jarak: number | null;
  /** Layar / bidang yang dituju; null = dinding / lantai / plafon ruang. */ sasaran: Benda | null;
  /** 'tegak' = tegak lurus bidang datar (L kalkulator Panasonic); 'sumbu' = sepanjang sumbu lensa ke titik kena. */ cara: 'tegak' | 'sumbu';
  /** Arah geser badan (dunia, satuan) agar jarak BERTAMBAH 1 m per 1 m geser. */ arah: Titik | null;
}

const datar = (l: Benda) => l.jenis === 'layar' || (l.jenis === 'bidang' && (l.bentukBidang ?? 'datar') === 'datar');

export function jarakProyeksi(p: Benda, semua: Benda[], ruang: Ruang | null): JarakProyeksi {
  const asal = keDunia(p, lensaProyektor(p));
  const D = arahProyektor(p);
  const ri = ruang ? ruangDari(ruang, p.x) : null;
  const diRuang = (l: Benda) => l.id !== p.id && (!ruang || ruangDari(ruang, l.x) === ri);
  /*
    Layar / bidang datar: BIDANG-nya yang dihitung, bukan perpotongan sumbu dengan bingkainya - dengan lens shift sumbu
    lensa boleh lewat di atas / samping layar (gambar digeser), dan L Panasonic tetap jarak tegak lurus ke bidang itu.
    Syaratnya sama dengan pemilihan layar sinar di kanvas (sinarProyektor): di depan lensa & lensa menghadapnya.
  */
  let tegakTerdekat: { l: Benda; tegak: number; n: Titik } | null = null;
  for (const l of semua) {
    if (!diRuang(l) || !datar(l)) continue;
    const rl = (l.rot * Math.PI) / 180;
    const n: Titik = [Math.sin(rl), 0, Math.cos(rl)];
    const muka = keDunia(l, [0, l.h / 2, l.jenis === 'layar' ? l.d / 2 : 0.02]);
    const tegak = (asal[0] - muka[0]) * n[0] + (asal[2] - muka[2]) * n[2];
    if (tegak < 0.05 || D[0] * n[0] + D[2] * n[2] > -0.2) continue;
    const dx = asal[0] - muka[0], dz = asal[2] - muka[2];
    const maju = [Math.sin((p.rot * Math.PI) / 180), Math.cos((p.rot * Math.PI) / 180)];
    if ((-dx * maju[0] - dz * maju[1]) / Math.max(1e-6, Math.hypot(dx, dz)) < Math.cos((50 * Math.PI) / 180)) continue;
    if (!tegakTerdekat || tegak < tegakTerdekat.tegak) tegakTerdekat = { l, tegak, n };
  }
  if (tegakTerdekat) return { jarak: tegakTerdekat.tegak, sasaran: tegakTerdekat.l, cara: 'tegak', arah: tegakTerdekat.n };
  //  Bidang lengkung / cembung: titik yang benar-benar dikenai sumbu lensa.
  let kena: { l: Benda; t: number } | null = null;
  for (const l of semua) {
    if (!diRuang(l) || l.jenis !== 'bidang' || datar(l)) continue;
    const t = permukaanBenda(l).kena(asal, D);
    if (t !== null && t > 0.02 && (!kena || t < kena.t)) kena = { l, t };
  }
  const mundur: Titik = [-D[0], -D[1], -D[2]];
  if (kena) return { jarak: kena.t, sasaran: kena.l, cara: 'sumbu', arah: mundur };
  if (!ruang) return { jarak: null, sasaran: null, cara: 'sumbu', arah: null };
  //  Tanpa layar / bidang: permukaan ruang yang dituju sumbu lensa (rumus yang sama dengan sinar di kanvas).
  return { jarak: sinarProyektor(p, [], ruang).jarak, sasaran: null, cara: 'sumbu', arah: mundur };
}

/**
 * Posisi badan baru agar projection distance = `L` (m). null bila sumbu lensa tidak mengenai permukaan apa pun.
 * Pemanggil tetap menjepit hasilnya ke dalam ruang (jepitProyektor) - bila terjepit, jarak yang tercapai lebih kecil.
 */
export function aturJarakProyeksi(p: Benda, semua: Benda[], ruang: Ruang | null, L: number): Pick<Benda, 'x' | 'z' | 'elev'> | null {
  const j = jarakProyeksi(p, semua, ruang);
  if (j.jarak === null || !j.arah) return null;
  const d = L - j.jarak;
  return { x: p.x + j.arah[0] * d, z: p.z + j.arah[2] * d, elev: p.elev + j.arah[1] * d };
}

/** Posisi badan agar UJUNG LENSA berada di koordinat yang diminta (sumbu yang tidak diisi tetap). */
export function posisiDariLensa(p: Benda, lensa: { x?: number; y?: number; z?: number }): Pick<Benda, 'x' | 'z' | 'elev'> {
  const [lx, ly, lz] = keDunia(p, lensaProyektor(p));
  return {
    x: p.x + (lensa.x === undefined ? 0 : lensa.x - lx),
    z: p.z + (lensa.z === undefined ? 0 : lensa.z - lz),
    elev: p.elev + (lensa.y === undefined ? 0 : lensa.y - ly),
  };
}
