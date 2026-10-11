/**
 * Ingatan perangkat untuk kanvas AWAL Desain 3D (kategori Ruangan Meeting).
 *
 * Masalah yang ditutup: dulu kanvas selalu dibuka dengan template pabrikan, lalu setelah dua
 * permintaan server baru diganti default Admin - terlihat "freeze" lalu melompat. Sekarang isi
 * default Admin terakhir disimpan di perangkat; kanvas langsung dibuka dengan isi itu, server cuma
 * dicek di belakang (bila Admin mengubah / mengembalikan bawaan, kanvas mengikuti).
 *
 *   { updated_at, isi }   kategori awal punya default Admin
 *   { kosong: true }      sudah dicek: tidak ada default Admin (pakai bawaan pabrikan)
 *   null                  belum pernah dicek di perangkat ini -> kanvas ditutup lapisan "Memuat"
 *
 * Penyimpanan peramban bisa ditolak (mode privat) - semua akses dibungkus try/catch dan halaman tetap
 * berjalan tanpa ingatan ini.
 */
import type { IsiTemplateKategori } from '../aksi/useAksiDesain';
import type { KategoriRuang } from '../inti';

/** Kategori yang isinya tampil saat Desain 3D pertama dibuka (contohAwal = template Ruangan Meeting). */
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
  } catch { /* ingatan rusak / ditolak: anggap belum pernah dicek */ }
  return null;
}

export function tulisIngatanAwal(v: IngatanAwal): void {
  try { localStorage.setItem(KUNCI, JSON.stringify(v)); } catch { /* penuh / ditolak: abaikan */ }
}

/** Isi template dari ingatan, atau null (belum dicek / tidak ada default Admin). */
export const isiDariIngatan = (v: IngatanAwal | null): IsiTemplateKategori | null => (v && 'isi' in v ? v.isi : null);
