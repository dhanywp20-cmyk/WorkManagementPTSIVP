/**
 * lib/ai-server.ts - perkakas server bersama untuk fitur AI tim
 * (Asisten "Tanya Platform", draf Daily Report).
 *
 *  - jatahAI(): batas pemakaian per user (tabel ai_pakai_log, migrasi 023).
 *    Kuota Gemini gratis dibagi seluruh tim; tanpa batas per orang, satu
 *    obrolan panjang bisa mematikan fitur untuk semua.
 *  - panggilGemini(): token dari rahasia_integrasi (ai.gemini_token_asisten,
 *    cadangan ai.gemini_token) - tidak pernah sampai ke peramban.
 *  - klienSebagaiUser(): klien Supabase yang membawa token DB milik user itu
 *    sendiri, sehingga RLS berlaku persis seperti di layarnya. Asisten tidak
 *    bisa melihat lebih dari yang user itu boleh lihat.
 */
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { getAdminClient } from '@/lib/supabase-admin';
import { bacaRahasia } from '@/lib/rahasia-server';
import { issueDbToken } from '@/lib/db-token';
import { ambilPengaturanAI } from '@/lib/ai-pengaturan';

export const BATAS_PER_JAM = 20;
export const BATAS_PER_HARI = 80;

export interface UserLengkap {
  id: string; username: string; full_name: string | null; role: string | null;
  sales_division: string | null; access_level: string | null;
  team_type: string | null; jabatan: string | null;
}

export async function muatUser(id: string): Promise<UserLengkap | null> {
  const { data } = await getAdminClient().from('users')
    .select('id, username, full_name, role, sales_division, access_level, team_type, jabatan')
    .eq('id', id).maybeSingle();
  return (data as UserLengkap | null) ?? null;
}

/** null = boleh (dan pemakaian dicatat); string = alasan ditolak. */
export async function jatahAI(userId: string, fitur: string): Promise<string | null> {
  const db = getAdminClient();
  const sejak = (ms: number) => new Date(Date.now() - ms).toISOString();
  const hitung = (ms: number) => db.from('ai_pakai_log').select('id', { count: 'exact', head: true })
    .eq('user_id', userId).gte('created_at', sejak(ms));
  const [jam, hari] = await Promise.all([hitung(3_600_000), hitung(86_400_000)]);
  if ((hari.count ?? 0) >= BATAS_PER_HARI) return `Batas harian asisten (${BATAS_PER_HARI}) sudah tercapai. Coba lagi besok.`;
  if ((jam.count ?? 0) >= BATAS_PER_JAM) return `Batas ${BATAS_PER_JAM} permintaan per jam tercapai. Coba lagi sebentar lagi.`;
  await db.from('ai_pakai_log').insert({ user_id: userId, fitur });
  return null;
}

export function klienSebagaiUser(u: UserLengkap): SupabaseClient {
  const token = issueDbToken({
    id: u.id, username: u.username, full_name: u.full_name, role: u.role,
    sales_division: u.sales_division, access_level: u.access_level,
  });
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      fetch: (input, init) => fetch(input, { ...init, cache: 'no-store' }),
    },
  });
}

export type IsiGemini = { role: 'user' | 'model'; parts: Record<string, unknown>[] };

export interface HasilGemini {
  ok: boolean; alasan?: string;
  parts?: { text?: string; functionCall?: { name: string; args?: Record<string, unknown> } }[];
}

export async function panggilGemini(opsi: {
  sistem: string; isi: IsiGemini[]; alat?: Record<string, unknown>[]; suhu?: number; maksToken?: number;
}): Promise<HasilGemini> {
  const [tAsisten, tUmum, setelan] = await Promise.all([
    bacaRahasia('ai.gemini_token_asisten'), bacaRahasia('ai.gemini_token'), ambilPengaturanAI(),
  ]);
  const token = tAsisten || tUmum;
  if (!token) return { ok: false, alasan: 'Asisten AI belum aktif. Admin dapat mengisi Token AI di Admin Panel → Integrations.' };
  const model = /^[A-Za-z0-9._-]{1,80}$/.test(setelan.model || '') ? setelan.model : 'gemini-2.5-flash';

  const payload: Record<string, unknown> = {
    systemInstruction: { parts: [{ text: opsi.sistem }] },
    contents: opsi.isi,
    generationConfig: { temperature: opsi.suhu ?? 0.3, maxOutputTokens: opsi.maksToken ?? 1024 },
  };
  if (opsi.alat?.length) payload.tools = [{ functionDeclarations: opsi.alat }];
  //  Model 2.5 "berpikir" dulu dan pikirannya memakan jatah maxOutputTokens -
  //  untuk tanya-jawab ringkas itu hanya menambah lambat & menghabiskan kuota.
  if (/2\.5-flash/.test(model)) {
    (payload.generationConfig as Record<string, unknown>).thinkingConfig = { thinkingBudget: 0 };
  }

  try {
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': token },
      body: JSON.stringify(payload),
    });
    const j = await res.json().catch(() => ({}));
    if (!res.ok) {
      const pesan = String(j?.error?.message ?? res.status);
      return { ok: false, alasan: res.status === 429 ? 'Kuota AI sedang penuh. Coba lagi beberapa menit lagi.' : `AI gagal menjawab (${pesan.slice(0, 160)})` };
    }
    const parts = j?.candidates?.[0]?.content?.parts;
    if (!Array.isArray(parts)) return { ok: false, alasan: 'AI tidak memberi jawaban. Coba ulangi pertanyaannya.' };
    return { ok: true, parts };
  } catch {
    return { ok: false, alasan: 'Tidak bisa menghubungi layanan AI.' };
  }
}
