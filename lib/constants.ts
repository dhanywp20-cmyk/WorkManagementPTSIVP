export const SESSION_DURATION_MS = 400 * 24 * 60 * 60 * 1000;

export { Z } from './z-index';

import type { CurrentUser } from './use-current-user';

export function isAdmin(user: CurrentUser | null): boolean {
  if (!user) return false;
  const r = (user.role ?? '').toLowerCase();
  return r === 'admin' || r === 'superadmin';
}

export function isTeamPTS(user: CurrentUser | null): boolean {
  if (!user) return false;
  const r = (user.role ?? '').toLowerCase();
  return r === 'team' || r === 'team_pts';
}

export function isSalesGuest(user: CurrentUser | null): boolean {
  if (!user) return false;
  const r = (user.role ?? '').toLowerCase();
  return r === 'guest' || r === 'sales';
}

export const SUPERVISOR_JABATAN = [
  'Supervisor', 'Manager', 'Deputy General Manager', 'General Manager', 'Direktur',
] as const;

export function isSupervisorLevel(user: CurrentUser | null): boolean {
  if (!user) return false;
  return SUPERVISOR_JABATAN.includes((user.jabatan ?? '') as typeof SUPERVISOR_JABATAN[number]);
}

export function isAdminOrSupervisor(user: CurrentUser | null): boolean {
  if (!user) return false;
  return isAdmin(user) || (isTeamPTS(user) && user.jabatan === 'Supervisor');
}

type AccessCheckUser = { role?: string | null; team_type?: string | null; access_level?: string | null } | null | undefined;

export function hasFullAccess(user: AccessCheckUser): boolean {
  if (!user) return false;
  const r = (user.role ?? '').toLowerCase();
  const admin = r === 'admin' || r === 'superadmin';
  const team = r === 'team' || r === 'team_pts';
  return admin || (team && user.access_level === 'full');
}

export const bolehDiwaypiDan2FA = (user: AccessCheckUser): boolean => hasFullAccess(user);
