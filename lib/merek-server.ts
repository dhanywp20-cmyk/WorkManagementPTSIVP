/**
 * lib/merek-server.ts - baca pengaturan merek (nama/warna platform) dari sisi
 * SERVER, untuk tempat yang tidak bisa memakai useMerek() (hook React) -
 * saat ini cuma app/manifest.ts, yang harus sudah tahu nama & warna platform
 * SEBELUM ada JavaScript apa pun berjalan di peramban.
 *
 * Sengaja hanya field yang manifest butuhkan (bukan seluruh Merek) - lihat
 * lib/merek.ts untuk sumber kebenaran penuh & pola gabung-dengan-bawaan yang
 * sama dipakai di sini.
 */

import { getAdminClient } from '@/lib/supabase-admin';
import { MEREK_BAWAAN, KUNCI_MEREK } from '@/lib/merek-bawaan';

export interface MerekManifest {
  namaPlatform: string;
  namaPlatformSingkat: string;
  warnaUtama: string;
}

export async function bacaMerekUntukManifest(): Promise<MerekManifest> {
  try {
    const db = getAdminClient();
    const { data } = await db.from('app_settings').select('value').eq('key', KUNCI_MEREK).maybeSingle();
    const mentah = data?.value;
    // Kolomnya jsonb - biasanya sudah berupa objek, tapi jaga-jaga kalau
    // tersimpan sebagai string JSON (lihat uraikan() di lib/merek.ts).
    const isi = (typeof mentah === 'string' ? JSON.parse(mentah) : mentah ?? {}) as Partial<MerekManifest>;
    return {
      namaPlatform: isi.namaPlatform || MEREK_BAWAAN.namaPlatform,
      namaPlatformSingkat: isi.namaPlatformSingkat || MEREK_BAWAAN.namaPlatformSingkat,
      warnaUtama: isi.warnaUtama || MEREK_BAWAAN.warnaUtama,
    };
  } catch {
    return {
      namaPlatform: MEREK_BAWAAN.namaPlatform,
      namaPlatformSingkat: MEREK_BAWAAN.namaPlatformSingkat,
      warnaUtama: MEREK_BAWAAN.warnaUtama,
    };
  }
}
