/**
 * Tekstur gambar sendiri untuk lantai & dinding (foto granit, karpet motif, wallpaper, panel akustik...).
 *
 * Ruang hanya menyimpan { kunci, ubin }; gambarnya (data URL JPEG kecil) disimpan sekali di data.tekstur[kunci]
 * dan dibaca lewat peta di memori. Ubin = ukuran satu gambar di ruangan (m) - gambar diulang (tile) dengan
 * UV dalam meter, jadi tidak melar saat ruangan diperbesar. Murni (diuji di uji/desain3d-tekstur.ts).
 */
import type { Ruang, TeksturRuang } from './tipe';

export const POLA_KUNCI_TEKSTUR = /^tx-[a-z0-9]{6,32}$/;
export const UBIN_MIN = 0.1, UBIN_MAKS = 20, UBIN_AWAL_LANTAI = 1, UBIN_AWAL_DINDING = 2;

export const kunciTeksturBaru = () => `tx-${Math.random().toString(36).slice(2, 10)}${Date.now().toString(36)}`;

export const ubinSah = (v: unknown, awal = UBIN_AWAL_LANTAI): number => {
  const n = typeof v === 'number' && Number.isFinite(v) ? v : awal;
  return Math.min(UBIN_MAKS, Math.max(UBIN_MIN, Math.round(n * 100) / 100));
};

/** Tekstur yang sah, atau undefined (kunci rusak / asing diabaikan -> lantai / dinding biasa). */
export function teksturSah(t: unknown, awalUbin = UBIN_AWAL_LANTAI): TeksturRuang | undefined {
  const o = t as Partial<TeksturRuang> | null | undefined;
  if (!o || typeof o.kunci !== 'string' || !POLA_KUNCI_TEKSTUR.test(o.kunci)) return undefined;
  return { kunci: o.kunci, ubin: ubinSah(o.ubin, awalUbin) };
}

/** Kunci gambar tekstur yang benar-benar dipakai ruang (yang perlu ikut disimpan). */
export function kunciTeksturDipakai(r: Pick<Ruang, 'teksturLantai' | 'teksturDinding'>): string[] {
  const k = [teksturSah(r.teksturLantai)?.kunci, teksturSah(r.teksturDinding)?.kunci].filter((x): x is string => !!x);
  return Array.from(new Set(k));
}

/** Pengulangan gambar pada bidang selebar w × tinggi h (m) untuk ubin `ubin` (m). */
export const ulangTekstur = (w: number, h: number, ubin: number): [number, number] => [w / ubinSah(ubin), h / ubinSah(ubin)];
