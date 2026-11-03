
interface Isi { sampai: number; nilai: Promise<unknown> }

const simpanan = new Map<string, Isi>();
const BATAS_ISI = 1000;

export function simpanSebentar<T>(kunci: string, ttlMs: number, ambil: () => Promise<T>, sekarang = Date.now()): Promise<T> {
  const ada = simpanan.get(kunci);
  if (ada && ada.sampai > sekarang) return ada.nilai as Promise<T>;
  const nilai = ambil();
  simpanan.set(kunci, { sampai: sekarang + ttlMs, nilai });
  nilai.catch(() => { if (simpanan.get(kunci)?.nilai === nilai) simpanan.delete(kunci); });
  if (simpanan.size > BATAS_ISI) {
    for (const [k, v] of simpanan) if (v.sampai <= sekarang) simpanan.delete(k);
    if (simpanan.size > BATAS_ISI) simpanan.clear();
  }
  return nilai;
}

export const hapusSimpanan = (kunci: string) => { simpanan.delete(kunci); };

export const kosongkanSimpanan = () => simpanan.clear();
