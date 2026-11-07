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
  try { window.sessionStorage.setItem(SIMPAN, JSON.stringify(v)); } catch {  }
}

let sekarang: SemuaDaftar = bacaSimpanan() ?? bawaanSemua();
const pendengar = new Set<() => void>();
const beriTahu = () => { for (const f of pendengar) f(); };
let pemuatan: Promise<void> | null = null;

export function muatDaftarPilihan(): Promise<void> {
  if (pemuatan) return pemuatan;
  pemuatan = (async () => {
    try {
      const { data, error } = await supabase.from('app_settings').select('value').eq('key', KUNCI_DAFTAR_PILIHAN).maybeSingle();
      if (error) return;
      sekarang = bacaDaftarPilihan(data?.value ?? null);
      tulisSimpanan(sekarang);
      beriTahu();
    } catch {  }
  })();
  return pemuatan;
}

export const daftarPilihan = (k: KunciDaftar): string[] => sekarang[k];
export const semuaDaftarPilihan = (): SemuaDaftar => sekarang;

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
