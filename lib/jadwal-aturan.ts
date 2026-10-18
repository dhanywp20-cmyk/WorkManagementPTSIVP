/**
 * lib/jadwal-aturan.ts - aturan & teks Reminder Schedule yang dipakai BERSAMA oleh layar
 * Reminder Schedule (peramban) dan DIWAYPI (server). Murni: tanpa klien Supabase,
 * tanpa window - aman diimpor dari sisi mana pun.
 *
 * Konstanta di sini dulu tinggal di reminder-schedule/_components/shared.ts; berkas itu
 * kini mengekspornya ulang, jadi semua impor lama tetap bekerja.
 */
import { adalahKategoriInsentif } from '@/lib/incentive-scheme';
import { normalkanNama } from '@/lib/kelompok-insentif';

export type StatusJadwal = 'pending' | 'done' | 'cancelled';
export const STATUS_JADWAL: readonly StatusJadwal[] = ['pending', 'done', 'cancelled'];

export const CATEGORIES = ['Demo Product', 'Meeting & Survey', 'Konfigurasi', 'Konfigurasi & Training', 'Troubleshooting', 'Training', 'Maintenance', 'Standby Event', 'Internal'];

// Kategori yang men-trigger auto form_review ke Guest
export const REVIEW_TRIGGER_CATEGORIES = ['Konfigurasi', 'Demo Product', 'Konfigurasi & Training', 'Training'] as const;

// Kategori yang wajib memilih Onsite/Remote saat status  Completed
export const INCENTIVE_TRIGGER_CATEGORIES = ['Konfigurasi', 'Konfigurasi & Training', 'Training'] as const;

export function formatDate(dateStr: string) {
  if (!dateStr) return '';
  return new Date(dateStr + 'T00:00:00').toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
}

// Generate batch_id untuk 1 submission multi-tanggal (fallback kalau crypto.randomUUID tidak ada)
export function newBatchId(): string {
  return (typeof crypto !== 'undefined' && crypto.randomUUID)
    ? crypto.randomUUID()
    : `batch-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

/** Bentuk minimal baris jadwal untuk aturan di berkas ini. */
export interface JadwalRingkas {
  project_name: string;
  category: string;
  status: string;
  assigned_to?: string | null;
  assign_name?: string | null;
  sales_name?: string | null;
  created_by?: string | null;
}

/**
 * Boleh mengubah (status / detail) jadwal ini? - satu sumber untuk tombol Update Status,
 * Re-Schedule, dan Edit (useTurunanJadwal.bolehEditReminder) dan untuk DIWAYPI.
 * Pimpinan tidak pernah boleh; admin & Manager selalu; selain itu hanya pelaku
 * jadwalnya sendiri (pelaksana, Sales-nya, atau pembuatnya).
 */
export function bolehUbahJadwal(
  u: { username?: string | null; full_name?: string | null } | null,
  r: JadwalRingkas,
  peran: { isAdmin: boolean; isManager: boolean; pimpinan: boolean },
): boolean {
  return !peran.pimpinan && (peran.isAdmin || peran.isManager
    || (!!u?.username && r.assigned_to === u.username)
    || (!!u?.full_name && r.assign_name === u.full_name)
    || (!!u?.full_name && r.sales_name === u.full_name)
    || (!!u?.username && r.created_by === u.username));
}

/**
 * Jadwal kategori insentif lain dengan nama proyek yang sama (yang belum dibatalkan) -
 * dasar pertanyaan "ini kelanjutan proyek yang sudah ada?" saat membuat jadwal baru.
 */
export function proyekSerupa<T extends JadwalRingkas>(daftar: readonly T[], nama: string, kategori: string): T[] {
  if (!adalahKategoriInsentif(kategori)) return [];
  const n = normalkanNama(nama);
  if (!n) return [];
  return daftar.filter(r =>
    normalkanNama(r.project_name) === n
    && adalahKategoriInsentif(r.category)
    && r.status !== 'cancelled');
}

/** Isian wajib sebelum jadwal disimpan. null = lengkap. */
export function galatIsianJadwal(
  f: { project_name: string; assigned_to: string; due_date: string; address: string; sales_name?: string | null; category: string },
  perluPelaksana: boolean,
): string | null {
  if (!f.project_name.trim()) return 'Nama project wajib diisi!';
  if (perluPelaksana && !f.assigned_to) return 'Pilih anggota team!';
  if (!f.due_date) return 'Tanggal wajib diisi!';
  if (!f.address.trim()) return 'Lokasi Project wajib diisi!';
  if (!f.sales_name?.trim()) return 'Pilih Sales wajib diisi!';
  return null;
}

/** Baris "Jadwal" di pesan WA jadwal baru - satu atau beberapa tanggal. */
export function barisJadwalWA(tanggal: string[], jam?: string | null): string {
  return tanggal.length > 1
    ? `🕐 *Jadwal (${tanggal.length} hari):* ${tanggal.map(d => formatDate(d)).join(', ')}${jam ? ' · ' + jam : ''}`
    : `🕐 Jadwal: *${formatDate(tanggal[0])}${jam ? ' · ' + jam : ''}*`;
}

/** Pesan WA "JADWAL BARU" untuk pelaksana - assign tunggal maupun massal. */
export function pesanJadwalBaru(namaPenerima: string, f: {
  project_name: string; description: string; product?: string | null; category: string; address: string;
  sales_name: string; sales_division?: string | null; pic_name?: string | null; pic_phone?: string | null; notes?: string | null;
}, jadwalLine: string, tautan: string): string {
  return `🗓️ *JADWAL BARU — PTS IVP*\n\n` +
    `Halo *${namaPenerima}*, kamu mendapat jadwal baru:\n\n` +
    `*Nama Project: ${f.project_name}*\n` +
    `*Deskripsi: ${f.description}*\n` +
    `📦 *Product: ${f.product}*\n` +
    `🏷️ Kategori: ${f.category}\n` +
    `📍 Lokasi: ${f.address || '-'}\n` +
    `👤 Sales: ${f.sales_name}${f.sales_division ? ' - ' + f.sales_division : ''}\n` +
    `${jadwalLine}\n` +
    (f.pic_name ? `🙋 PIC: ${f.pic_name}${f.pic_phone ? ' - ' + f.pic_phone : ''}\n\n` : '') +
    (f.notes ? `📝 Catatan: ${f.notes}\n\n` : '') +
    `-\n` +
    `Link Dashboard: ${tautan}\n` +
    `jangan lupa peralatan & Semangat💪🏼`;
}
