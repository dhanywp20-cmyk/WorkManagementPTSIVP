/** Power Connection: pengaturan, data, susunan sirkuit MCB per fase (murni, tanpa React). */
import { type HasilDayaLED, hitungDayaLED, type SudutMulai } from '@/lib/av-hitung';

/** Pengaturan power connection (disimpan bersama hitungan LED, ikut undo/redo). */
export interface PengaturanDaya {
  fase: 1 | 3; mcb: number; beban: number;
  mulai: SudutMulai; arah: 'horizontal' | 'vertikal'; pola: 'S' | 'Z';
  /** Panjang kabel tiap sirkuit dari panel ke layar (m). */ panjang: number;
}

export const DAYA_AWAL: PengaturanDaya = { fase: 1, mcb: 16, beban: 80, mulai: 'kiri-bawah', arah: 'vertikal', pola: 'S', panjang: 15 };

export const MCB_SIRKUIT = [10, 16, 20, 25, 32];

export function bersihkanDaya(x: unknown): PengaturanDaya {
  const o = (x && typeof x === 'object' && !Array.isArray(x) ? x : {}) as Record<string, unknown>;
  const pilih = <T extends string | number>(v: unknown, sah: readonly T[], awal: T): T => (sah.includes(v as T) ? (v as T) : awal);
  const angka = (v: unknown, min: number, maks: number, awal: number) => (typeof v === 'number' && Number.isFinite(v) ? Math.min(maks, Math.max(min, v)) : awal);
  const A = DAYA_AWAL;
  return {
    fase: pilih(o.fase, [1, 3] as const, A.fase),
    mcb: pilih(o.mcb, MCB_SIRKUIT, A.mcb),
    beban: Math.round(angka(o.beban, 10, 100, A.beban)),
    mulai: pilih(o.mulai, ['kiri-atas', 'kanan-atas', 'kiri-bawah', 'kanan-bawah'] as const, A.mulai),
    arah: pilih(o.arah, ['horizontal', 'vertikal'] as const, A.arah),
    pola: pilih(o.pola, ['S', 'Z'] as const, A.pola),
    panjang: angka(o.panjang, 1, 500, A.panjang),
  };
}

/** Data layar dari kalkulator. */
export interface DataDaya {
  kolom: number; baris: number; wUnit: number; hUnit: number; satuan: 'modul' | 'cabinet';
  /** W maks per unit. */ wattUnit: number; tegangan: number; faktorDaya: number;
}

export const susunDaya = (d: DataDaya, s: PengaturanDaya): HasilDayaLED => hitungDayaLED({
  kolom: d.kolom, baris: d.baris, wattUnit: d.wattUnit, tegangan: d.tegangan, faktorDaya: d.faktorDaya,
  mcb: s.mcb, beban: s.beban, fase: s.fase, mulai: s.mulai, arah: s.arah, pola: s.pola,
});

export const WARNA_FASE: Record<string, string> = { L: '#334155', R: '#dc2626', S: '#ca8a04', T: '#2563eb' };
