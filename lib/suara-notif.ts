/**
 * lib/suara-notif.ts - suara notifikasi yang diatur Admin (app_settings 'suara_notifikasi') +
 * unggah berkasnya ke bucket merek-files (tulis hanya Admin, RLS boleh_tulis_pengaturan).
 * Aturan & batas: lib/suara-notif-bawaan.ts. Pola sama dengan lib/merek.ts: module scope +
 * sessionStorage (satu query per tab), pendengar memperbarui alarm begitu Admin menyimpan.
 */
import { useEffect, useState } from 'react';
import { supabase } from './supabase';
import { bacaSuaraNotif, KUNCI_SUARA_NOTIF, periksaBerkasSuara, periksaDurasiSuara, SUARA_BAWAAN, type SuaraNotif, TIPE_SUARA } from './suara-notif-bawaan';

export * from './suara-notif-bawaan';

const SIMPAN = 'ivp_suara_notif';
const BUCKET = 'merek-files';

function bacaSimpanan(): SuaraNotif | null {
  if (typeof window === 'undefined') return null;
  try { const m = window.sessionStorage.getItem(SIMPAN); return m ? bacaSuaraNotif(m) : null; } catch { return null; }
}
function tulisSimpanan(v: SuaraNotif) {
  if (typeof window === 'undefined') return;
  try { window.sessionStorage.setItem(SIMPAN, JSON.stringify(v)); } catch { /* abaikan */ }
}

let sekarang: SuaraNotif = bacaSimpanan() ?? SUARA_BAWAAN;
const pendengar = new Set<() => void>();
const beriTahu = () => { for (const f of pendengar) f(); };
let pemuatan: Promise<void> | null = null;

export function muatSuaraNotif(): Promise<void> {
  if (pemuatan) return pemuatan;
  pemuatan = (async () => {
    try {
      const { data, error } = await supabase.from('app_settings').select('value').eq('key', KUNCI_SUARA_NOTIF).maybeSingle();
      if (error) return;
      sekarang = bacaSuaraNotif(data?.value ?? null);
      tulisSimpanan(sekarang);
      beriTahu();
    } catch { /* pertahankan nilai yang berlaku */ }
  })();
  return pemuatan;
}

export const suaraNotif = (): SuaraNotif => sekarang;

/** Dengarkan perubahan (alarm di halaman memperbarui berkas & volumenya). Mengembalikan pelepas. */
export function dengarSuaraNotif(f: () => void): () => void {
  pendengar.add(f);
  return () => { pendengar.delete(f); };
}

export function useSuaraNotif(): SuaraNotif {
  const [nilai, setNilai] = useState<SuaraNotif>(() => sekarang);
  useEffect(() => {
    const segarkan = () => setNilai(sekarang);
    const lepas = dengarSuaraNotif(segarkan);
    void muatSuaraNotif().then(segarkan);
    return lepas;
  }, []);
  return nilai;
}

export async function simpanSuaraNotif(s: SuaraNotif): Promise<{ error: string | null }> {
  const bersih = bacaSuaraNotif(s);
  const { error } = await supabase.from('app_settings')
    .upsert({ key: KUNCI_SUARA_NOTIF, value: JSON.stringify(bersih) }, { onConflict: 'key' });
  if (error) return { error: error.message };
  sekarang = bersih;
  tulisSimpanan(bersih);
  beriTahu();
  return { error: null };
}

/** Durasi berkas suara (detik) dibaca peramban sebelum diunggah. */
export function durasiBerkas(berkas: File): Promise<number> {
  return new Promise(ok => {
    const url = URL.createObjectURL(berkas);
    const a = new Audio();
    const selesai = (d: number) => { URL.revokeObjectURL(url); ok(d); };
    a.preload = 'metadata';
    a.onloadedmetadata = () => selesai(a.duration);
    a.onerror = () => selesai(NaN);
    a.src = url;
  });
}

/**
 * Periksa lalu unggah berkas suara. Nama berkas unik (cache peramban 1 tahun aman - berkas baru =
 * URL baru), jadi tiap orang mengunduhnya sekali saja (hemat kuota Supabase).
 */
export async function unggahSuaraNotif(berkas: File): Promise<{ url: string | null; error: string | null }> {
  const galat = periksaBerkasSuara(berkas.type, berkas.size) ?? periksaDurasiSuara(await durasiBerkas(berkas));
  if (galat) return { url: null, error: galat };
  const jalur = `suara/notif-${Date.now()}.${TIPE_SUARA[berkas.type]}`;
  const { error } = await supabase.storage.from(BUCKET).upload(jalur, berkas, { contentType: berkas.type, cacheControl: '31536000', upsert: false });
  if (error) return { url: null, error: error.message };
  return { url: supabase.storage.from(BUCKET).getPublicUrl(jalur).data.publicUrl, error: null };
}
