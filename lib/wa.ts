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
 * Route server (cron escalate, forgot-password) JUGA memakai helper ini
 * (sendWANotif/sendWA) - bukan memanggil Fonnte langsung. fetch() ke Edge
 * Function berjalan sama baiknya dari server maupun peramban, dan permintaan
 * itu hanya memakai anon key (sudah publik), bukan token rahasia - jadi tidak
 * ada alasan route server punya jalur sendiri.
 */

import { bacaPengaturan } from '@/lib/notifikasi/pengaturan';
import { kirimTelegramKeNomor } from '@/lib/telegram-pribadi';

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

// Internal: POST mentah ke Edge Function swift-responder (jalur Fonnte).
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
 * Kirim lewat jalur yang sesuai dengan penyedia yang dipilih admin.
 *
 * KENAPA PERCABANGANNYA DI SINI
 *
 * Edge Function `swift-responder` punya Fonnte tertanam di dalamnya - ia tidak
 * bisa mengirim lewat Cloud API resmi maupun webhook kustom. Jadi begitu admin
 * berpindah penyedia, permintaannya harus lewat route server sendiri
 * (/api/notifikasi/whatsapp/kirim) yang membaca token penyedia baru itu.
 *
 * Selama penyedianya Fonnte - keadaan hari ini - jalurnya PERSIS seperti
 * sebelumnya: Edge Function yang sama, bentuk permintaan yang sama. Tidak ada
 * satu pun dari 48 titik pengiriman yang berubah perilakunya sampai seseorang
 * benar-benar menekan pindah penyedia di Admin Panel.
 *
 * Gagal membaca penyedia = ANGGAP FONNTE, sejalan dengan bawaan di
 * lib/notifikasi/pengaturan.ts: pengaturan yang tidak terbaca tidak boleh
 * membelokkan pengiriman ke jalur yang belum tentu terkonfigurasi.
 */
async function kirimLewatPenyedia(
  body: Record<string, unknown>,
): Promise<{ ok?: boolean; reason?: string }> {
  let penyedia: string = 'fonnte';
  try { penyedia = (await bacaPengaturan()).waPenyedia ?? 'fonnte'; } catch { /* tetap fonnte */ }

  if (penyedia === 'fonnte') {
    return (await postSwift(body)) as { ok?: boolean; reason?: string };
  }

  const res = await fetch('/api/notifikasi/whatsapp/kirim', {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ target: body.target, message: body.message }),
  });
  return await res.json() as { ok?: boolean; reason?: string };
}

/*
 * ── TELEGRAM IKUT DI SINI, BUKAN DI TIAP PEMANGGIL ──────────────────────────
 *
 * Alasannya sama persis dengan alasan saklar induk WA dipasang di berkas ini
 * (lihat catatan panjang di waMenyala di atas): ~40 titik pengiriman di
 * ticketing, reminder-schedule, dan form-require-project SUDAH melewati
 * berkas ini. Menyisipkan Telegram di sini membuat SELURUH alur ikut
 * seketika - sales membuat request, Sales Internal approve, admin mengalihkan
 * ke Supervisor, Supervisor assign ke anggota, tiket selesai - tanpa satu pun
 * call site disentuh, dan tanpa risiko satu alur ketinggalan karena terlupa.
 *
 * Sebelum ini Telegram hanya dipasang di SATU tempat (assign jadwal ke
 * anggota), dan itulah sebabnya hanya alur itu yang pernah terkirim.
 *
 * Kedua kanal berdiri SENDIRI-SENDIRI: WhatsApp dimatikan tidak ikut
 * mematikan Telegram, dan sebaliknya. Karena itu penjagaan waMenyala() tidak
 * boleh membungkus keduanya sekaligus.
 */
async function kirimDuaKanal(
  target: string,
  message: string,
  type: string,
): Promise<{ ok: boolean; reason?: string }> {
  //  Telegram dijalankan tanpa ditunggu: ia tidak boleh memperlambat - apalagi
  //  menggagalkan - pengiriman WhatsApp yang sudah berjalan selama ini.
  void kirimTelegramKeNomor(target, message).catch(() => { /* diam */ });

  if (!(await waMenyala())) return { ok: false, reason: 'kanal WhatsApp dimatikan admin' };
  const data = await kirimLewatPenyedia({ type, target, message });
  return { ok: data?.ok === true, reason: data?.reason };
}

/**
 * Fire-and-forget: kirim WA (dan Telegram), abaikan hasil.
 * Dipakai ticketing & form-require-project.
 */
export async function sendWANotif(body: Record<string, unknown>): Promise<void> {
  try {
    //  Dulu berkas ini memanggil postSwift() langsung di sini - artinya ke-19
    //  titik ticketing & form-require-project TIDAK ikut pindah saat admin
    //  mengganti penyedia WhatsApp di Admin Panel; mereka tetap menembak
    //  Edge Function Fonnte. Sekarang lewat jalur yang sama dengan sendWA().
    await kirimDuaKanal(
      String(body.target ?? ''),
      String(body.message ?? ''),
      String(body.type ?? 'reminder_wa'),
    );
  } catch {
    // silent — kegagalan WA tidak boleh memutus alur utama
  }
}

/**
 * Kirim WA (dan Telegram) lalu kembalikan status WhatsApp-nya. Dipakai
 * reminder-schedule yang perlu tahu apakah pengiriman sukses untuk
 * menampilkan feedback ke user.
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
    return await kirimDuaKanal(target, message, type);
  } catch {
    return { ok: false, reason: 'network error' };
  }
}
