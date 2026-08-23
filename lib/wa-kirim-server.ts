/**
 * lib/wa-kirim-server.ts - satu-satunya tempat permintaan HTTP ke gateway
 * WhatsApp dibentuk. HANYA untuk sisi server.
 *
 * Jangan mengimpornya dari komponen 'use client': ia membaca token mentah
 * lewat bacaRahasia(), dan apa pun yang ter-bundle ke peramban ikut terbaca
 * pengunjung.
 *
 * Berkas ini menerjemahkan pilihan penyedia (lib/notifikasi/penyedia-wa.ts)
 * jadi panggilan yang sesungguhnya. Route /api/notifikasi/whatsapp memakainya
 * untuk Tes Koneksi & Kirim Pesan Tes, dan /api/notifikasi/whatsapp/kirim
 * memakainya untuk pengiriman biasa saat penyedianya BUKAN Fonnte.
 *
 * Bentuk jawabannya sengaja diseragamkan jadi { ok, alasan } - tiap gateway
 * melaporkan kegagalan dengan caranya sendiri (Fonnte lewat status:false di
 * badan 200, Meta lewat error.message, webhook kustom lewat kode HTTP), dan
 * pemanggilnya tidak perlu tahu perbedaan itu.
 */

import { bacaRahasia } from '@/lib/rahasia-server';
import { getAdminClient } from '@/lib/supabase-admin';
import { penyediaWA, type PenyediaWA } from '@/lib/notifikasi/penyedia-wa';

export interface HasilWA {
  ok: boolean;
  alasan?: string;
  /** Nama perangkat/nomor yang terbaca saat Tes Koneksi. */
  perangkat?: string;
}

interface KonfigWA {
  penyedia: PenyediaWA;
  config: Record<string, string>;
}

/**
 * Baca penyedia yang dipilih admin dari app_settings.
 *
 * Dibaca dengan service_role, bukan anon: route ini berjalan di server dan
 * app_settings sudah dikunci RLS. Gagal baca = jatuh ke Fonnte, sama seperti
 * bawaan di lib/notifikasi/pengaturan.ts - pengaturan yang tidak terbaca tidak
 * boleh membuat pengiriman berhenti, ia harus jatuh ke perilaku hari ini.
 */
async function bacaKonfig(): Promise<KonfigWA> {
  try {
    const db = getAdminClient();
    const { data } = await db.from('app_settings').select('value').eq('key', 'notifikasi.kanal').maybeSingle();
    if (data?.value) {
      const j = JSON.parse(data.value as string) as { waPenyedia?: PenyediaWA; waConfig?: Record<string, string> };
      return { penyedia: j.waPenyedia ?? 'fonnte', config: j.waConfig ?? {} };
    }
  } catch { /* diam - jatuh ke Fonnte di bawah */ }
  return { penyedia: 'fonnte', config: {} };
}

/** Versi Graph API yang dipanggil untuk Cloud API. */
const GRAPH = 'https://graph.facebook.com/v21.0';

/** Tanya gateway apakah kredensialnya sah, TANPA mengirim pesan ke siapa pun. */
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

/** Kirim satu pesan WA lewat penyedia yang sedang dipilih. */
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
        //  Pesan Meta untuk pelanggaran jendela 24 jam berbunyi teknis
        //  ("Message failed to send because more than 24 hours have passed").
        //  Diteruskan apa adanya - menyederhanakannya justru menyembunyikan
        //  sebab yang paling sering terjadi di platform ini.
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
      //  Untuk alamat sembarangan, satu-satunya tanda berhasil yang bisa
      //  diandalkan adalah kode HTTP-nya. Badan jawabannya bisa apa saja.
      if (!r.ok) return { ok: false, alasan: `Endpoint membalas HTTP ${r.status}.` };
      return { ok: true };
    } catch {
      return { ok: false, alasan: 'Tidak bisa menghubungi endpoint kustom.' };
    }
  }

  return { ok: false, alasan: 'Penyedia tidak dikenal.' };
}

/** Penyedia yang sedang dipilih - dipakai klien untuk memutuskan jalur kirim. */
export async function penyediaTerpilih(): Promise<PenyediaWA> {
  return (await bacaKonfig()).penyedia;
}
