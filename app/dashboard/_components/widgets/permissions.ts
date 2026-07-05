/**
 * permissions.ts — Permission Resolver untuk Permission-Aware Dashboard.
 *
 * SATU sumber untuk memutuskan widget mana yang boleh dilihat sebuah akun.
 * Berbasis `allowed_menus` (bukan hardcode role per widget). Admin/superadmin
 * diperlakukan punya SEMUA menu — persis seperti resolusi menu di
 * dashboard/page.tsx (`if (!allowed || role==='superadmin' || role==='admin')`).
 */

import type { User } from '../shared';

const ADMIN_ROLES = ['admin', 'superadmin'];

export function isAdminRole(u: User): boolean {
  return ADMIN_ROLES.includes((u.role ?? '').toLowerCase());
}

/**
 * Apakah user punya akses ke sebuah menu (key dari ALL_MENU_KEYS).
 * Admin/superadmin selalu true (mirror perilaku sidebar di page.tsx).
 */
export function hasMenu(u: User, key: string): boolean {
  if (isAdminRole(u)) return true;
  return (u.allowed_menus ?? []).includes(key);
}

/**
 * Analytics Platform penuh (DashboardKPI + Command Center + Audit Log) = HANYA
 * Admin & Team. Sesuai instruksi: Command Center & Audit Log DILARANG utk selain
 * admin/team. Supervisor Sales/Marketing TIDAK termasuk — mereka role "lain" yang
 * dapat dashboard ringkas (Analytics Saya, data sendiri). DashboardKPI juga tidak
 * meng-scope data untuk guest/sales (hasilnya kosong), jadi memang tak cocok utk mereka.
 */
export function canAccessAnalytics(u: User): boolean {
  if (isAdminRole(u)) return true;
  return (u.role ?? '').toLowerCase() === 'team';
}

/**
 * Team Monitoring Hari Ini = pantauan tim PTS (daily report vs reminder aktif).
 * Hanya relevan utk yang mengawasi tim PTS: admin + akun Team PTS yang punya
 * akses analytics (Supervisor / Team dgn menu dashboard). Supervisor Sales TIDAK
 * masuk — mereka tidak mengawasi tim PTS.
 */
export function canSeeTeamMonitoring(u: User): boolean {
  if (isAdminRole(u)) return true;
  return (u.role ?? '').toLowerCase() === 'team' && canAccessAnalytics(u);
}

/** true utk akun tim (mengerjakan assignment), utk memilih varian query widget. */
export function isTeamMember(u: User): boolean {
  return (u.role ?? '').toLowerCase() === 'team';
}
