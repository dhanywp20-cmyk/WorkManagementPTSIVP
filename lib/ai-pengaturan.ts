import { supabase } from './supabase';

export const KUNCI_AI = 'ai.pembuat_soal';

export const KUNCI_AI_PENILAI = 'ai.penilai';

export interface PengaturanAI {
  model: string;
  arahan: string;
  suhu: number;
}

export const AI_BAWAAN: PengaturanAI = {
  model: 'gemini-2.5-flash',
  arahan: '',
  suhu: 0.7,
};

export interface PengaturanPenilai extends PengaturanAI {
  otomatis: boolean;
}

export const PENILAI_BAWAAN: PengaturanPenilai = {
  model: 'gemini-2.5-flash',
  arahan: '',
  suhu: 0.2,
  otomatis: false,
};

export function rapikanPengaturanPenilai(isi: unknown): PengaturanPenilai {
  const dasar = rapikanPengaturanAI(isi);
  const r = (isi ?? {}) as Partial<PengaturanPenilai>;
  const adaModel = typeof r.model === 'string' && /^[A-Za-z0-9._-]{1,80}$/.test(r.model.trim());
  const adaSuhu  = Number.isFinite(Number(r.suhu));
  return {
    model:  adaModel ? dasar.model : PENILAI_BAWAAN.model,
    arahan: dasar.arahan,
    suhu:   adaSuhu ? dasar.suhu : PENILAI_BAWAAN.suhu,
    otomatis: r.otomatis === true,
  };
}

export function rapikanPengaturanAI(isi: unknown): PengaturanAI {
  const r = (isi ?? {}) as Partial<PengaturanAI>;
  const suhu = Number(r.suhu);
  return {
    model: (typeof r.model === 'string' && /^[A-Za-z0-9._-]{1,80}$/.test(r.model.trim()))
      ? r.model.trim() : AI_BAWAAN.model,
    arahan: typeof r.arahan === 'string' ? r.arahan.slice(0, 4000) : '',
    suhu: Number.isFinite(suhu) ? Math.min(2, Math.max(0, suhu)) : AI_BAWAAN.suhu,
  };
}

export async function ambilPengaturanAI(): Promise<PengaturanAI> {
  try {
    const { data } = await supabase
      .from('app_settings').select('value').eq('key', KUNCI_AI).maybeSingle();
    const mentah = (data as { value?: unknown } | null)?.value;
    const isi = typeof mentah === 'string' ? JSON.parse(mentah) : mentah;
    return rapikanPengaturanAI(isi);
  } catch {
    return AI_BAWAAN;
  }
}

export async function ambilPengaturanPenilai(): Promise<PengaturanPenilai> {
  try {
    const { data } = await supabase
      .from('app_settings').select('value').eq('key', KUNCI_AI_PENILAI).maybeSingle();
    const mentah = (data as { value?: unknown } | null)?.value;
    const isi = typeof mentah === 'string' ? JSON.parse(mentah) : mentah;
    return rapikanPengaturanPenilai(isi);
  } catch {
    return PENILAI_BAWAAN;
  }
}

export async function simpanPengaturanPenilai(p: PengaturanPenilai): Promise<{ ok: boolean; pesan?: string }> {
  try {
    const bersih = rapikanPengaturanPenilai(p);
    const { error } = await supabase.from('app_settings')
      .upsert({ key: KUNCI_AI_PENILAI, value: JSON.stringify(bersih) }, { onConflict: 'key' });
    if (error) return { ok: false, pesan: error.message };
    return { ok: true };
  } catch (e) {
    return { ok: false, pesan: e instanceof Error ? e.message : 'gagal menyimpan' };
  }
}

export async function simpanPengaturanAI(p: PengaturanAI): Promise<{ ok: boolean; pesan?: string }> {
  try {
    const bersih = rapikanPengaturanAI(p);
    const { error } = await supabase.from('app_settings')
      .upsert({ key: KUNCI_AI, value: JSON.stringify(bersih) }, { onConflict: 'key' });
    if (error) return { ok: false, pesan: error.message };
    return { ok: true };
  } catch (e) {
    return { ok: false, pesan: e instanceof Error ? e.message : 'gagal menyimpan' };
  }
}
