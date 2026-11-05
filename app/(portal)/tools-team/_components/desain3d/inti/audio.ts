import { barisTribun } from './produk';
import type { Benda, TipeSpeaker, Titik } from './tipe';

export const TINGGI_DENGAR = 1.2;
export const tipeSpeakerDari = (b: Benda): TipeSpeaker => b.tipeSpeaker ?? 'kotak';
export const modulLA = (b: Benda) => Math.max(1, Math.min(24, Math.round(b.modul ?? 2)));
export const sudutModulLA = (b: Benda) => Math.max(0, Math.min(15, b.sudutModul ?? 0));
export const tiltLADari = (b: Benda) => Math.max(-30, Math.min(60, b.tiltLA ?? 0));
export const sebaranSpeaker = (b: Benda) => Math.min(180, Math.max(10, b.sebaran ?? (b.jenis === 'speaker-plafon' ? 110
  : ({ kotak: 90, dinding6: 90, kolom: 120, linearray: 100 } as const)[tipeSpeakerDari(b)])));
export const sebaranVSpeaker = (b: Benda) => Math.min(180, Math.max(4, b.sebaranV ?? (b.jenis === 'speaker-plafon' ? sebaranSpeaker(b)
  : ({ kotak: sebaranSpeaker(b), dinding6: sebaranSpeaker(b), kolom: 30, linearray: 10 } as const)[tipeSpeakerDari(b)])));
export const jangkauanDari = (b: Benda) => Math.min(60, Math.max(0.5, b.jangkauan ?? ({ kotak: 8, dinding6: 10, kolom: 25, linearray: 40 } as const)[tipeSpeakerDari(b)]));
export function lantaiPenontonDi(benda: Benda[], x: number, z: number): number {
  let tinggi = 0;
  for (const t of benda) {
    if (t.jenis !== 'tribun' && t.jenis !== 'panggung') continue;
    const r = (t.rot * Math.PI) / 180, dx = x - t.x, dz = z - t.z;
    const lx = dx * Math.cos(r) - dz * Math.sin(r), lz = dx * Math.sin(r) + dz * Math.cos(r);
    if (Math.abs(lx) > t.w / 2 || Math.abs(lz) > t.d / 2) continue;
    if (t.jenis === 'panggung') { tinggi = Math.max(tinggi, t.elev + t.h); continue; }
    const n = barisTribun(t), riser = n > 1 ? Math.max(0, (t.h - 0.95) / (n - 1)) : 0;
    const i = Math.min(n - 1, Math.max(0, Math.floor((t.d / 2 - lz) / (t.d / n))));
    tinggi = Math.max(tinggi, t.elev + i * riser);
  }
  return tinggi;
}

export function telingaPenonton(benda: Benda[], b: Benda): (x: number, z: number) => number {
  const r = (b.rot * Math.PI) / 180, kx = -Math.cos(r), kz = Math.sin(r), tanH = Math.tan(((Math.min(170, sebaranSpeaker(b)) / 2) * Math.PI) / 180);
  const alas = benda.filter(x => x.jenis === 'tribun' || x.jenis === 'panggung');
  return (x, z) => {
    const lebar = Math.hypot(x - b.x, z - b.z) * tanH;
    let t = 0;
    if (alas.length) for (let s = -1; s <= 1.0001; s += 0.125) t = Math.max(t, lantaiPenontonDi(alas, x + kx * lebar * s, z + kz * lebar * s));
    return t + TINGGI_DENGAR;
  };
}

export interface RuangDengar { x0: number; x1: number; z0: number; z1: number; t: number; telinga: (x: number, z: number) => number }

export interface BerkasLA {
  asal: Titik; arah: Titik;
   jatuh: Titik | null;
   jarak: number | null;
   dinding?: boolean;
}

export function berkasLineArray(b: Benda, ruang?: RuangDengar): BerkasLA[] {
  const n = modulLA(b), hm = b.h / n, r = (b.rot * Math.PI) / 180;
  const maju: Titik = [Math.sin(r), 0, Math.cos(r)];
  const hasil: BerkasLA[] = [];
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
function jatuhDiRuang(asal: Titik, arah: Titik, R: RuangDengar): { titik: Titik; dinding: boolean } | null {
  const di = (s: number): Titik => [asal[0] + arah[0] * s, asal[1] + arah[1] * s, asal[2] + arah[2] * s];
  const keluar = (p: Titik) => p[0] < R.x0 || p[0] > R.x1 || p[2] < R.z0 || p[2] > R.z1 || p[1] > R.t || p[1] < 0;
  const dengar = (p: Titik) => p[1] <= R.telinga(p[0], p[2]);
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

export const cakupanSpeakerPlafon = (b: Benda) => Math.max(0, b.elev - TINGGI_DENGAR) * Math.tan((sebaranSpeaker(b) / 2) * Math.PI / 180);
