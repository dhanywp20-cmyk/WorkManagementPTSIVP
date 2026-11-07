import type { IsiTemplateKategori } from '../aksi/useAksiDesain';
import type { KategoriRuang } from '../inti';

export const KATEGORI_AWAL: KategoriRuang = 'meeting';

const KUNCI = 'wm_desain3d_awal_v1';

export type IngatanAwal = { updated_at: string; isi: IsiTemplateKategori } | { kosong: true };

export function bacaIngatanAwal(): IngatanAwal | null {
  try {
    const s = localStorage.getItem(KUNCI);
    if (!s) return null;
    const v = JSON.parse(s) as Partial<{ updated_at: string; isi: IsiTemplateKategori; kosong: boolean }>;
    if (v.kosong === true) return { kosong: true };
    const isi = v.isi;
    if (typeof v.updated_at === 'string' && isi && typeof isi.nama === 'string' && isi.ruang && Array.isArray(isi.benda)) {
      return { updated_at: v.updated_at, isi };
    }
  } catch {  }
  return null;
}

export function tulisIngatanAwal(v: IngatanAwal): void {
  try { localStorage.setItem(KUNCI, JSON.stringify(v)); } catch {  }
}

export const isiDariIngatan = (v: IngatanAwal | null): IsiTemplateKategori | null => (v && 'isi' in v ? v.isi : null);
