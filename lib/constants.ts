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
