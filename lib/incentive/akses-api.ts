
import type { TingkatAkses } from './akses';

type Res = { error: { message: string } | null };

async function kirim(body: Record<string, unknown>): Promise<Res> {
  try {
    const res = await fetch('/api/incentive/akses', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) return { error: { message: json.error || 'Gagal memproses.' } };
    return { error: null };
  } catch (e) {
    return { error: { message: (e as Error).message } };
  }
}

export function setAksesIncentive(userId: string, value: TingkatAkses): Promise<Res> {
  return kirim({ action: 'setAkses', userId, value });
}

export function setBrandScopeIncentive(userId: string, value: string | null): Promise<Res> {
  return kirim({ action: 'setBrandScope', userId, value });
}
