/**
 * desain3d/inti/audio.ts - Speaker: tipe, sudut sebaran, jangkauan, line array, cakupan speaker plafon.
 * Murni: tanpa three.js / React / DOM (diuji di uji/desain3d.ts).
 */
import { barisTribun } from './produk';
import type { Benda, TipeSpeaker, Titik } from './tipe';

/** Tinggi telinga/mata penonton duduk (m) - acuan cakupan speaker. */
export const TINGGI_DENGAR = 1.2;
export const tipeSpeakerDari = (b: Benda): TipeSpeaker => b.tipeSpeaker ?? 'kotak';
export const modulLA = (b: Benda) => Math.max(1, Math.min(24, Math.round(b.modul ?? 2)));
export const sudutModulLA = (b: Benda) => Math.max(0, Math.min(15, b.sudutModul ?? 0));
export const tiltLADari = (b: Benda) => Math.max(-30, Math.min(60, b.tiltLA ?? 0));
/** Sudut sebaran horizontal speaker (derajat, penuh) - datasheet; bawaan per tipe bila tidak diisi. */
export const sebaranSpeaker = (b: Benda) => Math.min(180, Math.max(10, b.sebaran ?? (b.jenis === 'speaker-plafon' ? 110
  : ({ kotak: 90, dinding6: 90, kolom: 120, linearray: 100 } as const)[tipeSpeakerDari(b)])));
/** Sudut sebaran vertikal. Line array: per modul (bawaan 10°); lainnya: sama dengan horizontal, kolom 30°. */
export const sebaranVSpeaker = (b: Benda) => Math.min(180, Math.max(4, b.sebaranV ?? (b.jenis === 'speaker-plafon' ? sebaranSpeaker(b)
  : ({ kotak: sebaranSpeaker(b), dinding6: sebaranSpeaker(b), kolom: 30, linearray: 10 } as const)[tipeSpeakerDari(b)])));
/** Jangkauan suara yang digambar (m); bawaan per tipe bila tidak diisi. */
export const jangkauanDari = (b: Benda) => Math.min(60, Math.max(0.5, b.jangkauan ?? ({ kotak: 8, dinding6: 10, kolom: 25, linearray: 40 } as const)[tipeSpeakerDari(b)]));
/**
 * Tinggi lantai tempat penonton berdiri / duduk di (x, z): baris tribun (tiap baris naik setinggi anak tangganya)
 * atau panggung, selain itu lantai ruang (0). Meja & objek tidak dihitung - penonton duduk di sampingnya.
 */
export function lantaiPenontonDi(benda: Benda[], x: number, z: number): number {
  let tinggi = 0;
  for (const t of benda) {
    if (t.jenis !== 'tribun' && t.jenis !== 'panggung') continue;
    const r = (t.rot * Math.PI) / 180, dx = x - t.x, dz = z - t.z;
    const lx = dx * Math.cos(r) - dz * Math.sin(r), lz = dx * Math.sin(r) + dz * Math.cos(r);
    if (Math.abs(lx) > t.w / 2 || Math.abs(lz) > t.d / 2) continue;
    if (t.jenis === 'panggung') { tinggi = Math.max(tinggi, t.elev + t.h); continue; }
    //  Rumus yang sama dengan kursiTribun: baris 0 di depan (lz = +d/2), riser = (h - 0,95) / (n - 1).
    const n = barisTribun(t), riser = n > 1 ? Math.max(0, (t.h - 0.95) / (n - 1)) : 0;
    const i = Math.min(n - 1, Math.max(0, Math.floor((t.d / 2 - lz) / (t.d / n))));
    tinggi = Math.max(tinggi, t.elev + i * riser);
  }
  return tinggi;
}

/**
 * Tinggi telinga penonton yang "dilihat" speaker `b` di titik (x, z): lantai penonton TERTINGGI selebar sebaran
 * horizontalnya di jarak itu (bukan hanya tepat di bawah sumbu) + tinggi dengar. Line array yang dipasang di sisi
 * tribun sumbunya lewat di atas lorong - tanpa ini tribun di sampingnya dianggap lantai biasa.
 */
export function telingaPenonton(benda: Benda[], b: Benda): (x: number, z: number) => number {
  const r = (b.rot * Math.PI) / 180, kx = -Math.cos(r), kz = Math.sin(r), tanH = Math.tan(((Math.min(170, sebaranSpeaker(b)) / 2) * Math.PI) / 180);
  //  Hanya benda yang bisa jadi lantai penonton - fungsi ini dipanggil ribuan kali per gambar (tiap langkah sumbu).
  const alas = benda.filter(x => x.jenis === 'tribun' || x.jenis === 'panggung');
  return (x, z) => {
    const lebar = Math.hypot(x - b.x, z - b.z) * tanH;
    let t = 0;
    if (alas.length) for (let s = -1; s <= 1.0001; s += 0.125) t = Math.max(t, lantaiPenontonDi(alas, x + kx * lebar * s, z + kz * lebar * s));
    return t + TINGGI_DENGAR;
  };
}

/** Ruang tempat sumbu berkas boleh berjalan + tinggi telinga penonton di tiap titik lantai. */
export interface RuangDengar { x0: number; x1: number; z0: number; z1: number; t: number; telinga: (x: number, z: number) => number }

export interface BerkasLA {
  asal: Titik; arah: Titik;
  /** Titik sumbu mendarat: di telinga penonton, atau di dinding / plafon / lantai bila `dinding`. */ jatuh: Titik | null;
  /** Jarak datar speaker -> titik jatuh (m). */ jarak: number | null;
  /** Sumbu menabrak dinding / plafon sebelum sampai ke telinga penonton (hanya bila `ruang` diberikan). */ dinding?: boolean;
}

/**
 * Berkas suara tiap modul line array (dunia): titik pancar di muka modul, arah sumbunya
 * (mengikuti kemiringan atas + sudut antar modul), dan titik jatuh sumbu di tinggi telinga
 * (null bila sumbu tidak turun ke tinggi itu). Dipakai untuk menggambar jangkauan per modul.
 * Dengan `ruang`: telinga mengikuti lantai penonton (tribun, panggung) & sumbu berhenti di dinding / plafon -
 * tanpa itu modul teratas yang hampir mendatar "menjangkau 72 m" di auditorium sepanjang 20 m.
 */
export function berkasLineArray(b: Benda, ruang?: RuangDengar): BerkasLA[] {
  const n = modulLA(b), hm = b.h / n, r = (b.rot * Math.PI) / 180;
  const maju: Titik = [Math.sin(r), 0, Math.cos(r)];
  const hasil: BerkasLA[] = [];
  //  Engsel di tepi depan-atas tiap modul (lihat buatModel 'linearray'): y lokal turun, z lokal mundur.
  let y = b.h, z = b.d / 2;
  for (let i = 0; i < n; i++) {
    const a = ((tiltLADari(b) + i * sudutModulLA(b)) * Math.PI) / 180;
    const yTengah = y - (hm / 2) * Math.cos(a), zTengah = z - (hm / 2) * Math.sin(a);
    const asal: Titik = [b.x + maju[0] * zTengah, b.elev + yTengah, b.z + maju[2] * zTengah];
    const arah: Titik = [maju[0] * Math.cos(a), -Math.sin(a), maju[2] * Math.cos(a)];
    let jatuh: Titik | null = null, jarak: number | null = null;
    if (ruang) {
      const j = jatuhDiRuang(asal, arah, ruang);
      if (j) hasil.push({ asal, arah, jatuh: j.titik, jarak: Math.hypot(j.titik[0] - b.x, j.titik[2] - b.z), dinding: j.dinding });
      else hasil.push({ asal, arah, jatuh: null, jarak: null });
    } else {
      if (arah[1] < -1e-3 && asal[1] > TINGGI_DENGAR) {
        const t = (asal[1] - TINGGI_DENGAR) / -arah[1];
        jatuh = [asal[0] + arah[0] * t, TINGGI_DENGAR, asal[2] + arah[2] * t];
        jarak = Math.hypot(jatuh[0] - b.x, jatuh[2] - b.z);
      }
      hasil.push({ asal, arah, jatuh, jarak });
    }
    y -= hm * Math.cos(a); z -= hm * Math.sin(a);
  }
  return hasil;
}
/**
 * Telusuri sumbu dari `asal` (langkah 10 cm, lalu dibagi dua 6x ±2 mm) sampai turun ke telinga penonton
 * (`dinding` false) atau keluar dari ruang - dinding, plafon, lantai (`dinding` true). Null bila tidak keduanya
 * dalam 80 m (mis. speaker di luar ruang).
 */
function jatuhDiRuang(asal: Titik, arah: Titik, R: RuangDengar): { titik: Titik; dinding: boolean } | null {
  const di = (s: number): Titik => [asal[0] + arah[0] * s, asal[1] + arah[1] * s, asal[2] + arah[2] * s];
  const keluar = (p: Titik) => p[0] < R.x0 || p[0] > R.x1 || p[2] < R.z0 || p[2] > R.z1 || p[1] > R.t || p[1] < 0;
  const dengar = (p: Titik) => p[1] <= R.telinga(p[0], p[2]);
  //  Di sisi telinga sejak awal (speaker lantai / sumbu mendatar setinggi telinga): tidak ada titik jatuh.
  if (dengar(asal) || keluar(asal)) return null;
  for (let s = 0.1; s <= 80; s += 0.1) {
    const p = di(s), luar = keluar(p);
    if (!luar && !dengar(p)) continue;
    let a = s - 0.1, c = s;
    for (let k = 0; k < 6; k++) {
      const m = (a + c) / 2, q = di(m);
      if (keluar(q) || dengar(q)) c = m; else a = m;
    }
    const t = di(c);
    return { titik: t, dinding: keluar(t) || !dengar(t) };
  }
  return null;
}

/** Jari-jari cakupan speaker plafon di tinggi dengar (m). */
export const cakupanSpeakerPlafon = (b: Benda) => Math.max(0, b.elev - TINGGI_DENGAR) * Math.tan((sebaranSpeaker(b) / 2) * Math.PI / 180);
