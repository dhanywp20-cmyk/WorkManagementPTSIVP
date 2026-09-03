/**
 * lib/telegram-pribadi.ts - kirim notifikasi Telegram ke SATU orang tertentu.
 *
 * Beda dari lib/notifikasi/router.ts (yang mengirim ke SATU tujuan bersama
 * yang diatur admin di Admin Panel - grup tim atau chat admin), berkas ini
 * mengirim ke Chat ID pribadi seseorang, hasil ia menghubungkan akun
 * Telegram-nya sendiri lewat profilnya (lihat
 * app/api/notifikasi/telegram/route.ts aksi 'hubungkan').
 *
 * Dipanggil BERDAMPINGAN dengan pengiriman WhatsApp yang sudah ada, bukan
 * menggantikannya - kalau orangnya belum menghubungkan Telegram, ini cukup
 * diam saja (bukan kegagalan; "belum diatur" bukan kesalahan, sama seperti
 * nomor WA kosong).
 */

import { bacaPengaturan } from './notifikasi/pengaturan';
import { supabase } from './supabase';

export async function kirimTelegramPribadi(
  chatId: string | null | undefined,
  pesan: string,
): Promise<{ ok: boolean; alasan?: string }> {
  if (!chatId) return { ok: false, alasan: 'belum menghubungkan Telegram' };

  const p = await bacaPengaturan();
  if (!p.aktif.telegram) return { ok: false, alasan: 'kanal Telegram nonaktif di Admin Panel' };

  try {
    const r = await fetch('/api/notifikasi/telegram', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chatId, pesan }),
    });
    const j = await r.json() as { ok?: boolean; alasan?: string };
    return { ok: !!j?.ok, alasan: j?.alasan };
  } catch (e) {
    return { ok: false, alasan: e instanceof Error ? e.message : String(e) };
  }
}

/*
  ── MENEMUKAN CHAT ID DARI NOMOR TELEPON ────────────────────────────────────

  Kenapa lewat nomor, bukan lewat id user: karena SELURUH ~40 titik pengiriman
  notifikasi di platform ini (ticketing, reminder-schedule, form-require-
  project) memanggil pengirimnya dengan NOMOR TELEPON penerima, bukan dengan
  identitas user. Meminta ke-40 titik itu diubah supaya membawa identitas
  adalah pekerjaan besar yang tidak bisa diuji dari sini, dan satu titik yang
  diam-diam salah berarti seseorang tidak tahu ada tiket untuknya.

  Nomor telepon di platform ini memang identitas orang - ia diambil dari baris
  users yang sama yang menyimpan telegram_chat_id. Jadi memetakannya balik
  aman dan tidak menuntut satu pun call site disentuh.

  Nomornya DINORMALKAN dulu: basis data ini menyimpan campuran "08…" (35
  akun) dan "62…" (8 akun). Mencocokkan apa adanya akan gagal untuk sebagian
  besar orang - dan gagalnya diam-diam, persis jenis kegagalan yang paling
  mahal di sini.
*/

/** "08123…", "+62 812-3…", "62812…" -> "62812…". Untuk MEMBANDINGKAN saja. */
export function normalkanNomor(v: string | null | undefined): string {
  const angka = (v ?? '').replace(/\D/g, '');
  if (!angka) return '';
  if (angka.startsWith('62')) return angka;
  if (angka.startsWith('0')) return `62${angka.slice(1)}`;
  return angka;
}

/**
 * Peta nomor -> chat id, disegarkan tiap menit.
 *
 * Tanpa cache, satu kejadian yang mengabari lima orang jadi lima query. Umur
 * satu menit cukup pendek supaya orang yang baru menghubungkan Telegram tidak
 * menunggu lama, dan cukup panjang untuk menutup satu rentetan pengiriman.
 */
let peta: Map<string, string> | null = null;
let petaSampai = 0;

export async function lupakanPetaTelegram(): Promise<void> {
  peta = null; petaSampai = 0;
}

export async function chatIdDariNomor(nomor: string | null | undefined): Promise<string | null> {
  const kunci = normalkanNomor(nomor);
  if (!kunci) return null;

  if (!peta || Date.now() > petaSampai) {
    try {
      const { data, error } = await supabase.from('users')
        .select('phone_number, telegram_chat_id')
        .not('telegram_chat_id', 'is', null);
      //  Kolomnya baru. Pemasangan yang belum menjalankan migrasinya cukup
      //  tidak mengirim Telegram - bukan meledak dan ikut menjatuhkan WA.
      if (error) return null;
      const baru = new Map<string, string>();
      for (const u of (data ?? []) as { phone_number: string | null; telegram_chat_id: string | null }[]) {
        const n = normalkanNomor(u.phone_number);
        if (n && u.telegram_chat_id) baru.set(n, u.telegram_chat_id);
      }
      peta = baru;
      petaSampai = Date.now() + 60_000;
    } catch {
      return null;
    }
  }
  return peta.get(kunci) ?? null;
}

/**
 * Kirim Telegram ke pemilik sebuah NOMOR - diam bila ia belum menghubungkan
 * akunnya. Inilah yang dipakai lib/wa.ts supaya seluruh titik pengiriman yang
 * sudah ada ikut mengirim Telegram tanpa satu pun diubah.
 */
export async function kirimTelegramKeNomor(
  nomor: string | null | undefined,
  pesan: string,
): Promise<{ ok: boolean; alasan?: string }> {
  const chatId = await chatIdDariNomor(nomor);
  if (!chatId) return { ok: false, alasan: 'nomor ini belum menghubungkan Telegram' };
  return kirimTelegramPribadi(chatId, pesan);
}
