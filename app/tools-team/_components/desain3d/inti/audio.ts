/**
 * desain3d/inti/audio.ts - Speaker: tipe, sudut sebaran, jangkauan, line array, cakupan speaker plafon.
 * Murni: tanpa three.js / React / DOM (diuji di uji/desain3d.ts).
 */
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
 * Berkas suara tiap modul line array (dunia): titik pancar di muka modul, arah sumbunya
 * (mengikuti kemiringan atas + sudut antar modul), dan titik jatuh sumbu di tinggi telinga
 * (null bila sumbu tidak turun ke tinggi itu). Dipakai untuk menggambar jangkauan per modul.
 */
export function berkasLineArray(b: Benda): { asal: Titik; arah: Titik; jatuh: Titik | null; jarak: number | null }[] {
  const n = modulLA(b), hm = b.h / n, r = (b.rot * Math.PI) / 180;
  const maju: Titik = [Math.sin(r), 0, Math.cos(r)];
  const hasil: { asal: Titik; arah: Titik; jatuh: Titik | null; jarak: number | null }[] = [];
  //  Engsel di tepi depan-atas tiap modul (lihat buatModel 'linearray'): y lokal turun, z lokal mundur.
  let y = b.h, z = b.d / 2;
  for (let i = 0; i < n; i++) {
    const a = ((tiltLADari(b) + i * sudutModulLA(b)) * Math.PI) / 180;
    const yTengah = y - (hm / 2) * Math.cos(a), zTengah = z - (hm / 2) * Math.sin(a);
    const asal: Titik = [b.x + maju[0] * zTengah, b.elev + yTengah, b.z + maju[2] * zTengah];
    const arah: Titik = [maju[0] * Math.cos(a), -Math.sin(a), maju[2] * Math.cos(a)];
    let jatuh: Titik | null = null, jarak: number | null = null;
    if (arah[1] < -1e-3 && asal[1] > TINGGI_DENGAR) {
      const t = (asal[1] - TINGGI_DENGAR) / -arah[1];
      jatuh = [asal[0] + arah[0] * t, TINGGI_DENGAR, asal[2] + arah[2] * t];
      jarak = Math.hypot(jatuh[0] - b.x, jatuh[2] - b.z);
    }
    hasil.push({ asal, arah, jatuh, jarak });
    y -= hm * Math.cos(a); z -= hm * Math.sin(a);
  }
  return hasil;
}
/** Jari-jari cakupan speaker plafon di tinggi dengar (m). */
export const cakupanSpeakerPlafon = (b: Benda) => Math.max(0, b.elev - TINGGI_DENGAR) * Math.tan((sebaranSpeaker(b) / 2) * Math.PI / 180);
