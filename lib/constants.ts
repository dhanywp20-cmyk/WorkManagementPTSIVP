// ─── Session ──────────────────────────────────────────────────────────────────
/** Durasi sesi login: 6 jam (sama di semua modul) */
export const SESSION_DURATION_MS = 6 * 60 * 60 * 1000;

// ─── Brand Colors ─────────────────────────────────────────────────────────────
/**
 * Token warna brand IVP — gunakan ini di semua modul, jangan hardcode hex/tailwind class.
 * Tailwind class alias ada di tailwind.config (jika sudah setup),
 * atau gunakan CSS variable --ivp-brand-* via globals.css.
 */
export const BRAND = {
  /** Warna utama brand — rose-600 */
  primary:      '#e11d48',
  primaryDark:  '#be123c',
  primaryLight: '#f43f5e',
  /** Hover / active state */
  hover:        '#9f1239',
  /** Background tint ringan */
  tint:         '#fff1f2',
  tintBorder:   '#fecdd3',
} as const;

// ─── Z-Index Standar ──────────────────────────────────────────────────────────
/**
 * Gunakan konstanta ini untuk z-index agar tidak bentrok antar modul.
 * Jangan pakai angka arbitrary seperti z-[99999].
 */
export const Z = {
  dropdown:  40,
  sticky:    50,
  modal:     100,
  modalTop:  110,   // modal di atas modal (konfirmasi hapus, dll)
  toast:     200,
  tooltip:   300,
} as const;

// ─── Role Helpers ─────────────────────────────────────────────────────────────
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
 * Bentuk minimal yang dibutuhkan hasFullAccess() — SENGAJA bukan CurrentUser
 * langsung. Modul lain (Learning Center, Piket Showroom, dst) masing-masing
 * punya `User`/`currentUser` bertipe lokal sendiri (pola yang sudah dipakai
 * di seluruh platform ini, lihat CLAUDE.md/audit modul); mensyaratkan
 * CurrentUser persis akan menolak semuanya karena field opsionalnya sedikit
 * berbeda (mis. `jabatan?: string | null` vs `string | undefined`). Bentuk
 * struktural longgar ini kompatibel dengan tipe User apa pun di platform.
 */
type AccessCheckUser = { role?: string | null; team_type?: string | null; access_level?: string | null } | null | undefined;

/**
 * Akses PENUH setara admin di modul DATA (Piket Showroom, Learning Center,
 * KPI Team, Form Review, Ticketing, Reminder Schedule, Daily Report, Unit
 * Movement, Project Progress) — BUKAN hak kelola akun (itu tetap admin/
 * superadmin saja lewat /api/admin/users).
 *
 * Sengaja BUKAN ditebak dari jabatan ('Manager', dst) — itu rapuh, harus
 * diubah di kode tiap kali struktur organisasi berubah. Sebagai gantinya,
 * admin men-toggle kolom users.access_level ('full'/'guest') per akun lewat
 * Admin Panel (lib/admin-users.ts adminSetAccessLevel). Toggle ini HANYA
 * berlaku untuk role='team' — sesuai desain platform: dibuat untuk Team PTS
 * mengelola timnya sendiri, bukan untuk Guest/Sales/Marketing mengelola tim
 * lain, jadi access_level='full' pada akun non-team diabaikan.
 *
 * Lihat sql/user-full-access-toggle.sql untuk skema & alasan lengkap.
 */
export function hasFullAccess(user: AccessCheckUser): boolean {
  if (!user) return false;
  const r = (user.role ?? '').toLowerCase();
  const admin = r === 'admin' || r === 'superadmin';
  const team = r === 'team' || r === 'team_pts';
  return admin || (team && user.access_level === 'full');
}
