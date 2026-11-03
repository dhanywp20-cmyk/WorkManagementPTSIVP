import { kelompokDitugaskan, KELOMPOK_BAWAAN } from './kelompok-inti';

export const ASSIGNABLE_PTS_TEAMS = KELOMPOK_BAWAAN
  .filter(k => k.ditugaskan)
  .map(k => k.nama) as readonly string[];

export function daftarTimDitugaskan(): string[] {
  return kelompokDitugaskan().map(k => k.nama);
}

export function isAssignablePTSTeam(teamType?: string | null): boolean {
  const t = (teamType ?? '').trim();
  if (!t) return false;
  return daftarTimDitugaskan().includes(t);
}

export function bolehDitugaskan(u: {
  team_type?: string | null;
  bisa_ditugaskan?: boolean | null;
}): boolean {
  if (!isAssignablePTSTeam(u.team_type)) return false;
  return u.bisa_ditugaskan !== false;
}

export function bolehDitugaskanOleh(
  u: { team_type?: string | null; bisa_ditugaskan?: boolean | null; jabatan?: string | null },
  penugasAdmin: boolean,
): boolean {
  if (u.jabatan === 'Manager') return penugasAdmin && isAssignablePTSTeam(u.team_type);
  return bolehDitugaskan(u);
}

export function adalahAdminMurni(u: { role?: string | null } | null | undefined): boolean {
  return ['admin', 'superadmin'].includes((u?.role ?? '').toLowerCase());
}
