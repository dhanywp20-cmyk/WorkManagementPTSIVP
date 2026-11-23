export interface RuangLED {
  lebar: number;
  tinggi: number;
  elevasi: number;
}

export const RUANG_AWAL: RuangLED = { lebar: 6, tinggi: 3.2, elevasi: 0.9 };

const angka = (v: unknown, min: number, maks: number, awal: number) =>
  typeof v === 'number' && Number.isFinite(v) ? Math.min(maks, Math.max(min, v)) : awal;

export function bersihkanRuang(v: unknown): RuangLED {
  const r = (v && typeof v === 'object' ? v : {}) as Partial<RuangLED>;
  return {
    lebar: angka(r.lebar, 0.5, 200, RUANG_AWAL.lebar),
    tinggi: angka(r.tinggi, 0.5, 60, RUANG_AWAL.tinggi),
    elevasi: angka(r.elevasi, 0, 40, RUANG_AWAL.elevasi),
  };
}
