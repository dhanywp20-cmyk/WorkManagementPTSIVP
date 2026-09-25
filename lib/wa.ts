/**
 * lib/wa.ts - Pengirim notifikasi WhatsApp terpusat (sisi klien)
 *
 * Semua modul (ticketing, form-require-project, reminder-schedule) memakai
 * helper yang sama: POST ke /api/notifikasi/whatsapp/kirim (sesi wajib),
 * yang meneruskan ke penyedia pilihan admin memakai token dari Admin Panel.
 *
 * Catatan: gagal kirim WA TIDAK boleh menggagalkan alur utama  selalu silent.
 *
 * Route server (cron, forgot-password) JUGA memakai helper ini; di server
 * pengirimnya kirimWA() langsung (lihat pasangPengirimServer).
 */

import { bacaPengaturan, kanalUntuk } from '@/lib/notifikasi/pengaturan';
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

/**
 * Pengirim sisi server. Route server (cron, forgot-password) tidak punya
 * cookie sesi, jadi tidak bisa lewat /api/notifikasi/whatsapp/kirim - mereka
 * memasang kirimWA() dari lib/wa-kirim-server lewat lib/wa-server.ts.
 * Registrasi (bukan import langsung) supaya kode service-role tidak ikut
 * terbundel ke peramban.
 */
type PengirimServer = (target: string, pesan: string) => Promise<{ ok: boolean; alasan?: string }>;
let pengirimServer: PengirimServer | null = null;
export function pasangPengirimServer(fn: PengirimServer) { pengirimServer = fn; }

/**
 * Kirim satu WA. SATU jalur untuk semua penyedia (Fonnte / Cloud API /
 * webhook): token dibaca server dari Admin Panel -> Integrations
 * (rahasia_integrasi), tidak lagi dari Edge Function `swift-responder`.
 * Dulu jalur Fonnte menembak Edge Function dengan anon key publik - siapa pun
 * yang memegang anon key bisa mengirim WA tanpa masuk. Sekarang peramban
 * wajib punya sesi, dan route itu membatasi jumlah kirim.
 */
async function kirimLewatPenyedia(
  body: Record<string, unknown>,
): Promise<{ ok?: boolean; reason?: string }> {
  const target = String(body.target ?? '');
  const message = String(body.message ?? '');
  if (typeof window === 'undefined') {
    if (!pengirimServer) return { ok: false, reason: 'pengirim WA server belum dipasang (import lib/wa-server)' };
    const h = await pengirimServer(target, message);
    return { ok: h.ok, reason: h.alasan };
  }
  const res = await fetch('/api/notifikasi/whatsapp/kirim', {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ target, message }),
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
/**
 * Kanal yang berlaku untuk sebuah kejadian - HANYA kalau pemanggilnya
 * menyebutkan kunci event-nya.
 *
 * Tanpa `event`, hasilnya null dan pengiriman berperilaku persis seperti
 * sebelum penyaringan per-event ada: WhatsApp tunduk pada saklar induk,
 * Telegram selalu dicoba. Itu disengaja - 62 titik pengiriman tidak
 * dipindahkan sekaligus, dan titik yang belum dianotasi tidak boleh
 * berubah perilakunya diam-diam.
 *
 * Gagal membaca pengaturan juga menghasilkan null: notifikasi yang berhenti
 * karena jaringan pengaturan sedang bermasalah jauh lebih berbahaya daripada
 * notifikasi yang terkirim padahal admin baru saja mematikannya.
 */
async function kanalBerlaku(event?: string): Promise<{ wa: boolean; tg: boolean } | null> {
  if (!event) return null;
  try {
    const p = await bacaPengaturan();
    const kanal = kanalUntuk(event, p);
    return {
      wa: kanal.includes('whatsapp') && p.aktif.whatsapp !== false,
      tg: kanal.includes('telegram') && p.aktif.telegram !== false,
    };
  } catch {
    return null;
  }
}

async function kirimDuaKanal(
  target: string,
  message: string,
  type: string,
  event?: string,
): Promise<{ ok: boolean; reason?: string }> {
  const berlaku = await kanalBerlaku(event);

  //  Telegram dijalankan tanpa ditunggu: ia tidak boleh memperlambat - apalagi
  //  menggagalkan - pengiriman WhatsApp yang sudah berjalan selama ini.
  if (!berlaku || berlaku.tg) {
    void kirimTelegramKeNomor(target, message).catch(() => { /* diam */ });
  }

  if (berlaku && !berlaku.wa) {
    return { ok: false, reason: `kanal WhatsApp dimatikan admin untuk kejadian ${event}` };
  }
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
      typeof body.event === 'string' ? body.event : undefined,
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
  /** Kunci di KATALOG_EVENT. Diisi = saklar per-event di Admin Panel berlaku. */
  event?: string,
): Promise<{ ok: boolean; reason?: string }> {
  try {
    //  Kanal dimatikan admin BUKAN kegagalan - alasannya dibedakan supaya
    //  layar yang menampilkan hasil kirim (Reminder Schedule) bisa berkata
    //  "WhatsApp sedang dimatikan", bukan "gagal kirim" yang menyesatkan.
    return await kirimDuaKanal(target, message, type, event);
  } catch {
    return { ok: false, reason: 'network error' };
  }
}
