// Session
/** Durasi sesi login: 6 jam (sama di semua modul) */
export const SESSION_DURATION_MS = 6 * 60 * 60 * 1000;

// Brand Colors
/**
 * DIPINDAH. Warna merek sekarang datang dari database lewat lib/merek.ts dan
 * bisa diganti tiap organisasi dari Admin Panel -> Dashboard Setting.
 *
 * Konstanta BRAND yang dulu di sini memakai merah rose yang dipatok, jadi ia
 * menjadi sumber warna KEDUA di samping database. Ia sudah tidak dipakai satu
 * tempat pun saat dibuang - tapi dibiarkan berdiri berarti cepat atau lambat
 * ada kode baru yang memakainya dan diam-diam mengabaikan pengaturan merek.
 *
 * Yang harus dipakai sekarang:
 *   - Warna MEREK  : useMerek() dari lib/merek.ts, atau var(--merek-utama).
 *   - Warna MAKNA  : WARNA / gayaWarna() dari lib/desain.ts. Hijau tetap
 *                    berarti berhasil dan merah tetap berarti bahaya di mana
 *                    pun platform ini dipasang, jadi keduanya sengaja TIDAK
 *                    ikut bisa diganti.
 */

// Z-Index Standar
/** Skala z-index tinggal di lib/z-index.ts - satu sumber, jangan disalin. */
export { Z } from './z-index';

// Role Helpers
import type { CurrentUser } from './use-current-user';

/** Cek apakah user adalah admin atau superadmin */
export function isAdmin(user: CurrentUser | null): boolean {
  if (!user) return false;
  const r = (user.role ?? '').toLowerCase();
  return r === 'admin' || r === 'superadmin';
}

/** Cek apakah user adalah team PTS (semua varian) */
export function isTeamPTS(user: CurrentUser | null): boolean {
  if (!user) return false;
  const r = (user.role ?? '').toLowerCase();
  return r === 'team' || r === 'team_pts';
}

/** Cek apakah user adalah sales / guest */
export function isSalesGuest(user: CurrentUser | null): boolean {
  if (!user) return false;
  const r = (user.role ?? '').toLowerCase();
  return r === 'guest' || r === 'sales';
}

/** Cek apakah user memiliki jabatan level supervisor ke atas */
export const SUPERVISOR_JABATAN = [
  'Supervisor', 'Manager', 'Deputy General Manager', 'General Manager', 'Direktur',
] as const;

export function isSupervisorLevel(user: CurrentUser | null): boolean {
  if (!user) return false;
  return SUPERVISOR_JABATAN.includes((user.jabatan ?? '') as typeof SUPERVISOR_JABATAN[number]);
}

/** Cek akses admin luas: admin, superadmin, atau PTS Supervisor */
export function isAdminOrSupervisor(user: CurrentUser | null): boolean {
  if (!user) return false;
  return isAdmin(user) || (isTeamPTS(user) && user.jabatan === 'Supervisor');
}

/**
 * Bentuk minimal yang dibutuhkan hasFullAccess(), sengaja struktural dan bukan
 * CurrentUser. Tiap modul punya tipe `User` lokalnya sendiri dengan field
 * opsional yang sedikit berbeda; bentuk longgar ini menerima semuanya.
 */
type AccessCheckUser = { role?: string | null; team_type?: string | null; access_level?: string | null } | null | undefined;

/**
 * Akses PENUH setara admin di modul DATA - BUKAN hak kelola akun, yang tetap
 * milik admin/superadmin lewat /api/admin/users.
 *
 * Sengaja tidak ditebak dari jabatan; admin men-toggle users.access_level
 * ('full'/'guest') per akun lewat Admin Panel. Toggle itu HANYA berlaku untuk
 * role='team', jadi access_level='full' pada akun non-team diabaikan. Lihat
 * sql/user-full-access-toggle.sql.
 */
export function hasFullAccess(user: AccessCheckUser): boolean {
  if (!user) return false;
  const r = (user.role ?? '').toLowerCase();
  const admin = r === 'admin' || r === 'superadmin';
  const team = r === 'team' || r === 'team_pts';
  return admin || (team && user.access_level === 'full');
}
