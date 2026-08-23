/**
 * lib/wa.ts - Pengirim notifikasi WhatsApp terpusat (sisi klien)
 *
 * Semua modul (ticketing, form-require-project, reminder-schedule) memakai
 * helper yang sama: POST ke Supabase Edge Function `swift-responder`, yang
 * meneruskan ke gateway WA (Fonnte). Sebelumnya logika ini diduplikasi di
 * beberapa _components/shared.ts - sekarang satu sumber.
 *
 * Catatan: gagal kirim WA TIDAK boleh menggagalkan alur utama  selalu silent.
 *
 * Route server (cron escalate, forgot-password) memanggil Fonnte langsung
 * dengan token rahasia dan TIDAK lewat helper ini (transport berbeda).
 */

import { bacaPengaturan } from '@/lib/notifikasi/pengaturan';

/**
 * Apakah kanal WhatsApp sedang dinyalakan di Admin Panel -> Integrations.
 *
 * KENAPA PENJAGAANNYA DI SINI, bukan di tiap pemanggil
 *
 * Ada 48 titik pengiriman WA tersebar di ticketing, form-require-project,
 * reminder-schedule, dan beberapa berkas lain. Memindahkan semuanya ke
 * lib/notifikasi/router.ts satu per satu adalah pekerjaan berisiko yang tidak
 * bisa diuji dari sini - satu titik yang diam-diam salah berarti seseorang
 * tidak tahu ada tiket untuknya.
 *
 * Tapi ke-48 titik itu SUDAH melewati berkas ini. Jadi saklar induknya
 * dipasang di titik sempit yang memang sudah ada, dan seluruh 48 titik ikut
 * seketika tanpa satu pun call site disentuh - isi pesannya, urutan
 * pemanggilan, dan bentuk permintaan HTTP-nya tidak berubah sama sekali.
 *
 * Penyaringan PER-EVENT tetap lewat router (kirimNotifikasi). Titik yang
 * belum dipindah ke sana hanya tunduk pada saklar induk ini - itu keadaan
 * yang jujur: saklar WhatsApp berlaku menyeluruh hari ini, kontrol per-event
 * menyusul saat tiap titik dipindahkan.
 *
 * Gagal membaca pengaturan = ANGGAP MENYALA. Notifikasi yang berhenti karena
 * jaringan pengaturan sedang bermasalah jauh lebih berbahaya daripada
 * notifikasi yang terkirim padahal admin baru saja mematikannya.
 */
async function waMenyala(): Promise<boolean> {
  try {
    return (await bacaPengaturan()).aktif.whatsapp !== false;
  } catch {
    return true;
  }
}

// Internal: POST mentah ke Edge Function swift-responder.
async function postSwift(body: Record<string, unknown>): Promise<unknown> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  const res = await fetch(`${supabaseUrl}/functions/v1/swift-responder`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${anonKey}`,
      'apikey': anonKey,
    },
    body: JSON.stringify(body),
  });
  return res.json();
}

/**
 * Fire-and-forget: kirim WA, abaikan hasil. Dipakai ticketing & form-require-project.
 */
export async function sendWANotif(body: Record<string, unknown>): Promise<void> {
  try {
    if (!(await waMenyala())) return;
    await postSwift(body);
  } catch {
    // silent — kegagalan WA tidak boleh memutus alur utama
  }
}

/**
 * Kirim WA dan kembalikan status. Dipakai reminder-schedule yang perlu tahu
 * apakah pengiriman sukses (untuk menampilkan feedback ke user).
 */
export async function sendWA(
  target: string,
  message: string,
  type = 'reminder_wa',
): Promise<{ ok: boolean; reason?: string }> {
  try {
    //  Kanal dimatikan admin BUKAN kegagalan - alasannya dibedakan supaya
    //  layar yang menampilkan hasil kirim (Reminder Schedule) bisa berkata
    //  "WhatsApp sedang dimatikan", bukan "gagal kirim" yang menyesatkan.
    if (!(await waMenyala())) return { ok: false, reason: 'kanal WhatsApp dimatikan admin' };
    const data = (await postSwift({ type, target, message })) as { ok?: boolean; reason?: string };
    return { ok: data?.ok === true, reason: data?.reason };
  } catch {
    return { ok: false, reason: 'network error' };
  }
}
