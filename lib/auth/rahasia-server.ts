
import { getAdminClient } from '@/lib/supabase-admin';

const CADANGAN_ENV: Record<string, string | undefined> = {
  'whatsapp.token':     process.env.FONNTE_TOKEN,
  'telegram.bot_token': process.env.TELEGRAM_BOT_TOKEN,
  'ai.gemini_token':    process.env.GEMINI_API_KEY,
};

const UMUR_MS = 30_000;
const cache = new Map<string, { nilai: string | null; sampai: number }>();

export async function bacaRahasia(kunci: string): Promise<string | null> {
  const kini = Date.now();
  const tersimpan = cache.get(kunci);
  if (tersimpan && tersimpan.sampai > kini) return tersimpan.nilai;

  let nilai: string | null = null;
  try {
    const db = getAdminClient();
    const { data } = await db.from('rahasia_integrasi').select('nilai').eq('kunci', kunci).maybeSingle();
    if (data?.nilai) nilai = data.nilai as string;
  } catch {
  }
  if (!nilai) nilai = CADANGAN_ENV[kunci] ?? null;

  cache.set(kunci, { nilai, sampai: kini + UMUR_MS });
  return nilai;
}

export function lupakanRahasia(kunci?: string): void {
  if (kunci) cache.delete(kunci); else cache.clear();
}
