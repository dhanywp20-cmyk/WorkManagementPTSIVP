
import { getAdminClient } from '@/lib/supabase-admin';
import { MEREK_BAWAAN, KUNCI_MEREK } from '@/lib/merek/bawaan';

export interface MerekManifest {
  namaPlatform: string;
  namaPlatformSingkat: string;
  warnaUtama: string;
}

const UMUR_SIMPAN_MS = 5 * 60 * 1000;
let simpanan: { nilai: MerekManifest; sampai: number } | null = null;

export async function bacaMerekUntukManifest(): Promise<MerekManifest> {
  if (simpanan && simpanan.sampai > Date.now()) return simpanan.nilai;
  try {
    const db = getAdminClient();
    const { data, error } = await db.from('app_settings').select('value').eq('key', KUNCI_MEREK).maybeSingle();
    if (error) throw error;
    const mentah = data?.value;
    const isi = (typeof mentah === 'string' ? JSON.parse(mentah) : mentah ?? {}) as Partial<MerekManifest>;
    const nilai = {
      namaPlatform: isi.namaPlatform || MEREK_BAWAAN.namaPlatform,
      namaPlatformSingkat: isi.namaPlatformSingkat || MEREK_BAWAAN.namaPlatformSingkat,
      warnaUtama: isi.warnaUtama || MEREK_BAWAAN.warnaUtama,
    };
    simpanan = { nilai, sampai: Date.now() + UMUR_SIMPAN_MS };
    return nilai;
  } catch {
    return {
      namaPlatform: MEREK_BAWAAN.namaPlatform,
      namaPlatformSingkat: MEREK_BAWAAN.namaPlatformSingkat,
      warnaUtama: MEREK_BAWAAN.warnaUtama,
    };
  }
}
