
import { bacaPengaturan } from './pengaturan';

export function normalkanNomor(v: string | null | undefined): string {
  const angka = (v ?? '').replace(/\D/g, '');
  if (!angka) return '';
  if (angka.startsWith('62')) return angka;
  if (angka.startsWith('0')) return `62${angka.slice(1)}`;
  return angka;
}

export async function kirimTelegramKeNomor(
  nomor: string | null | undefined,
  pesan: string,
): Promise<{ ok: boolean; alasan?: string }> {
  if (!normalkanNomor(nomor)) return { ok: false, alasan: 'nomor kosong' };
  const p = await bacaPengaturan();
  if (!p.aktif.telegram) return { ok: false, alasan: 'kanal Telegram nonaktif di Admin Panel' };
  try {
    const r = await fetch('/api/notifikasi/telegram', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nomor, pesan }),
    });
    const j = await r.json() as { ok?: boolean; alasan?: string };
    return { ok: !!j?.ok, alasan: j?.alasan };
  } catch (e) {
    return { ok: false, alasan: e instanceof Error ? e.message : String(e) };
  }
}
