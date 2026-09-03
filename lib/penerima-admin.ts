/**
 * lib/penerima-admin.ts - siapa yang menerima notifikasi "untuk admin".
 *
 * ── MASALAH YANG DIPERBAIKI ────────────────────────────────────────────────
 *
 * Seluruh titik notifikasi di platform ini mencari penerima admin dengan
 *
 *     .in('role', ['admin', 'superadmin'])
 *
 * Akibatnya pemegang kekuasaan sebenarnya di platform ini - Manager PTS IVP
 * yang diberi toggle "Full Access" di Admin Panel - TIDAK PERNAH ikut
 * dikabari, karena barisnya role 'team'. Ia melihat pekerjaan masuk di layar,
 * tapi tidak pernah menerima WhatsApp maupun Telegram untuk request baru,
 * approval Sales Internal, maupun pengalihan ke Supervisor.
 *
 * ── KENAPA access_level, BUKAN jabatan = 'Manager' ─────────────────────────
 *
 * Karena jabatan Manager TIDAK cukup spesifik: di basis data ini ada Manager
 * PTS UMP yang orang luar, dipakai hanya untuk menu Piket Showroom, dan tidak
 * boleh ikut menerima assignment atau alur kerja apa pun. Menyaring dengan
 * jabatan akan menyeret dia masuk.
 *
 * Toggle "Full Access" justru ADA untuk menjawab ini: ia ditetapkan admin per
 * akun lewat Admin Panel, bukan disimpulkan dari jabatan. Jadi ia menunjuk
 * tepat satu orang yang memang dimaksud, dan tetap bisa dipindah tanpa
 * mengubah kode - sesuai prinsip platform ini yang dijual ke perusahaan lain.
 */

import { supabase } from './supabase';

/** Penyaring PostgREST: admin/superadmin ATAU pemegang Full Access. */
export const SARING_PENERIMA_ADMIN = 'role.in.(admin,superadmin),access_level.eq.full';

export interface PenerimaAdmin {
  id: string;
  full_name: string;
  username: string | null;
  /** Selalu ada sebagai kunci (boleh null) supaya cocok dengan bentuk yang
   *  dipakai pemanggil lama yang menerima hasil query mentah. */
  phone_number: string | null;
}

/**
 * Daftar penerima notifikasi setingkat admin.
 *
 * Punya jalur mundur ke penyaringan role saja bila kolom access_level belum
 * ada: PostgREST menolak SELURUH query kalau satu kolom tak dikenal, dan
 * notifikasi yang berhenti total jauh lebih buruk daripada notifikasi yang
 * kurang satu penerima.
 */
export async function penerimaAdmin(): Promise<PenerimaAdmin[]> {
  const kolom = 'id, full_name, username, phone_number';
  const { data, error } = await supabase.from('users').select(kolom).or(SARING_PENERIMA_ADMIN);
  if (!error) return (data ?? []) as PenerimaAdmin[];

  const { data: mundur } = await supabase.from('users').select(kolom).in('role', ['admin', 'superadmin']);
  return (mundur ?? []) as PenerimaAdmin[];
}

/** Sama, tapi hanya yang punya nomor - untuk pengiriman WhatsApp/Telegram. */
export async function penerimaAdminBernomor(): Promise<PenerimaAdmin[]> {
  return (await penerimaAdmin()).filter(u => !!(u.phone_number ?? '').trim());
}
