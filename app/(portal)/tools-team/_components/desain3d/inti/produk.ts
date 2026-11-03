import { cabinetUntukUkuran, pikselUnit, ukuranDariDiagonal } from '@/lib/av-hitung';
import type { Benda, ModelVW, PanelVW, RasioLayar } from './tipe';
import { terapkanUkuranTeks } from './teks';

export const VIDEOWALL: Record<Exclude<ModelVW, 'custom'>, { nama: string; inci: number; w: number; h: number; d: number; bezelMm: number; wTipikal: number; wMaks: number }> = {
  '55BDL2105X': { nama: 'Philips 55BDL2105X', inci: 55, w: 1.2135, h: 0.6843, d: 0.0978, bezelMm: 3.5, wTipikal: 180, wMaks: 340 },
  '49BDL2105X': { nama: 'Philips 49BDL2105X', inci: 49, w: 1.0776, h: 0.6078, d: 0.0933, bezelMm: 3.5, wTipikal: 100, wMaks: 230 },
};
export const PANEL_VW_AWAL: PanelVW = { w: 1.2135, h: 0.6843, d: 0.0978, bezelMm: 3.5, resX: 1920, resY: 1080, wTipikal: 180, wMaks: 340 };
export function spekVideowall(b: Pick<Benda, 'vw' | 'panel'>): PanelVW & { nama: string; inci: number } {
  if (b.vw === 'custom') {
    const p = { ...PANEL_VW_AWAL, ...(b.panel ?? {}) };
    return { ...p, nama: 'Panel custom', inci: Math.round(Math.hypot(p.w, p.h) / 0.0254) };
  }
  const m = VIDEOWALL[b.vw ?? '55BDL2105X'] ?? VIDEOWALL['55BDL2105X'];
  return { ...m, resX: 1920, resY: 1080 };
}
export const IFP: Record<number, { w: number; h: number; d: number }> = {
  65: { w: 1.49, h: 0.898, d: 0.09 },
  75: { w: 1.712, h: 1.023, d: 0.09 },
  86: { w: 1.957, h: 1.166, d: 0.093 },
};
export const LAYAR_DIAG = [100, 120, 150, 200];
export const RAK_U = [12, 20, 27, 32, 42];
export const PITCH_LED = [1.25, 1.53, 1.86, 2, 2.5, 3, 3.84, 4, 5, 6, 8, 10];
export const tinggiRak = (u: number) => u * 0.04445 + 0.16;
export const IFP_DIAG = [65, 75, 86];
export const TV_DIAG = [55, 65, 75, 86];
export function ukuranIFP(diag: number): { w: number; h: number; d: number } {
  if (IFP[diag]) return IFP[diag];
  const u = ukuranDariDiagonal(diag);
  return { w: Math.round((u.lebarM + 0.06) * 1000) / 1000, h: Math.round((u.tinggiM + 0.06) * 1000) / 1000, d: 0.09 };
}
export const RASIO_LAYAR: RasioLayar[] = ['16:9', '16:10', '4:3', '21:9'];
export function ukuranLayar(diag: number, rasio: RasioLayar | string) {
  const [a, b] = (String(rasio).match(/^(\d+(?:\.\d+)?):(\d+(?:\.\d+)?)$/)?.slice(1).map(Number) ?? [16, 9]) as number[];
  const u = ukuranDariDiagonal(diag, a, b);
  return { w: u.lebarM, h: u.tinggiM };
}
export function ukuranGambarDisplay(d: Pick<Benda, 'jenis' | 'diag' | 'w' | 'h'>): { w: number; h: number } {
  if (d.jenis === 'tv' || d.jenis === 'ifp') {
    const u = ukuranDariDiagonal(d.diag ?? (d.jenis === 'tv' ? 65 : 75));
    return { w: Math.round(u.lebarM * 1000) / 1000, h: Math.round(u.tinggiM * 1000) / 1000 };
  }
  return { w: d.w, h: d.h };
}
export function susunanLED(b: Pick<Benda, 'w' | 'h' | 'pitch' | 'cabW' | 'cabH' | 'pxUnitX' | 'pxUnitY' | 'unitLED'>) {
  const cabW = Math.max(100, b.cabW ?? 500), cabH = Math.max(100, b.cabH ?? 500), pitch = Math.max(0.3, b.pitch ?? 2.5);
  const { kolom, baris } = cabinetUntukUkuran(b.w || cabW / 1000, b.h || cabH / 1000, cabW, cabH, 'round');
  const pxCabX = b.pxUnitX && b.pxUnitX > 0 ? Math.round(b.pxUnitX) : pikselUnit(cabW, pitch);
  const pxCabY = b.pxUnitY && b.pxUnitY > 0 ? Math.round(b.pxUnitY) : pikselUnit(cabH, pitch);
  return { kolom, baris, cabW, cabH, pitch, unit: b.unitLED ?? 'cabinet', pxCabX, pxCabY, resX: pxCabX * kolom, resY: pxCabY * baris, lebarM: (kolom * cabW) / 1000, tinggiM: (baris * cabH) / 1000 };
}
export const rapikanLED = (benda: Benda[]): Benda[] => benda.map(b => (b.jenis === 'led' ? terapkanUkuran(b) : b));
export function terapkanUkuran(b: Benda): Benda {
  switch (b.jenis) {
    case 'videowall': {
      const m = spekVideowall(b);
      const kol = Math.max(1, b.kol ?? 2), bar = Math.max(1, b.bar ?? 2);
      return { ...b, kol, bar, w: m.w * kol, h: m.h * bar, d: m.d };
    }
    case 'layar': { const u = ukuranLayar(b.diag ?? 120, b.rasio ?? '16:9'); return { ...b, w: u.w, h: u.h }; }
    case 'led': { const s = susunanLED(b); return { ...b, w: s.lebarM, h: s.tinggiM }; }
    case 'ifp': { const u = ukuranIFP(b.diag ?? 75); return { ...b, ...u }; }
    case 'tv': { const u = ukuranDariDiagonal(b.diag ?? 65); return { ...b, w: Math.round((u.lebarM + 0.024) * 1000) / 1000, h: Math.round((u.tinggiM + 0.024) * 1000) / 1000 }; }
    case 'rak': return { ...b, h: tinggiRak(b.rakU ?? 20) };
    case 'tribun': {
      const n = barisTribun(b), m = kursiTribunPerBaris(b), riser = Math.max(0.1, Math.min(1, b.tinggiAnak ?? 0.35));
      return { ...b, baris: n, kursiBaris: m, tinggiAnak: riser, w: Math.round((m * 0.55 + 0.6) * 100) / 100, d: Math.round(n * 0.9 * 100) / 100, h: Math.round(((n - 1) * riser + 0.95) * 100) / 100 };
    }
    case 'bidang': {
      const u = ukuranBidang(b);
      return { ...b, w: u.w, d: u.d };
    }
    case 'teks': return terapkanUkuranTeks(b);
    default: return b;
  }
}
export const barisTribun = (b: Benda) => Math.max(1, Math.min(60, Math.round(b.baris ?? 8)));
export const kursiTribunPerBaris = (b: Benda) => Math.max(1, Math.min(80, Math.round(b.kursiBaris ?? 12)));
export function ukuranBidang(b: Benda) {
  if (b.bentukBidang === 'datar') return { R: 0, busur: 0, w: Math.max(0.2, Math.min(60, b.w || 5)), d: 0.06 };
  const R = Math.max(0.2, Math.min(50, b.jariBidang ?? 4)), busur = Math.max(10, Math.min(360, b.busur ?? 90));
  const t = (busur * Math.PI) / 180;
  const w = busur >= 180 ? 2 * R : 2 * R * Math.sin(t / 2);
  const d = R * (1 - Math.cos(t / 2));
  return { R, busur, w: Math.round(Math.max(0.05, w) * 1000) / 1000, d: Math.round(Math.max(0.05, d) * 1000) / 1000 };
}
export function lengkungDari(lebar: number, kedalaman: number): { jariBidang: number; busur: number } {
  const c = Math.max(0.2, lebar), s = Math.max(0.01, Math.min(c / 2, kedalaman));
  const R = (c * c / 4 + s * s) / (2 * s);
  const busur = (2 * Math.asin(Math.min(1, c / (2 * R))) * 180) / Math.PI;
  return { jariBidang: Math.round(R * 1000) / 1000, busur: Math.round(busur * 100) / 100 };
}
export function kursiTribun(b: Benda): { x: number; z: number; y: number }[] {
  const n = barisTribun(b), m = kursiTribunPerBaris(b);
  const tD = b.d / n, riser = n > 1 ? Math.max(0, (b.h - 0.95) / (n - 1)) : 0, pitch = (b.w - 0.6) / m;
  const r = (b.rot * Math.PI) / 180, c = Math.cos(r), sn = Math.sin(r);
  const hasil: { x: number; z: number; y: number }[] = [];
  for (let i = 0; i < n; i++) for (let j = 0; j < m; j++) {
    const lx = -b.w / 2 + 0.3 + (j + 0.5) * pitch, lz = b.d / 2 - tD * (i + 0.5);
    hasil.push({ x: b.x + lx * c + lz * sn, z: b.z - lx * sn + lz * c, y: b.elev + i * riser + 0.45 });
  }
  return hasil;
}
