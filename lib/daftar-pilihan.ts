/**
 * lib/daftar-pilihan.ts - daftar pilihan dropdown yang diatur Admin (Admin Panel › Daftar Pilihan),
 * dibaca dari app_settings. Aturan & nilai bawaan: lib/daftar-pilihan-bawaan.ts.
 *
 * Pola sama dengan lib/merek.ts: disimpan di module scope + sessionStorage (satu query per tab,
 * tanpa kedip nilai bawaan), pendengar memperbarui semua dropdown begitu Admin menyimpan.
 * Gagal memuat = nilai yang sedang berlaku dipertahankan; pengaturan tidak boleh menghalangi kerja.
 * Tulis dijaga RLS app_settings (boleh_tulis_pengaturan = Admin / lingkup semua).
 */
import { useEffect, useState } from 'react';
import { supabase } from './supabase';
import { bacaDaftarPilihan, bawaanSemua, KUNCI_DAFTAR_PILIHAN, type KunciDaftar, ringkasDaftarPilihan, type SemuaDaftar } from './daftar-pilihan-bawaan';

export * from './daftar-pilihan-bawaan';

const SIMPAN = 'ivp_daftar_pilihan';

function bacaSimpanan(): SemuaDaftar | null {
  if (typeof window === 'undefined') return null;
  try { const m = window.sessionStorage.getItem(SIMPAN); return m ? bacaDaftarPilihan(m) : null; } catch { return null; }
}
function tulisSimpanan(v: SemuaDaftar) {
  if (typeof window === 'undefined') return;
  try { window.sessionStorage.setItem(SIMPAN, JSON.stringify(v)); } catch { /* kuota penuh - abaikan */ }
}

let sekarang: SemuaDaftar = bacaSimpanan() ?? bawaanSemua();
const pendengar = new Set<() => void>();
const beriTahu = () => { for (const f of pendengar) f(); };
let pemuatan: Promise<void> | null = null;

/** Muat dari database (sekali per tab; panggilan bersamaan menunggu yang sama). */
export function muatDaftarPilihan(): Promise<void> {
  if (pemuatan) return pemuatan;
  pemuatan = (async () => {
    try {
      const { data, error } = await supabase.from('app_settings').select('value').eq('key', KUNCI_DAFTAR_PILIHAN).maybeSingle();
      if (error) return;
      sekarang = bacaDaftarPilihan(data?.value ?? null);
      tulisSimpanan(sekarang);
      beriTahu();
    } catch { /* pertahankan nilai yang sedang berlaku */ }
  })();
  return pemuatan;
}

/** Semua daftar yang sedang berlaku (di luar React, mis. ekspor Excel). Tidak pernah kosong. */
export const daftarPilihan = (k: KunciDaftar): string[] => sekarang[k];
export const semuaDaftarPilihan = (): SemuaDaftar => sekarang;

/** Simpan dari Admin Panel; hanya daftar yang berbeda dari bawaan yang ditulis. */
export async function simpanDaftarPilihan(semua: SemuaDaftar): Promise<{ error: string | null }> {
  const ringkas = ringkasDaftarPilihan(semua);
  const { error } = await supabase.from('app_settings')
    .upsert({ key: KUNCI_DAFTAR_PILIHAN, value: JSON.stringify(ringkas) }, { onConflict: 'key' });
  if (error) return { error: error.message };
  sekarang = bacaDaftarPilihan(ringkas);
  tulisSimpanan(sekarang);
  beriTahu();
  return { error: null };
}

/** Daftar pilihan untuk dropdown, ikut berubah saat Admin menyimpan. */
export function useDaftarPilihan(k: KunciDaftar): string[] {
  const [nilai, setNilai] = useState<string[]>(() => sekarang[k]);
  useEffect(() => {
    const segarkan = () => setNilai(sekarang[k]);
    pendengar.add(segarkan);
    void muatDaftarPilihan().then(segarkan);
    return () => { pendengar.delete(segarkan); };
  }, [k]);
  return nilai;
}
