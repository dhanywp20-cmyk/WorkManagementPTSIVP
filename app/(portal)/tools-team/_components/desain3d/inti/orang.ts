export const TINGGI_ORANG_AWAL = 1.7;
export const TINGGI_ORANG_MIN = 0.5;
export const TINGGI_ORANG_MAKS = 2.5;
export const PRESET_TINGGI_ORANG = [1.2, 1.5, 1.6, 1.7, 1.8, 1.9];

export const tinggiOrangSah = (h: unknown) =>
  typeof h === 'number' && Number.isFinite(h) ? Math.min(TINGGI_ORANG_MAKS, Math.max(TINGGI_ORANG_MIN, h)) : TINGGI_ORANG_AWAL;

const r3 = (v: number) => Math.round(v * 1000) / 1000;

export function ukuranOrang(tinggi: number) {
  const h = tinggiOrangSah(tinggi);
  return { h, w: r3(h * 0.3), d: r3(h * 0.16), nama: `Orang ${Math.round(h * 100)} cm` };
}

export const namaOrangOtomatis = (nama: string) => /^Orang \d+ cm$/.test(nama);
