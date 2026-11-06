
import type { User } from '../shared';
import { gayaDashboard } from '@/lib/kelompok/inti';
import { isPimpinan } from '@/lib/pimpinan';

const ADMIN_ROLES = ['admin', 'superadmin'];

export function isAdminRole(u: User): boolean {
  return ADMIN_ROLES.includes((u.role ?? '').toLowerCase());
}

export function hasMenu(u: User, key: string): boolean {
  if (isAdminRole(u)) return true;
  return (u.allowed_menus ?? []).includes(key);
}

export function canAccessAnalytics(u: User): boolean {
  if (isAdminRole(u)) return true;
  if (isPimpinan(u)) return true;
  if (gayaDashboard(u.team_type) === 'sales') return false;
  return (u.role ?? '').toLowerCase() === 'team';
}

export function canSeeTeamMonitoring(u: User): boolean {
  if (isAdminRole(u)) return true;
  if (isPimpinan(u)) return true;
  return (u.role ?? '').toLowerCase() === 'team' && canAccessAnalytics(u);
}

export function isTeamMember(u: User): boolean {
  return (u.role ?? '').toLowerCase() === 'team';
}
