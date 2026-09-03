/**
 * lib/notifikasi/katalog.ts - daftar EVENT yang dikenal notification engine.
 *
 * Satu event = satu kejadian bisnis ("tiket di-assign", "request perlu
 * approval"), bukan satu pesan. Kanal mana yang dipakai untuk event itu -
 * in-app saja, WhatsApp saja, atau keduanya - ditentukan terpisah dari sini
 * (lihat `bawaanKanal` di bawah untuk nilai bawaan; Phase 6 akan
 * membuatnya bisa diubah dari Admin Panel -> Notifications).
 *
 * KENAPA KATALOG INI PENTING
 *
 * Sebelum ada ini, "kejadian apa saja yang mengirim notifikasi" hanya bisa
 * dijawab dengan membaca ulang seluruh kode - tersebar di 48 titik lintas
 * app/ticketing/page.tsx, app/reminder-schedule/page.tsx, dan
 * app/form-require-project/page.tsx. Daftar ini jadi SATU tempat yang
 * menjawab pertanyaan itu, dan jadi dasar UI Admin Panel -> Notifications
 * di Phase 6 (per kanal, per event - lihat master prompt bagian C).
 */

export type KategoriEvent = 'assignment' | 'approval' | 'reminder' | 'schedule' | 'project' | 'ticket' | 'system';

export interface DefinisiEvent {
  key: string;
  label: string;
  kategori: KategoriEvent;
  /** Kanal yang aktif kalau belum ada pengaturan admin untuk event ini. */
  bawaanKanal: Array<'in_app' | 'whatsapp'>;
}

export const KATALOG_EVENT: DefinisiEvent[] = [
  { key: 'ticket.assigned',           label: 'Tiket di-assign ke anggota',        kategori: 'ticket',      bawaanKanal: ['in_app', 'whatsapp'] },
  { key: 'ticket.reopened',           label: 'Tiket dibuka kembali',              kategori: 'ticket',      bawaanKanal: ['in_app', 'whatsapp'] },
  { key: 'ticket.approval_needed',    label: 'Tiket menunggu approval admin',     kategori: 'approval',    bawaanKanal: ['in_app', 'whatsapp'] },
  { key: 'ticket.routed_supervisor',  label: 'Tiket dialihkan ke Supervisor',     kategori: 'assignment',  bawaanKanal: ['in_app', 'whatsapp'] },
  { key: 'ticket.updated',            label: 'Detail tiket diperbarui',           kategori: 'ticket',      bawaanKanal: ['whatsapp'] },
  { key: 'reminder.new_schedule',     label: 'Jadwal baru dibuat',                kategori: 'schedule',    bawaanKanal: ['in_app', 'whatsapp'] },
  { key: 'reminder.assigned',         label: 'Jadwal di-assign ke anggota',       kategori: 'assignment',  bawaanKanal: ['in_app', 'whatsapp'] },
  { key: 'reminder.routed_supervisor',label: 'Jadwal dialihkan ke Supervisor',    kategori: 'assignment',  bawaanKanal: ['in_app', 'whatsapp'] },
  { key: 'reminder.rescheduled',      label: 'Jadwal dipindah (re-schedule)',     kategori: 'schedule',    bawaanKanal: ['whatsapp'] },
  { key: 'reminder.updated',          label: 'Detail jadwal diperbarui',          kategori: 'schedule',    bawaanKanal: ['whatsapp'] },
  { key: 'reminder.form_review_sent', label: 'Form review dikirim ke Guest/Sales',kategori: 'schedule',    bawaanKanal: ['whatsapp'] },
  { key: 'project.approval_needed',   label: 'Request project menunggu approval', kategori: 'approval',    bawaanKanal: ['in_app', 'whatsapp'] },
  { key: 'project.assigned',          label: 'Request project di-assign',         kategori: 'assignment',  bawaanKanal: ['in_app', 'whatsapp'] },
  { key: 'project.routed_supervisor', label: 'Request project dialihkan ke Supervisor', kategori: 'assignment', bawaanKanal: ['in_app', 'whatsapp'] },
  { key: 'project.updated',           label: 'Detail request project diperbarui',kategori: 'project',      bawaanKanal: ['whatsapp'] },
  { key: 'project.internal_review',   label: 'Request menunggu review Sales Internal', kategori: 'approval', bawaanKanal: ['whatsapp'] },
  { key: 'project.brand_cc',          label: 'CC ke PIC Brand',                   kategori: 'project',     bawaanKanal: ['whatsapp'] },
  { key: 'system.user_registered',    label: 'Akun baru menunggu persetujuan',    kategori: 'system',      bawaanKanal: ['in_app'] },
  { key: 'system.account_created',    label: 'Akun baru dibuat Admin - WA selamat datang', kategori: 'system', bawaanKanal: ['whatsapp'] },
  { key: 'system.password_reset',     label: 'Kode OTP reset password',           kategori: 'system',      bawaanKanal: ['whatsapp'] },
  { key: 'system.digest',             label: 'Ringkasan harian (digest)',         kategori: 'system',      bawaanKanal: ['whatsapp'] },
  { key: 'system.overdue_escalation', label: 'Eskalasi tiket/jadwal terlambat',   kategori: 'system',      bawaanKanal: ['whatsapp'] },
];

export function cariEvent(key: string): DefinisiEvent | undefined {
  return KATALOG_EVENT.find(e => e.key === key);
}

/*
  ── MODUL YANG SENGAJA TIDAK MENGIRIM WHATSAPP/TELEGRAM ────────────────────

    Project Progress
    Daily Report
    Unit Movement Log

  Keputusan pemilik platform, bukan kelalaian. Ketiganya dicatat dan dibaca di
  layar; tidak ada tahap yang menunggu tindakan orang lain, jadi pesan keluar
  hanya akan jadi kebisingan yang membuat notifikasi yang benar-benar penting
  ikut diabaikan.

  Dicatat di sini karena audit kelengkapan notifikasi WAJAR menandai ketiganya
  sebagai "modul tanpa notifikasi" - dan tanpa catatan ini, temuan itu akan
  muncul lagi setiap kali seseorang menyisir platform, lalu "diperbaiki"
  menjadi sesuatu yang justru tidak diinginkan.

  Notifikasi in-app (lonceng) TIDAK termasuk larangan ini - ia tidak
  mengganggu, dan ketiganya memang boleh memakainya bila kelak diperlukan.
*/
