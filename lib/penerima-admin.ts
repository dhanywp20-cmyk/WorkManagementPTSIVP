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

/**
 * SATU orang yang mewakili "Manager" - dipakai saat sebuah dokumen atau
 * proses harus mencatat nama pimpinan (mis. Process Batch & export Incentive).
 *
 * KENAPA BUKAN jabatan = 'Manager' AND team_type = 'Team PTS IVP'
 *
 * Begitulah dua tempat di modul Incentive mencarinya sebelum ini, dan itu
 * salah dalam tiga cara sekaligus:
 *
 *   1. Nama tim dipaku di kode. Perusahaan lain yang memakai platform ini
 *      punya nama tim sendiri, dan pencariannya akan mengembalikan kosong -
 *      lalu diam-diam jatuh ke 'Manager' sebagai teks biasa, sehingga dokumen
 *      pembayaran mencatat nama yang tidak menunjuk siapa pun.
 *   2. Ada lebih dari satu jabatan Manager di basis data ini (PTS IVP dan
 *      PTS UMP). `.limit(1)` memilih salah satunya tanpa aturan - untuk
 *      dokumen yang menyangkut uang, itu tidak boleh diserahkan pada urutan
 *      baris.
 *   3. Mengabaikan Full Access, yang justru dibuat untuk menunjuk siapa
 *      pemegang kewenangan di platform ini.
 *
 * Urutannya: app_settings.manager_user_id kalau disetel admin (penunjukan
 * paling eksplisit), lalu pemegang Full Access. Mengembalikan null bila tidak
 * ada keduanya - pemanggil yang memutuskan apa artinya, bukan berpura-pura
 * ada orang bernama "Manager".
 */
export async function managerUtama(): Promise<PenerimaAdmin | null> {
  try {
    const { data: setelan } = await supabase.from('app_settings')
      .select('value').eq('key', 'manager_user_id').maybeSingle();
    const id = setelan?.value ? String(setelan.value).replace(/^"|"$/g, '') : '';
    if (id) {
      const { data } = await supabase.from('users')
        .select('id, full_name, username, phone_number').eq('id', id).maybeSingle();
      if (data) return data as PenerimaAdmin;
    }
  } catch { /* lanjut ke Full Access */ }

  try {
    const { data } = await supabase.from('users')
      .select('id, full_name, username, phone_number')
      .eq('access_level', 'full').order('full_name').limit(1).maybeSingle();
    return (data as PenerimaAdmin) ?? null;
  } catch {
    return null;
  }
}
