
import { bacaRahasia } from '@/lib/rahasia-server';
import { getAdminClient } from '@/lib/supabase-admin';
import { penyediaWA, type PenyediaWA } from '@/lib/notifikasi/penyedia-wa';

export interface HasilWA {
  ok: boolean;
  alasan?: string;
  perangkat?: string;
}

interface KonfigWA {
  penyedia: PenyediaWA;
  config: Record<string, string>;
}

async function bacaKonfig(): Promise<KonfigWA> {
  try {
    const db = getAdminClient();
    const { data } = await db.from('app_settings').select('value').eq('key', 'notifikasi.kanal').maybeSingle();
    if (data?.value) {
      const j = JSON.parse(data.value as string) as { waPenyedia?: PenyediaWA; waConfig?: Record<string, string> };
      return { penyedia: j.waPenyedia ?? 'fonnte', config: j.waConfig ?? {} };
    }
  } catch {  }
  return { penyedia: 'fonnte', config: {} };
}

const GRAPH = 'https://graph.facebook.com/v21.0';

export async function cekKoneksiWA(): Promise<HasilWA> {
  const { penyedia, config } = await bacaKonfig();
  const def = penyediaWA(penyedia);
  if (!def.bisaCek) {
    return { ok: false, alasan: `${def.label} tidak menyediakan cek koneksi. Pakai Kirim Pesan Tes.` };
  }

  if (penyedia === 'fonnte') {
    const token = await bacaRahasia('whatsapp.token');
    if (!token) return { ok: false, alasan: 'Token Fonnte belum diisi.' };
    try {
      const r = await fetch('https://api.fonnte.com/device', {
        method: 'POST', headers: { Authorization: token },
      });
      const j = await r.json() as { status?: boolean; reason?: string; device?: string; name?: string };
      if (j?.status === false) return { ok: false, alasan: j?.reason ?? 'Token ditolak Fonnte.' };
      return { ok: true, perangkat: j?.device ?? j?.name ?? '(tersambung)' };
    } catch {
      return { ok: false, alasan: 'Tidak bisa menghubungi api.fonnte.com.' };
    }
  }

  if (penyedia === 'meta_cloud') {
    const token = await bacaRahasia('whatsapp.meta_token');
    const id = (config.metaPhoneNumberId ?? '').trim();
    if (!token) return { ok: false, alasan: 'Access Token Meta belum diisi.' };
    if (!id) return { ok: false, alasan: 'Phone Number ID belum diisi.' };
    try {
      const r = await fetch(`${GRAPH}/${encodeURIComponent(id)}?fields=verified_name,display_phone_number`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const j = await r.json() as {
        error?: { message?: string }; verified_name?: string; display_phone_number?: string;
      };
      if (j?.error) return { ok: false, alasan: j.error.message ?? 'Meta menolak kredensial.' };
      const nama = [j?.verified_name, j?.display_phone_number].filter(Boolean).join(' · ');
      return { ok: true, perangkat: nama || '(tersambung)' };
    } catch {
      return { ok: false, alasan: 'Tidak bisa menghubungi graph.facebook.com.' };
    }
  }

  return { ok: false, alasan: 'Penyedia tidak dikenal.' };
}

export async function kirimWA(target: string, pesan: string): Promise<HasilWA> {
  const nomor = target.trim();
  const isi = pesan.trim();
  if (!nomor) return { ok: false, alasan: 'Nomor tujuan kosong.' };
  if (!isi) return { ok: false, alasan: 'Pesan kosong.' };

  const { penyedia, config } = await bacaKonfig();

  if (penyedia === 'fonnte') {
    const token = await bacaRahasia('whatsapp.token');
    if (!token) return { ok: false, alasan: 'Token Fonnte belum diisi.' };
    try {
      const r = await fetch('https://api.fonnte.com/send', {
        method: 'POST',
        headers: { Authorization: token, 'Content-Type': 'application/json' },
        body: JSON.stringify({ target: nomor, message: isi }),
      });
      const j = await r.json() as { status?: boolean; reason?: string };
      if (j?.status === false) return { ok: false, alasan: j?.reason ?? 'Fonnte menolak pesan.' };
      return { ok: true };
    } catch {
      return { ok: false, alasan: 'Tidak bisa menghubungi api.fonnte.com.' };
    }
  }

  if (penyedia === 'meta_cloud') {
    const token = await bacaRahasia('whatsapp.meta_token');
    const id = (config.metaPhoneNumberId ?? '').trim();
    if (!token) return { ok: false, alasan: 'Access Token Meta belum diisi.' };
    if (!id) return { ok: false, alasan: 'Phone Number ID belum diisi.' };
    try {
      const r = await fetch(`${GRAPH}/${encodeURIComponent(id)}/messages`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messaging_product: 'whatsapp',
          recipient_type: 'individual',
          to: nomor,
          type: 'text',
          text: { preview_url: false, body: isi },
        }),
      });
      const j = await r.json() as { error?: { message?: string; error_data?: { details?: string } } };
      if (j?.error) {
        return { ok: false, alasan: j.error.error_data?.details ?? j.error.message ?? 'Meta menolak pesan.' };
      }
      return { ok: true };
    } catch {
      return { ok: false, alasan: 'Tidak bisa menghubungi graph.facebook.com.' };
    }
  }

  if (penyedia === 'kustom') {
    const url = (config.kustomUrl ?? '').trim();
    const token = await bacaRahasia('whatsapp.kustom_token');
    if (!url) return { ok: false, alasan: 'URL endpoint kustom belum diisi.' };
    try {
      const r = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: token } : {}),
        },
        body: JSON.stringify({ target: nomor, message: isi }),
      });
      if (!r.ok) return { ok: false, alasan: `Endpoint membalas HTTP ${r.status}.` };
      return { ok: true };
    } catch {
      return { ok: false, alasan: 'Tidak bisa menghubungi endpoint kustom.' };
    }
  }

  return { ok: false, alasan: 'Penyedia tidak dikenal.' };
}

export async function penyediaTerpilih(): Promise<PenyediaWA> {
  return (await bacaKonfig()).penyedia;
}
